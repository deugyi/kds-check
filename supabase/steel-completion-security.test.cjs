const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('steel completion without dates is approved-only, versioned, audited and compatible with older clients',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','site-member-visibility.sql','site-trades-approved.sql','site-slab-records.sql','site-slab-openings.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',drawing='b'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[other,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({id:drawing,drawing:{members:[{key:'beam'},{key:'legacy'}],slabs:[{key:'panel'}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const save=(version=0,done=true,date=null,item='beam')=>db.query('select * from site_save_steel_record($1,$2,$3,$4,$5,null,$6,$7,$8)',[drawing,item,version,'shop number','',date,'keep memo',done]);
  await login(owner);await db.query("select site_save_trade($1,'steel','legacy',0,'legacy','H',null,'2026-10-01','original')",[drawing]);
  await db.exec('reset role');await db.exec(fs.readFileSync(path.join(__dirname,'site-steel-completion.sql'),'utf8'));
  const legacy=(await db.query("select * from site_trade_records where item_key='legacy'")).rows[0];assert.equal(legacy.installation_complete,false);assert.equal(legacy.note,'original');assert.equal(legacy.spec,'H');assert.equal(legacy.version,1);assert.ok(legacy.completed);
  await login(null);await assert.rejects(save,/permission denied/);
  await login(other);await assert.rejects(save,/ACCESS_REQUIRED/);
  await login(owner);await db.query("select site_set_role($1,'viewer')",[other]);await login(other);
  const row=(await save()).rows[0];assert.equal(row.installation_complete,true);assert.equal(row.completed,null);assert.equal(row.spec,'');assert.equal(row.note,'keep memo');assert.equal(row.version,1);
  await assert.rejects(save,/RECORD_CONFLICT/);await assert.rejects(()=>save(0,true,null,'unknown'),/UNKNOWN_MEMBER/);await assert.rejects(()=>save(1,null),/INVALID_RECORD/);
  const old=(await db.query("select * from site_save_trade($1,'steel','beam',1,'updated number','',null,null,'updated memo')",[drawing])).rows[0];assert.equal(old.installation_complete,true);assert.equal(old.completed,null);assert.equal(old.version,2);
  assert.equal((await save(2,false)).rows[0].installation_complete,false);
  assert.equal((await save(3,false,'2026-10-02')).rows[0].installation_complete,true);
  const slab=(await db.query("select * from site_save_slab_record($1,'panel',0,'area','','deck',null,null,null,'slab note')",[drawing])).rows[0];assert.equal(slab.installation_complete,false);assert.equal(slab.completed,null);assert.equal(slab.slab_kind,'deck');
  await assert.rejects(()=>db.query('update site_trade_records set installation_complete=false'),/permission denied/);
  await assert.rejects(()=>db.query('select * from seoripul_private.trade_record_audit'),/permission denied/);
  await login(owner);await db.query("select site_set_role($1,'blocked')",[other]);await login(other);await assert.rejects(()=>save(4),/ACCESS_REQUIRED/);
  await db.exec('reset role');const audit=(await db.query("select before_value,after_value from seoripul_private.trade_record_audit where item_key='beam' order by id")).rows;
  assert.equal(audit.length,4);assert.equal(audit[0].before_value,null);assert.equal(audit[0].after_value.installation_complete,true);assert.equal(audit[0].after_value.completed,null);
  assert.equal(audit[1].before_value.installation_complete,true);assert.equal(audit[1].after_value.installation_complete,true);assert.equal(audit[2].after_value.installation_complete,false);
  const grants=(await db.query("select has_function_privilege('anon','public.site_save_steel_record(text,text,integer,text,text,date,date,text,boolean)','execute') anon,has_function_privilege('authenticated','public.site_save_steel_record(text,text,integer,text,text,date,date,text,boolean)','execute') approved")).rows[0];assert.equal(grants.anon,false);assert.equal(grants.approved,true);
 }finally{await db.close();}
});
