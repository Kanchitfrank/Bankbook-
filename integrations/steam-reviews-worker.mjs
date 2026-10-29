// Optional Cloudflare Worker. Configure ALLOWED_ORIGIN and API_TOKEN as secrets/settings.
// This module is NOT part of the static GitHub Pages application.
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(!env.ALLOWED_ORIGIN||origin!==env.ALLOWED_ORIGIN)return new Response('Origin not allowed',{status:403});
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
  if(request.method==='OPTIONS')return new Response(null,{headers});
  if(!env.API_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.API_TOKEN)return new Response('Unauthorized',{status:401,headers});
  const url=new URL(request.url),appid=url.searchParams.get('appid');
  if(request.method!=='GET'||url.pathname!=='/reviews'||!/^\d{1,12}$/.test(appid||''))return new Response('Invalid request',{status:400,headers});
  try{
   const upstream=await fetch('https://store.steampowered.com/appreviews/'+appid+'?json=1&language=all&filter=recent&num_per_page=100&purchase_type=all',{signal:AbortSignal.timeout(15000)});
   if(!upstream.ok)throw Error('upstream');
   const data=await upstream.json();
   if(data.success!==1||!Array.isArray(data.reviews))throw Error('format');
   return Response.json({reviews:data.reviews,query_summary:data.query_summary},{headers});
  }catch{return new Response('Steam request failed',{status:502,headers});}
 }
};
