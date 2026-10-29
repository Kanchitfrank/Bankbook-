export const KEY='kornchit-notebook-v1';
export const categories=['อาหารและเครื่องดื่ม','เดินทาง','ที่พักและสาธารณูปโภค','สุขภาพ','ของใช้ส่วนตัว','พัฒนาเกม','ลงทุน','หนี้สิน','เงินออม','รายได้ประจำ','รายได้จากเกม','รายได้อื่น','อื่น ๆ'];
export const uid=()=>globalThis.crypto.randomUUID();
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function money(v){const s=String(v??'').trim().replace(/,/g,'');if(!/^-?\d+(\.\d{1,2})?$/.test(s))throw Error('ใส่จำนวนเงินเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||Math.abs(n)>999999999999)throw Error('จำนวนเงินเกินขอบเขตที่รองรับ');return n;}
export const fmt=n=>new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100);
export const inputMoney=n=>(n/100).toFixed(2);
export const dateText=d=>d?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(d+'T12:00:00+07:00')):'ยังไม่กำหนด';
export const monthText=d=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(d+'T12:00:00+07:00'));
export const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00+07:00')-Date.parse(a+'T12:00:00+07:00'))/86400000);
export function addMonths(d,n,anchor=Number(d.slice(8,10))){let [y,m]=d.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1+n,1));y=dt.getUTCFullYear();m=dt.getUTCMonth()+1;const day=Math.min(anchor,new Date(Date.UTC(y,m,0)).getUTCDate());return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
export function emptyState(){return {version:1,accounts:[],transactions:[],bills:[],debts:[],goals:[],games:[],holdings:[],profile:{income:0,living:0,reserveMonths:3,risk:'low'},loan:{amount:10000000,apr:12,months:36,ratio:35},updatedAt:null};}
export function balances(s){const b=Object.fromEntries(s.accounts.map(a=>[a.id,a.opening]));for(const t of s.transactions){if(t.type==='transfer'){b[t.accountId]=(b[t.accountId]||0)-t.amount;b[t.toAccountId]=(b[t.toAccountId]||0)+t.amount;}else b[t.accountId]=(b[t.accountId]||0)+(t.type==='income'?t.amount:-t.amount);}return b;}
export function debtScheduledTotal(d){const rows=d.installments||[];return rows.some(r=>r.amount!==null&&r.amount!==undefined)?rows.reduce((n,r)=>n+(r.amount||0),0):(d.repaymentTotal??d.principal);}
export function outstanding(s,d){return Math.max(0,debtScheduledTotal(d)-s.transactions.filter(t=>t.debtId===d.id).reduce((a,t)=>a+(t.amount||0),0));}
export const debtTotal=s=>s.debts.filter(d=>!d.closed).reduce((a,d)=>a+outstanding(s,d),0);
export const totalCash=s=>Object.values(balances(s)).reduce((a,b)=>a+b,0);
export const totalReserved=s=>s.goals.reduce((a,g)=>a+g.saved,0);
export function monthTotals(s,month=today().slice(0,7)){const tx=s.transactions.filter(t=>t.date.startsWith(month)&&t.type!=='transfer');return {income:tx.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0),expense:tx.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0)};}
export function monthlyBill(s){return s.bills.filter(b=>b.active).reduce((a,b)=>a+b.amount/(b.frequency==='yearly'?12:1),0);}
export function monthlyDebt(s){return s.debts.filter(d=>outstanding(s,d)>0).reduce((a,d)=>a+d.payment,0);}
export function nextDue(b){return addMonths(b.due,b.frequency==='yearly'?12:1,b.day||Number(b.due.slice(8,10)));}
export function pmt(amount,apr,months){if(months<=0)return 0;const r=apr/1200;return Math.round(r===0?amount/months:amount*r/(1-Math.pow(1+r,-months)));}
export function payoff(principal,apr,payment,extra=0){let left=principal,totalInterest=0;const pay=payment+extra;for(let m=1;m<=1200;m++){const interest=Math.round(left*apr/1200);if(pay<=interest)return null;totalInterest+=interest;left=left+interest-pay;if(left<=0)return {months:m,interest:totalInterest};}return null;}
export function goalPlan(g,now=today()){const left=Math.max(0,g.target-g.saved),months=Math.max(1,(Number(g.deadline.slice(0,4))-Number(now.slice(0,4)))*12+Number(g.deadline.slice(5,7))-Number(now.slice(5,7)));return {left,months,monthly:Math.ceil(left/months),daily:Math.ceil(left/Math.max(1,days(now,g.deadline))),overdue:days(now,g.deadline)<0};}
export function smsParse(text,now=today()){
 const raw=text.trim();if(!raw)return {error:'วางข้อความจากธนาคารก่อนนะ'};
 if(/(?:OTP|one.?time password|รหัสผ่านครั้งเดียว|รหัสยืนยัน)/i.test(raw))return {error:'ข้อความนี้มีรหัสยืนยัน โปรดใช้เฉพาะข้อความแจ้งรายการเงิน'};
 let type=/เงินเข้า|รับโอน|รับเงิน|ได้รับเงิน|โอนเข้า|ฝากเงิน|credited|received/i.test(raw)?'income':/โอนออก|ถอนเงิน|เงินออก|ชำระ|จ่าย|หักเงิน|ใช้จ่าย|ซื้อสินค้า|debited|payment|paid|withdraw/i.test(raw)?'expense':null;
 if(!type&&/โอนเงิน(?:จำนวน)?\s*[\d,]/.test(raw))type='expense';
 const moneyPat='([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)';
 const r1=new RegExp('(?:จำนวน(?:เงิน)?|ยอด(?:เงิน)?(?:โอน|ชำระ|ใช้จ่าย)?|เงินเข้า|โอนเข้า|โอนออก|รับโอน|ถอนเงิน|หักเงิน|ใช้จ่าย|ชำระ|โอนเงิน)\\s*(?:THB|฿)?\\s*'+moneyPat,'i');
 let cleaned=raw.replace(/(?:คงเหลือ|คงเหลือใช้ได้|balance|available)[^\n]*/ig,'');
 let match=cleaned.match(r1)||cleaned.match(new RegExp(moneyPat+'\\s*(?:บาท|บ\\.|THB)','i'))||cleaned.match(new RegExp('(?:THB|฿)\\s*'+moneyPat,'i'));
 if(!match)return {error:'ยังอ่านจำนวนเงินไม่ได้ กรุณาบันทึกด้วยตนเอง หรือใส่จำนวนเงินตามด้วย บาท'};
 const amount=money(match[1]);if(amount<=0)return {error:'จำนวนเงินต้องมากกว่า 0'};
 let date=now;const dm=raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);if(dm){let y=Number(dm[3]);if(y<100)y+=y>50?2500:2000;if(y>2400)y-=543;const ds=`${y}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;if(!Number.isNaN(Date.parse(ds))&&new Date(ds+'T12:00:00Z').toISOString().slice(0,10)===ds)date=ds;}
 const banks=[['กสิกร|KBank|K PLUS','กสิกรไทย'],['ไทยพาณิชย์|SCB','ไทยพาณิชย์'],['กรุงไทย|KTB|Krungthai','กรุงไทย'],['กรุงเทพ|BBL|Bangkok Bank','กรุงเทพ'],['กรุงศรี|BAY|Krungsri','กรุงศรี'],['ttb|ทหารไทยธนชาต','ttb'],['ออมสิน|GSB','ออมสิน']];
 const bank=banks.find(([r])=>new RegExp(r,'i').test(raw))?.[1]||'';
 const tail=raw.match(/(?:[xX*•]{2,}|บัญชี\s*[^\d\s]*)(\d{3,4})/);
 return {amount,type:type||'expense',uncertain:!type||/โอน.*(?:ตนเอง|ตัวเอง)/.test(raw),date,bank,tail:tail?.[1]||'',note:raw.slice(0,500),fingerprint:raw.replace(/\s+/g,' ').toLowerCase()};
}
export function gameStats(s,g){const tx=s.transactions.filter(t=>t.gameId===g.id);const costs=tx.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);const revenue=tx.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);const snaps=[...(g.snapshots||[])].sort((a,b)=>a.date.localeCompare(b.date));const last=snaps.at(-1);const netUnit=Math.max(0,Math.round(g.price*(1-(g.fee||0)/100)*(1-(g.refund||0)/100)));return {costs,revenue,profit:revenue-costs,last,snaps,netUnit,breakEven:netUnit?Math.ceil(costs/netUnit):0,budgetLeft:g.budget-costs};}
export function gameAdvice(s,g){const st=gameStats(s,g),tips=[];const tasks=g.milestones||[],done=tasks.filter(t=>t.done).length;const remaining=days(today(),g.release);if(g.status==='published'){const neg=(g.reviews||[]).filter(r=>r.sentiment==='negative');if(neg.length)tips.push(`มีรีวิวเชิงลบ ${neg.length} รายการ จัดลำดับปัญหาที่พบซ้ำก่อนเพิ่มฟีเจอร์ใหม่`);if(st.last&&st.last.views>0&&st.last.wishlists/st.last.views<0.05)tips.push('อัตรา Wishlist ต่อการเข้าชมต่ำกว่าเกณฑ์ทดลอง 5% ลองปรับแคปซูล วิดีโอ และคำอธิบาย แล้วเทียบข้อมูลรอบถัดไป');tips.push('ก่อนลดราคา เปรียบเทียบรายรับสุทธิที่ต้องการกับจำนวนชุดที่ต้องขายเพิ่ม และตรวจสิทธิ์ลดราคาใน Steamworks');}else{if(tasks.length&&done<tasks.length)tips.push(`ยังเหลือหมุดหมาย ${tasks.length-done} จาก ${tasks.length} งาน วางเวลาแก้บั๊กและทดสอบก่อนกำหนดขาย`);if(remaining<30)tips.push('กำหนดเปิดขายอยู่ภายใน 30 วันหรือเลยกำหนดแล้ว ตรวจความพร้อมเดโม หน้าร้าน การทดสอบ และงบก่อนยืนยันวัน');if(!st.last)tips.push('เพิ่มสถิติผู้เข้าชมและ Wishlist เพื่อเทียบความสนใจรายสัปดาห์');tips.push('เดือนที่ตั้งไว้เป็นแผนของคุณ ยังสรุปเดือนขายที่ดีที่สุดไม่ได้หากไม่มีข้อมูลกลุ่มผู้เล่นและตารางกิจกรรมจริง');}if(st.costs>g.budget)tips.push(`ต้นทุนเกินงบ ${fmt(st.costs-g.budget)} บาท ทบทวนขอบเขตงานและค่าใช้จ่ายก่อนเพิ่มงบ`);const negGroups={};for(const r of g.reviews||[])if(r.sentiment==='negative')negGroups[r.topic]=(negGroups[r.topic]||0)+1;for(const [topic,n] of Object.entries(negGroups).sort((a,b)=>b[1]-a[1]).slice(0,2))tips.push(`ประเด็น ${topic} พบ ${n} รีวิว ควรตรวจและตอบกลับพร้อมแผนแก้ไข`);return tips;}
export function validateState(s){
 if(!s||s.version!==1)throw Error('รูปแบบไฟล์สำรองไม่รองรับ');
 const arr=['accounts','transactions','bills','debts','goals','games','holdings'];for(const k of arr)if(!Array.isArray(s[k])||s[k].length>50000)throw Error('ข้อมูลสำรองไม่ถูกต้อง');
 const cents=(v,negative=false)=>{if(!Number.isSafeInteger(v)||Math.abs(v)>999999999999||(!negative&&v<0))throw Error('จำนวนเงินในไฟล์ไม่ถูกต้อง');};
 for(const k of arr){const ids=new Set();for(const o of s[k]){if(!o||typeof o.id!=='string'||ids.has(o.id))throw Error('รหัสรายการซ้ำหรือไม่ถูกต้อง');ids.add(o.id);}}
 for(const a of s.accounts){cents(a.opening,true);if(typeof a.name!=='string')throw Error('ชื่อบัญชีไม่ถูกต้อง');}
 const ids=new Set(s.accounts.map(a=>a.id));for(const t of s.transactions){cents(t.amount);if(!['income','expense','transfer'].includes(t.type)||!ids.has(t.accountId)||(t.type==='transfer'&&(!ids.has(t.toAccountId)||t.toAccountId===t.accountId))||!/^\d{4}-\d{2}-\d{2}$/.test(t.date))throw Error('รายการเงินไม่ถูกต้อง');if(t.principal!==undefined)cents(t.principal);}
 for(const b of s.bills){cents(b.amount);if(!/^\d{4}-\d{2}-\d{2}$/.test(b.due)||!['monthly','yearly'].includes(b.frequency))throw Error('กำหนดบิลไม่ถูกต้อง');}
 for(const d of s.debts){cents(d.principal);cents(d.payment);if(!Number.isFinite(d.apr)||d.apr<0||d.apr>100)throw Error('ดอกเบี้ยไม่ถูกต้อง');}
 for(const g of s.goals){cents(g.target);cents(g.saved);if(!g.deadline)throw Error('เป้าหมายไม่มีวันที่');}
 for(const g of s.games){cents(g.budget);cents(g.price);if(!Array.isArray(g.snapshots)||!Array.isArray(g.milestones)||!Array.isArray(g.reviews))throw Error('ข้อมูลเกมไม่ครบ');}
 for(const h of s.holdings){cents(h.cost);cents(h.value);}
 if(!s.profile||!s.loan)throw Error('การตั้งค่าไม่ครบ');cents(s.profile.income);cents(s.profile.living);return s;
}
