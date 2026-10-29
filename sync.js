import { fresh, validate } from './model.js';
import { storeBaseline, loadBaseline } from './sync-cache.js';
export const CLOUD_KEY='kanchit-cloud-sync-v1';
const copy=v=>v===undefined?undefined:structuredClone(v);
function canonical(v){if(Array.isArray(v)){const rows=v.every(x=>x&&typeof x==='object'&&typeof x.id==='string')?[...v].sort((a,b)=>a.id.localeCompare(b.id)):v;return rows.map(canonical);}if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
export const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function mergeDocuments(base,local,remote,prefer=''){
 const conflicts=[];
 function merge(b,l,r,path){
  if(equal(l,r))return copy(l);if(equal(l,b))return copy(r);if(equal(r,b))return copy(l);
  if(path.endsWith('.updatedAt')||path.endsWith('.reviewsUpdatedAt'))return [l,r].filter(Boolean).sort().at(-1);
  if(Array.isArray(l)&&Array.isArray(r)&&(b===undefined||Array.isArray(b))&&[...l,...r,...(b||[])].every(v=>object(v)&&typeof v.id==='string')){
   const bm=new Map((b||[]).map(v=>[v.id,v])),lm=new Map(l.map(v=>[v.id,v])),rm=new Map(r.map(v=>[v.id,v]));
   return [...new Set([...(b||[]).map(v=>v.id),...l.map(v=>v.id),...r.map(v=>v.id)])].map(id=>merge(bm.get(id),lm.get(id),rm.get(id),path+'['+id+']')).filter(v=>v!==undefined);
  }
  if(object(l)&&object(r)&&(b===undefined||object(b))){const result={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){const value=merge(b?.[key],l[key],r[key],path+'.'+key);if(value!==undefined)result[key]=value;}return result;}
  conflicts.push(path);return copy(prefer==='remote'?r:l);
 }
 return {document:merge(base,local,remote,'bankbook'),conflicts};
}
export function hasRecords(s){return ['accounts','transactions','games','bills','debts','goals','holdings'].some(k=>s[k]?.length)||s.profile?.income>0||s.profile?.living>0;}

export class RealtimeSync {
 constructor({getLocal,applyRemote,onStatus,busy=()=>false,storage=globalThis.localStorage,fetcher=globalThis.fetch?.bind(globalThis),eventSource=globalThis.EventSource,online=()=>globalThis.navigator?.onLine!==false}){
  Object.assign(this,{getLocal,applyRemote,onStatus,busy,storage,fetcher,eventSource,online});
  this.revision=0;this.base=fresh();this.userId=null;this.ready=false;this.inflight=false;this.migration=null;this.conflict=null;this.mode='connecting';this.lastAt=null;this.closed=false;this.meta=null;
  try{this.meta=JSON.parse(storage.getItem(CLOUD_KEY)||'null');}catch{}
 }
 status(mode,message=''){const stamp=mode+'|'+message+'|'+this.lastAt;if(stamp===this.statusStamp)return;this.statusStamp=stamp;this.mode=mode;this.message=message;this.onStatus?.(this);}
 remember(){
  const meta={userId:this.userId,revision:this.revision,base:copy(this.base),lastAt:this.lastAt};
  if(typeof indexedDB==='undefined'){this.storage.setItem(CLOUD_KEY,JSON.stringify(meta));return;}
  void storeBaseline(meta.userId,meta.revision,meta.base).then(()=>{if(this.userId===meta.userId&&this.revision===meta.revision)this.storage.setItem(CLOUD_KEY,JSON.stringify({...meta,base:null,indexed:true}));}).catch(()=>{try{this.storage.setItem(CLOUD_KEY,JSON.stringify(meta));}catch{this.status('error','พื้นที่เก็บข้อมูลในเครื่องไม่พอ กรุณาส่งออกสำรองก่อนปิดหน้า');}});
 }
 async request(path,options={}){
  const response=await this.fetcher(path,{credentials:'same-origin',cache:'no-store',...options,signal:AbortSignal.timeout(20000)});
  const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json')){const error=Error(response.redirected?'sign_in_required':'no_backend');error.code=response.redirected?401:404;throw error;}
  const data=await response.json();if(!response.ok){const error=Error(data.error||'connection_failed');error.code=response.status;error.data=data;throw error;}return data;
 }
 async start(){
  if(this.closed)return;this.status('connecting');
  try{
   const remote=await this.request('/api/state');if(this.busy()){this.retryTimer=setTimeout(()=>this.start(),600);return;}if(remote.document)validate(remote.document);
   const local=this.getLocal();this.userId=remote.user.id;
   if(this.meta?.userId&&this.meta.userId!==this.userId){this.migration={remote,accountChanged:true};this.status('account-changed');return;}
   if(this.meta?.userId===this.userId&&this.meta.indexed){const saved=await loadBaseline(this.userId).catch(()=>null);if(saved?.revision===this.meta.revision)this.meta.base=saved.base;else this.meta=null;}
   if(this.meta?.userId===this.userId){this.base=this.meta.base;this.revision=this.meta.revision;this.lastAt=this.meta.lastAt;this.ready=true;this.accept(remote);}
   else if(remote.document&&hasRecords(local)&&!equal(local,remote.document)){
    this.migration={remote,accountChanged:false};this.status('migration');return;
   }else{
    this.revision=remote.revision;this.base=remote.document||fresh();this.lastAt=remote.updatedAt;this.ready=true;
    if(remote.document)this.applyRemote(copy(remote.document));this.remember();
   }
   if(!this.conflict){this.connect();this.schedule();}
  }catch(err){this.fail(err);}
 }
 chooseMigration(choice){
  if(!this.migration)return;const {remote,accountChanged}=this.migration;
  if(accountChanged&&choice!=='cloud')return;
  const local=copy(this.getLocal());this.base=remote.document||fresh();this.revision=remote.revision;this.lastAt=remote.updatedAt;
  if(choice==='cloud')this.applyRemote(copy(this.base));
  else {const merged=mergeDocuments(fresh(),local,this.base);if(merged.conflicts.length){this.conflict={base:fresh(),local,remote:this.base,revision:this.revision,paths:merged.conflicts};this.ready=true;this.migration=null;this.status('conflict');return;}validate(merged.document);this.applyRemote(merged.document);}
  this.migration=null;this.ready=true;this.remember();this.connect();this.schedule();
 }
 accept(remote){
  if(remote.revision<this.revision)return;
  const current=copy(this.getLocal()),cloud=remote.document||fresh();
  if(equal(current,this.base)){this.base=cloud;this.revision=remote.revision;this.lastAt=remote.updatedAt;this.applyRemote(copy(cloud));this.remember();this.status('synced');return;}
  const merged=mergeDocuments(this.base,current,cloud);
  try{validate(merged.document);}catch{merged.conflicts.push('bankbook.related-records');}
  if(merged.conflicts.length){this.conflict={base:copy(this.base),local:current,remote:cloud,revision:remote.revision,paths:merged.conflicts};this.status('conflict');return;}
  this.base=cloud;this.revision=remote.revision;this.lastAt=remote.updatedAt;this.applyRemote(merged.document);this.remember();this.status(equal(merged.document,cloud)?'synced':'pending');
 }
 resolveConflict(prefer){
  const conflict=this.conflict;if(!conflict)return;
  const merged=mergeDocuments(conflict.base,conflict.local,conflict.remote,prefer);
  let document=merged.document;
  try{validate(document);}catch{document=copy(prefer==='remote'?conflict.remote:conflict.local);validate(document);}
  this.base=copy(conflict.remote);this.revision=conflict.revision;this.conflict=null;this.status('pending');this.applyRemote(document);this.remember();this.connect();this.schedule();
 }
 enqueue(){if(this.conflict){this.conflict.local=copy(this.getLocal());this.status('conflict');return;}if(!this.ready){if(this.mode==='connecting'||this.mode==='offline')this.status('pending','รอเชื่อมต่อเพื่อส่งข้อมูล');return;}this.schedule();}
 schedule(){if(!this.ready||this.closed||this.conflict||this.migration)return;
  if(equal(this.getLocal(),this.base)){this.status('synced');return;}
  this.status('pending');clearTimeout(this.sendTimer);this.sendTimer=setTimeout(()=>this.flush(),250);
 }
 async flush(){
  if(this.inflight||!this.ready||this.closed||this.conflict||this.migration)return;
  if(equal(this.getLocal(),this.base)){this.status('synced');return;}
  if(!this.online()){this.status('offline');return;}
  this.inflight=true;const sent=copy(this.getLocal()),revision=this.revision;
  const mutationId=crypto.randomUUID();this.status('saving');
  try{
   const remote=await this.request('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,mutationId,document:sent,userId:this.userId})});
   this.base=copy(sent);this.revision=remote.revision;this.lastAt=remote.updatedAt;this.remember();this.inflight=false;this.schedule();
  }catch(err){this.inflight=false;if(err.code===409&&err.data?.error==='account_changed'){this.ready=false;const remote=await this.request('/api/state').catch(()=>null);if(remote){this.migration={remote,accountChanged:true};this.status('account-changed');}else this.status('sign-in');}else if(err.code===409){this.accept(err.data);if(!this.conflict)this.schedule();}else this.fail(err);}
 }
 async pull(){if(this.closed||this.inflight||this.busy()||this.migration||this.conflict)return;
  try{const remote=await this.request('/api/state?revision='+this.revision);if(remote.user?.id!==this.userId){this.ready=false;const complete=remote.unchanged?await this.request('/api/state'):remote;this.migration={remote:complete,accountChanged:true};this.status('account-changed');return;}if(remote.revision>this.revision)this.accept(remote);if(!this.conflict)this.schedule();}catch(err){this.fail(err);}
 }
 connect(){
  if(this.closed||this.migration||this.conflict)return;
  if(!this.events&&this.eventSource){
   this.events=new this.eventSource('/api/events');
   const receive=e=>{if(this.closed)return;try{const data=JSON.parse(e.data);if(data.revision>this.revision)this.pull();else if(equal(this.getLocal(),this.base))this.status('synced');}catch{}};
   this.events.addEventListener('revision',receive);this.events.addEventListener('heartbeat',receive);
   this.events.onerror=()=>{if(!this.closed&&this.mode==='synced')this.status('reconnecting');};
  }
  if(!this.pollTimer)this.pollTimer=setInterval(()=>{if(!this.ready)this.start();else this.pull();},4000);
 }
 fail(err){
  const code=err.code;
  if(code===401){this.status('sign-in');return;}
  if(code===404){this.status('static');return;}
  if(code===400||code===413){this.status('error',code===413?'ข้อมูลรวมใหญ่เกิน 6 MB กรุณาลดรูปหรือจำนวนข้อมูลก่อนส่ง':'ข้อมูลไม่ผ่านการตรวจสอบ กรุณาส่งออกสำรองและตรวจรายการ');return;}
  this.status('offline','ข้อมูลยังอยู่ในเครื่อง จะลองส่งอีกครั้ง');clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>this.ready?this.flush():this.start(),5000);
 }
 stop(){this.closed=true;this.events?.close();clearInterval(this.pollTimer);clearTimeout(this.sendTimer);clearTimeout(this.retryTimer);}
}
