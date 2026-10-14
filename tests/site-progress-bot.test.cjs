const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
test('retired integration refuses intake, setup, cron and cleanup without database or network access',async()=>{
 let requests=0;const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/site-process-bot/index.ts','utf8').replace('export function handler','function handler'))+'\nglobalThis.handler=handler';
 const ctx=vm.createContext({Request,Response,Deno:{serve(){},env:{get(){throw Error('credentials must never be accessed');}}},fetch(){requests++;throw Error('network must never be called');}});vm.runInContext(source,ctx);
 for(const body of [{update_id:123,message:{text:'2026-10-14\n작업 없음'}},{action:'configure',token:'unused'},{action:'dispatch'},{action:'retire'}]){
  const r=await ctx.handler(new Request('https://test.invalid',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'old','X-Site-Progress-Cron':'old'},body:JSON.stringify(body)}));assert.equal(r.status,410);assert.equal((await r.json()).error,'INTEGRATION_REMOVED');
 }
 assert.equal(requests,0);
});
