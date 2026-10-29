import {validatePlan} from './debt-plan.js';
import * as C from './core.js';
export const KEY='kanchit-bankbook-v2';
export const RESET='kanchit-clean-start-20261029';
export function fresh(){return {...C.emptyState(),version:2,settings:{bridgeUrl:''},updatedAt:null};}
export function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
export const updated=()=>new Date().toISOString();
export function gameStats(g){const rows=g.ledger||[];const costs=rows.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0),revenue=rows.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);const snapshots=[...g.snapshots].sort((a,b)=>a.date.localeCompare(b.date)||String(a.updatedAt).localeCompare(String(b.updatedAt)));const last=snapshots.at(-1),previous=snapshots.at(-2);const netUnit=Math.round(g.price*(1-g.fee/100)*(1-g.refund/100));return {costs,revenue,profit:revenue-costs,budgetLeft:g.budget-costs,snapshots,last,previous,netUnit,breakEven:netUnit>0?Math.ceil(Math.max(0,costs-revenue)/netUnit):null};}
export function addDays(date,n){return new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function releasePlan(g,now=C.today()){
 const left=g.milestones.filter(m=>!m.done),hours=left.reduce((a,m)=>a+m.hours,0),weeks=g.weeklyHours>0?Math.ceil(hours/g.weeklyHours):null;
 const calendar=workCalendar(g,now),taskEnd=calendar.finish?addDays(calendar.finish,g.bufferDays):null,taskDue=left.map(m=>m.due).filter(validDate).sort().at(-1);
 const earliest=taskEnd?[taskEnd,taskDue||now,now].sort().at(-1):null;
 const date=earliest?[earliest,g.release||now].sort().at(-1):g.release;
 const st=gameStats(g),negative=g.reviews.filter(r=>r.sentiment==='negative'),tips=[];
 if(g.status==='published'){if(negative.length)tips.push(`มีรีวิวเชิงลบ ${negative.length} รายการ ตรวจประเด็นซ้ำและอัปเดตแก้ไขก่อนแคมเปญถัดไป`);tips.push('วางส่วนลดหลังแพตช์ที่แก้ปัญหาหลัก และเทียบช่วงกิจกรรมที่ตรงกลุ่มผู้เล่นใน Steamworks');}
 else {if(!g.milestones.length)tips.push('เพิ่มงานที่เหลือและชั่วโมงโดยประมาณ เพื่อคำนวณเวลาพัฒนาได้แม่นขึ้น');if(earliest)tips.push(`จากงานที่เหลือ ${hours} ชั่วโมง ทำสัปดาห์ละ ${g.weeklyHours} ชั่วโมง และเผื่อทดสอบ ${g.bufferDays} วัน คาดว่าจะพัฒนาเสร็จวันที่ ${C.dateText(earliest)}`);if(earliest&&g.release<earliest)tips.push(`แผนเดิม ${C.dateText(g.release)} เร็วกว่าความพร้อม ควรเลื่อนไปอย่างน้อย ${C.dateText(earliest)}`);if(!st.last)tips.push('เพิ่ม Wishlist และผู้เข้าชมอย่างน้อยสองวันที่ต่างกัน เพื่อดูแนวโน้มก่อนตัดสินใจเปิดขาย');if(!g.demoReady)tips.push('เตรียมเดโมและรับฟีดแบ็กก่อนยืนยันวันเผยแพร่');if(!g.storeReady)tips.push('เตรียมหน้าร้าน รูปปก วิดีโอ และรายละเอียดให้ครบก่อนเริ่มแคมเปญ');}
 if(g.budgetSet!==false&&st.budgetLeft<0)tips.push(`ต้นทุนเกินงบ ${C.fmt(-st.budgetLeft)} บาท ทบทวนขอบเขตงานก่อนเพิ่มค่าใช้จ่าย`);
 if(st.last&&st.previous){const days=C.days(st.previous.date,st.last.date),delta=st.last.wishlists-st.previous.wishlists;if(days>0)tips.push(`Wishlist เปลี่ยน ${delta>=0?'+':''}${delta.toLocaleString('th-TH')} ใน ${days} วัน เฉลี่ย ${(delta/days).toFixed(1)} ต่อวัน`);}
 return {hours,weeks,earliest,date,tips};
}
export function discountPlan(g,percent,units,now=C.today()){
 const st=gameStats(g),price=Math.round(g.price*(1-percent/100)),unit=Math.round(price*(1-g.fee/100)*(1-g.refund/100));
 const base=st.netUnit*units,required=unit?Math.ceil(base/unit):null;
 const readiness=releasePlan(g,now);const release=g.status==='published'?g.release:readiness.date;
 const eligible=release?addDays(release,30):null;
 const last=g.lastDiscountEnd?addDays(g.lastDiscountEnd,30):null;const raised=g.lastPriceIncrease?addDays(g.lastPriceIncrease,30):null;
 const earliest=eligible?[eligible,last||eligible,raised||eligible,now].sort().at(-1):null;
 return {price,unit,base,required,revenue:unit*units,earliest,loss:base-unit*units};
}
const topics=[['บั๊กและเสถียรภาพ',/bug|crash|freeze|broken|บั๊ก|ค้าง|เด้ง|เซฟหาย/i],['ประสิทธิภาพ',/fps|lag|performance|stutter|optimization|กระตุก|เฟรม|หน่วง/i],['การควบคุมและ UI',/control|keyboard|controller|interface|\bui\b|ควบคุม|ปุ่ม|เมนู/i],['เนื้อหาและความคุ้มค่า',/content|short|price|expensive|value|ราคา|สั้น|แพง|คุ้ม|เนื้อหา/i],['ภาษาและการเข้าถึง',/language|translation|subtitle|accessibility|ภาษา|แปล|ซับ/i],['ระบบและความสนุก',/gameplay|combat|balance|boring|fun|สนุก|สมดุล|เบื่อ|ระบบ/i]];
export function reviewTopic(text){return topics.find(([,re])=>re.test(text))?.[0]||'ข้อเสนอแนะทั่วไป';}
export function reviewSummary(reviews){return topics.map(([topic])=>({topic,count:reviews.filter(r=>r.sentiment==='negative'&&(r.topic===topic||reviewTopic(r.text)===topic)).length})).filter(t=>t.count).sort((a,b)=>b.count-a.count);}
export function importReviews(data){const rows=Array.isArray(data)?data:data.reviews||data.response?.reviews;if(!Array.isArray(rows))throw Error('ไม่พบรายการ reviews ในไฟล์');return rows.slice(0,500).map(r=>{const text=String(r.review??r.text??'').slice(0,6000);if(!text.trim())return null;return {id:String(r.recommendationid||r.id||C.uid()),text,topic:reviewTopic(text),sentiment:typeof r.voted_up==='boolean'?(r.voted_up?'positive':'negative'):['positive','negative','neutral'].includes(r.sentiment)?r.sentiment:'neutral',date:r.timestamp_created?new Date(r.timestamp_created*1000).toISOString().slice(0,10):validDate(r.date)?r.date:C.today(),source:'import',author:String(r.author?.steamid||r.author||'ผู้เล่น').slice(0,100)};}).filter(Boolean);}
export function putGameEntry(s,g,entry){if(entry.accountId&&!s.accounts.some(a=>a.id===entry.accountId))throw Error('ไม่พบบัญชีที่เลือก');g.ledger ||= [];const old=g.ledger.find(t=>t.id===entry.id);if(old)Object.assign(old,entry);else g.ledger.push(entry);s.transactions=s.transactions.filter(t=>t.gameEntryId!==entry.id);if(entry.accountId){s.transactions.push({id:C.uid(),gameEntryId:entry.id,gameId:g.id,type:entry.type,amount:entry.amount,note:g.name+' · '+entry.note,date:entry.date,category:entry.type==='expense'?'พัฒนาเกม':'รายได้จากเกม',accountId:entry.accountId});}g.updatedAt=updated();}
export function removeGameEntry(s,g,id){g.ledger=g.ledger.filter(e=>e.id!==id);s.transactions=s.transactions.filter(e=>e.gameEntryId!==id);g.updatedAt=updated();}
export function validate(s){
 if(s?.version!==2)throw Error('ไฟล์นี้ต้องเป็นข้อมูลสมุดเงินรุ่น 2');C.validateState({...s,version:1});
 if(s.settings?.monthlyLiving!==undefined&&(!Number.isSafeInteger(s.settings.monthlyLiving)||s.settings.monthlyLiving<0||s.settings.monthlyLiving>999999999999))throw Error("เงินใช้ชีวิตไม่ถูกต้อง");
 const cents=(n)=>{if(!Number.isSafeInteger(n)||n<0||n>999999999999)throw Error('จำนวนเงินในไฟล์ไม่ถูกต้อง');};
 for(const g of s.games){if(g.workHoursByDay!==undefined&&(!Array.isArray(g.workHoursByDay)||g.workHoursByDay.length!==7||g.workHoursByDay.some(h=>!Number.isFinite(h)||h<0||h>24)||!g.workHoursByDay.some(h=>h>0)))throw Error("เวลาทำงานรายวันไม่ถูกต้อง");if(g.workStart&&!validDate(g.workStart))throw Error("วันเริ่มตารางทำงานไม่ถูกต้อง");if(!Array.isArray(g.ledger)||!validDate(g.start)||!validDate(g.release)||!Number.isFinite(g.weeklyHours)||g.weeklyHours<=0||!Number.isFinite(g.bufferDays)||g.bufferDays<0)throw Error('ข้อมูลเกมไม่ครบ');if(!Number.isFinite(g.fee)||g.fee<0||g.fee>100||!Number.isFinite(g.refund)||g.refund<0||g.refund>100)throw Error('อัตราหักของเกมไม่ถูกต้อง');for(const e of g.ledger){cents(e.amount);if(!validDate(e.date)||!['income','expense'].includes(e.type))throw Error('รายการเกมไม่ถูกต้อง');}for(const m of g.milestones)if(!Number.isFinite(m.hours)||m.hours<0||!validDate(m.due))throw Error('แผนงานไม่ถูกต้อง');for(const r of g.snapshots)if(!validDate(r.date)||[r.views,r.wishlists,r.units].some(n=>!Number.isSafeInteger(n)||n<0))throw Error('สถิติไม่ถูกต้อง');if(g.image&&!/^data:image\/(png|jpeg|webp);base64,/.test(g.image))throw Error('รูปปกไม่รองรับ');}
 for(const t of s.transactions)if(t.evidence&&!/^data:image\/(png|jpeg|webp);base64,/.test(t.evidence))throw Error("หลักฐานไม่รองรับ");
 if(s.settings?.recurringIncome!==undefined){if(!Array.isArray(s.settings.recurringIncome)||s.settings.recurringIncome.length>1000)throw Error("รายรับประจำไม่ถูกต้อง");const ids=new Set();for(const i of s.settings.recurringIncome){if(!i||typeof i.id!=="string"||ids.has(i.id)||typeof i.name!=="string"||!Number.isInteger(i.day)||i.day<1||i.day>31||!/^\d{4}-(0[1-9]|1[0-2])$/.test(i.start)||(i.end&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(i.end)))throw Error("รายรับประจำไม่ถูกต้อง");ids.add(i.id);cents(i.amount);}}
 for(const d of s.debts){if(d.closed!==undefined&&typeof d.closed!=="boolean")throw Error("สถานะหนี้ไม่ถูกต้อง");if(d.repaymentTotal!==undefined){cents(d.repaymentTotal);if(d.repaymentTotal<d.principal)throw Error("ยอดคืนรวมต่ำกว่ายอดยืม");}if(d.installments!==undefined)validatePlan(d.installments);if(d.creditLimit!==undefined)cents(d.creditLimit);if(d.started&&!validDate(d.started))throw Error("วันเริ่มหนี้ไม่ถูกต้อง");}
 return s;
}

export function workCalendar(g,now=C.today()){
 const days=g.workHoursByDay||((g.weeklyHours||5)>120?Array(7).fill((g.weeklyHours||5)/7):[0,...Array(5).fill((g.weeklyHours||5)/5),0]),start=[now,g.workStart||now].sort().at(-1),tasks=g.milestones.filter(t=>!t.done).slice().sort((a,b)=>Number(!!b.important)-Number(!!a.important)||a.due.localeCompare(b.due)||a.id.localeCompare(b.id)).map(t=>({...t,minutes:Math.round(t.hours*60)}));
 let index=0,finish=start,count=0;const sessions=[],late=new Set();while(index<tasks.length&&tasks[index].minutes<=0)index++;
 for(let offset=0;index<tasks.length&&offset<36600;offset++){const date=addDays(start,offset),day=new Date(date+'T12:00:00Z').getUTCDay();let capacity=Math.round((days[day]||0)*60),used=0;const entries=[];
 while(capacity>0&&index<tasks.length){const task=tasks[index],take=Math.min(capacity,task.minutes);if(take>0){entries.push({name:task.name,hours:take/60});task.minutes-=take;capacity-=take;used+=take;if(date>task.due)late.add(task.name);}if(task.minutes<=0)index++;}
 if(used){count++;finish=date;if(sessions.length<90)sessions.push({date,hours:used/60,entries});}}
 return {days,start,finish:index===tasks.length?finish:null,count,sessions,late:[...late]};
}
