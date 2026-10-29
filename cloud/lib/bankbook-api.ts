import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { validate } from '../public/bankbook/model.js';
import { chunksFor } from './document-chunks.mjs';
const headers = { 'Cache-Control':'no-store, private', 'Vary':'Cookie', 'X-Content-Type-Options':'nosniff' };
export const json = (data:unknown,status=200)=>Response.json(data,{status,headers});
export async function identity(){const user=await getChatGPTUser();return user?.userId||null;}
export function db(){if(!env.DB)throw Error('Database unavailable');return env.DB;}
export async function read(userId:string){
 const results=await db().batch([db().prepare('SELECT revision, document, updated_at, last_mutation FROM bankbook_documents WHERE user_id = ?').bind(userId),db().prepare('SELECT content FROM bankbook_document_chunks WHERE user_id = ? AND mutation_id = (SELECT last_mutation FROM bankbook_documents WHERE user_id = ?) ORDER BY part').bind(userId,userId)]);
 const row=results[0].results?.[0] as {revision:number,document:string,updated_at:string,last_mutation:string}|undefined;
 if(!row)return {revision:0,document:null,updatedAt:null,mutationId:null};
 const parts=results[1].results as {content:string}[];
 return {revision:row.revision,document:JSON.parse(row.document||parts.map(p=>p.content).join('')),updatedAt:row.updated_at,mutationId:row.last_mutation};
}
export async function getState(request?:Request){const user=await getChatGPTUser();if(!user)return json({error:'sign_in_required'},401);try{const known=request?new URL(request.url).searchParams.get('revision'):null;const identity={id:user.userId,displayName:user.displayName};if(known!==null){const row=await db().prepare('SELECT revision, updated_at FROM bankbook_documents WHERE user_id = ?').bind(user.userId).first<{revision:number,updated_at:string}>();if(Number(known)===(row?.revision||0))return json({revision:row?.revision||0,updatedAt:row?.updated_at||null,unchanged:true,user:identity});}return json({...await read(user.userId),user:identity});}catch{return json({error:'database_unavailable'},503);}}
export async function putState(request:Request){
 const userId=await identity();if(!userId)return json({error:'sign_in_required'},401);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'origin_not_allowed'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'json_required'},415);
 if(Number(request.headers.get('Content-Length')||0)>6_000_000)return json({error:'document_too_large'},413);
 let body;try{const raw=await request.text();if(new TextEncoder().encode(raw).length>6_000_000)return json({error:'document_too_large'},413);body=JSON.parse(raw);}catch{return json({error:'invalid_json'},400);}
 if(!body||typeof body!=='object')return json({error:'invalid_document'},400);
 const {revision,mutationId,document}=body;
 if(body.userId!==userId)return json({error:'account_changed'},409);
 if(!Number.isSafeInteger(revision)||revision<0||typeof mutationId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(mutationId))return json({error:'invalid_revision'},400);
 try{validate(document);}catch{return json({error:'invalid_document'},400);}
 try{
  const current=await read(userId);if(current.mutationId===mutationId)return json(current);
  if(current.revision!==revision)return json({error:'revision_conflict',...current},409);
  const next=revision+1,now=new Date().toISOString();
  const parts=chunksFor(document);
  const operations=parts.map((content,part)=>db().prepare('INSERT OR REPLACE INTO bankbook_document_chunks (user_id,mutation_id,part,content) VALUES (?,?,?,?)').bind(userId,mutationId,part,content));
  operations.push(db().prepare(`INSERT INTO bankbook_documents (user_id, revision, document, updated_at, last_mutation) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision, document=excluded.document, updated_at=excluded.updated_at, last_mutation=excluded.last_mutation WHERE bankbook_documents.revision = ? RETURNING revision`).bind(userId,next,'',now,mutationId,revision));
  const results=await db().batch(operations);
  if(!results.at(-1)?.results?.length){await db().prepare('DELETE FROM bankbook_document_chunks WHERE user_id = ? AND mutation_id = ? AND mutation_id <> (SELECT last_mutation FROM bankbook_documents WHERE user_id = ?)').bind(userId,mutationId,userId).run();return json({error:'revision_conflict',...await read(userId)},409);}
  await db().prepare('DELETE FROM bankbook_document_chunks WHERE user_id = ? AND mutation_id <> ? AND mutation_id <> ? AND mutation_id <> (SELECT last_mutation FROM bankbook_documents WHERE user_id = ?)').bind(userId,mutationId,current.mutationId||'',userId).run();
  return json({revision:next,document,updatedAt:now,mutationId});
 }catch{return json({error:'save_failed'},503);}
}
