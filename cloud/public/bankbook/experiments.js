export function investment({capital,monthly,annual,months,fee=0,stress=10}){
 const run=rate=>{let value=capital-fee,paid=capital,first=null;const rows=[];for(let m=1;m<=months;m++){value=Math.round(value*(1+rate/1200))+monthly;paid+=monthly;const profit=value-paid;if(first===null&&profit>0)first=m;rows.push({month:m,value,paid,profit});}return {value,paid,profit:value-paid,first,rows};};
 return {base:run(annual),down:run(annual-stress),up:run(annual+stress)};
}
export function borrowing({principal,apr,payment,months,earnings=0,fee=0}){
 let left=principal,interestTotal=0,paid=0,profit=-fee,first=null,finished=null;const rows=[];
 for(let m=1;m<=months;m++){const interest=Math.round(left*apr/1200);const actual=Math.min(payment,left+interest);left=Math.max(0,left+interest-actual);interestTotal+=interest;paid+=actual;profit+=earnings-interest;if(first===null&&profit>0)first=m;if(finished===null&&left===0)finished=m;rows.push({month:m,left,interest,paid:actual,profit,cash:earnings-actual});}
 return {left,interest:interestTotal,paid,profit,first,finished,rows,notReducing:principal>0&&payment<=Math.round(principal*apr/1200)};
}
export function periodRows(rows,mode,value){return rows.filter(r=>mode==='all'||r.date.startsWith(value));}
export function elapsedMonths(start,end){if(!start)return null;const [sy,sm,sd]=start.split('-').map(Number),[ey,em,ed]=end.split('-').map(Number);return Math.max(0,(ey-sy)*12+em-sm-(ed<sd?1:0));}
