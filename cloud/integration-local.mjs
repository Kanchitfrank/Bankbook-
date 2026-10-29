// Run only against the starter's loopback preview with its documented mock auth.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',cookie='__sites_local_auth=1';
const req=(path,options={})=>fetch(base+path,{...options,signal:AbortSignal.timeout(12000)});
assert.equal((await req('/api/state')).status,401);
assert.equal((await req('/api/state',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.test'}})).status,401);
assert.equal((await req('/api/state',{method:'PUT',headers:{Cookie:cookie,Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await req('/api/state',{method:'PUT',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:'{"userId":"different-user"}'})).status,409);
const read=await req('/api/state',{headers:{Cookie:cookie}});assert.equal(read.status,200);const state=await read.json();assert.equal(state.user.id,'local_seedy');
const unchanged=await req('/api/state?revision='+state.revision,{headers:{Cookie:cookie}});assert.equal((await unchanged.json()).unchanged,true);
const stream=await req('/api/events',{headers:{Cookie:cookie}});assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
const reader=stream.body.getReader(),decoder=new TextDecoder();let text='';while(!text.includes('event: revision')){const {value,done}=await reader.read();if(done)break;text+=decoder.decode(value);}await reader.cancel();assert.match(text,/event: revision/);assert.match(text,/retry: 500/);
console.log('PASS: anonymous/forged identity rejected, CSRF rejected, account switch rejected, D1 state and metadata loaded, SSE revision received');
