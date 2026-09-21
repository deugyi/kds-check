const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('PostgreSQL RLS, Google identity, owner bootstrap, roles, validation, optimistic locking and audit',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.identities(user_id uuid,provider text,identity_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'seoripul.sql'),'utf8'));
 const ids=[1,2,3,4,5].map(n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0')),drawing='a'.repeat(64);
 for(let n=0;n<ids.length;n++){
  await db.query('insert into auth.users values($1,$2,now())',[ids[n],n===0?'owner@example.test':`user${n}@example.test`]);
  if(n<4)await db.query("insert into auth.identities values($1,'google',$2)",[ids[n],JSON.stringify({email:n===0?'owner@example.test':`user${n}@example.test`,email_verified:n!==3})]);
 }
 await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");
 await db.query('insert into public.site_drawings values($1,$2)',[drawing,JSON.stringify({id:drawing,drawing:{piles:[{key:'abc'}]}})]);
 async function asUser(i){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[i==null?'':ids[i]]);await db.exec('set role '+(i==null?'anon':'authenticated'));}
 const register=()=>db.query('select * from public.site_register()');
 const save=(version=0,key='abc',memo='record',dates=[null,null,null])=>db.query('select * from public.site_save_prd($1,$2,$3,$4,$5,$6,$7)',[drawing,key,version,...dates,memo]);
 await asUser(null);await assert.rejects(()=>db.query('select * from public.site_drawings'),/permission denied/);await assert.rejects(register,/permission denied/);
 for(const i of [3,4]){await asUser(i);await assert.rejects(register,/GOOGLE_VERIFICATION_REQUIRED/);}
 await asUser(1);assert.equal((await register()).rows[0].role,'pending');assert.equal((await db.query('select * from public.site_drawings')).rows.length,0);await assert.rejects(save,/EDIT_ACCESS_REQUIRED/);
 await assert.rejects(()=>db.query("update public.site_members set role='admin'"),/permission denied/);
 await assert.rejects(()=>db.query("select public.site_set_role($1,'admin')",[ids[1]]),/ADMIN_REQUIRED/);
 await asUser(0);assert.equal((await register()).rows[0].role,'admin');assert.equal((await register()).rows[0].role,'admin');
 await assert.rejects(()=>db.query("select public.site_set_role($1,'blocked')",[ids[0]]),/OWNER_ROLE_PROTECTED/);
 await assert.rejects(()=>db.query("select public.site_set_role($1,'admin')",[ids[1]]),/INVALID_ROLE/);
 await db.query("select public.site_set_role($1,'viewer')",[ids[1]]);
 await asUser(1);assert.equal((await db.query('select * from public.site_drawings')).rows.length,1);assert.equal((await db.query('select * from public.site_members')).rows.length,1);await assert.rejects(save,/EDIT_ACCESS_REQUIRED/);
 await asUser(0);await db.query("select public.site_set_role($1,'editor')",[ids[1]]);
 await asUser(1);assert.equal((await save()).rows[0].version,1);await assert.rejects(save,/RECORD_CONFLICT/);assert.equal((await save(1)).rows[0].version,2);
 await assert.rejects(()=>save(0,'unknown'),/UNKNOWN_PILE/);await assert.rejects(()=>save(2,'abc','x'.repeat(2001)),/INVALID_RECORD/);
 await assert.rejects(()=>save(2,'abc','bad dates',['2026-09-22',null,'2026-09-21']),/check constraint/);
 await assert.rejects(()=>db.query("insert into public.site_prd_records(drawing_id,pile_key,note,updated_by) values($1,'abc','bypass',$2)",[drawing,ids[1]]),/permission denied/);
 await assert.rejects(()=>db.query('select * from seoripul_private.settings'),/permission denied/);
 await asUser(0);await db.query("select public.site_set_role($1,'blocked')",[ids[1]]);
 await asUser(1);assert.equal((await db.query('select * from public.site_drawings')).rows.length,0);assert.equal((await db.query('select * from public.site_prd_records')).rows.length,0);await assert.rejects(()=>save(2),/EDIT_ACCESS_REQUIRED/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from seoripul_private.record_audit')).rows[0].n,2);
 }finally{await db.close();}
});
