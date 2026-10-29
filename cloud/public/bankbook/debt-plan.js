import {addMonths} from './core.js';
export function buildPlan(existing,count,start){
 if(!Number.isInteger(count)||count<1||count>600||!/^\d{4}-(0[1-9]|1[0-2])$/.test(start))throw Error('ใส่จำนวนเดือน 1–600 และเดือนเริ่มต้นให้ถูกต้อง');
 const plan=Array.from({length:count},(_,i)=>{const month=addMonths(start+'-01',i).slice(0,7),old=(existing||[]).find(r=>r.month===month);return old?{...old}:{id:month,month,amount:null};});
 if((existing||[]).some(r=>r.amount!==null&&!plan.some(p=>p.month===r.month)))throw Error('ช่วงใหม่จะตัดงวดที่กรอกยอดไว้แล้ว กรุณาล้างยอดงวดนั้นก่อนปรับช่วง');
 return plan;
}
export function plannedThisMonth(debt,month){return debt.installments?.find(r=>r.month===month)?.amount??null;}
export function validatePlan(rows){if(!Array.isArray(rows)||rows.length>600)throw Error('ตารางผ่อนไม่ถูกต้อง');const months=new Set();for(const r of rows){if(!r||typeof r.id!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)||months.has(r.month)||!(r.amount===null||(Number.isSafeInteger(r.amount)&&r.amount>=0&&r.amount<=999999999999)))throw Error('ยอดหรือเดือนในตารางผ่อนไม่ถูกต้อง');months.add(r.month);}}
