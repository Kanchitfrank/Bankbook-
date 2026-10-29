import { identity, db, json } from '../../../lib/bankbook-api';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const userId=await identity();if(!userId)return json({error:'sign_in_required'},401);
 const encoder=new TextEncoder();let closed=false;
 const stream=new ReadableStream({
  start(controller){
   controller.enqueue(encoder.encode('retry: 500\n\n'));
   const send=(event:string,data:unknown)=>{if(!closed)controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));};
   request.signal.addEventListener('abort',()=>{closed=true;},{once:true});
   void (async()=>{let revision=-1;const start=Date.now();try{
    while(!closed&&Date.now()-start<25_000){
     const row=await db().prepare('SELECT revision FROM bankbook_documents WHERE user_id = ?').bind(userId).first<{revision:number}>();
     const next=row?.revision||0;if(next!==revision){revision=next;send('revision',{revision});}else send('heartbeat',{revision});
     await new Promise(resolve=>setTimeout(resolve,1200));
    }
   }catch{try{send('unavailable',{});}catch{}}
   finally{if(!closed){closed=true;try{controller.close();}catch{}}}
   })();
  },cancel(){closed=true;}
 });
 return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-store, private','X-Accel-Buffering':'no'}});
}
