const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('composite steel writes are atomic, approved-only and preserve reinforcement for legacy clients',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','site-member-visibility.sql','site-trades-approved.sql','site-slab-records.sql','site-slab-openings.sql','site-steel-completion.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002',drawing='b'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[viewer,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({id:drawing,drawing:{members:[{key:'beam'},{key:'legacy'}],slabs:[{key:'panel'}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const save=(version=0,reinforcing='CT300 · SM355',item='beam')=>db.query('select * from site_save_steel_components($1,$2,$3,$4,$5,null,null,$6,true,$7)',[drawing,item,version,'B2SG61','H808 · SM355','lower inverted T',reinforcing]);
  await login(owner);await db.query("select site_save_trade($1,'steel','legacy',0,'legacy','H400',null,'2026-10-01','original')",[drawing]);
  await db.exec('reset role');const before=(await db.query("select * from site_trade_records where item_key='legacy'")).rows[0];
  await db.exec(fs.readFileSync(path.join(__dirname,'site-steel-components.sql'),'utf8'));
  const migrated=(await db.query("select * from site_trade_records where item_key='legacy'")).rows[0];assert.deepEqual(migrated,{...before,reinforcement_spec:''});
  await login(null);await assert.rejects(save,/permission denied/);await login(viewer);await assert.rejects(save,/ACCESS_REQUIRED/);
  await login(owner);await db.query("select site_set_role($1,'viewer')",[viewer]);await login(viewer);
  const first=(await save()).rows[0];assert.equal(first.spec,'H808 · SM355');assert.equal(first.reinforcement_spec,'CT300 · SM355');assert.equal(first.version,1);assert.equal(first.installation_complete,true);assert.equal(first.completed,null);
  await assert.rejects(save,/RECORD_CONFLICT/);await assert.rejects(()=>save(1,null),/INVALID_RECORD/);await assert.rejects(()=>save(1,'x'.repeat(121)),/INVALID_RECORD/);await assert.rejects(()=>save(0,'CT','unknown'),/UNKNOWN_MEMBER/);
  const legacy=(await db.query("select * from site_save_steel_record($1,'beam',1,'B2SG61','H revised',null,null,'legacy memo',true)",[drawing])).rows[0];assert.equal(legacy.spec,'H revised');assert.equal(legacy.reinforcement_spec,'CT300 · SM355');assert.equal(legacy.version,2);
  const older=(await db.query("select * from site_save_trade($1,'steel','beam',2,'B2SG61','H revised again',null,null,'old API')",[drawing])).rows[0];assert.equal(older.reinforcement_spec,'CT300 · SM355');assert.equal(older.installation_complete,true);assert.equal(older.version,3);
  const clear=(await save(3,'')).rows[0];assert.equal(clear.reinforcement_spec,'');assert.equal(clear.spec,'H808 · SM355');assert.equal(clear.version,4);
  const slab=(await db.query("select * from site_save_slab_record($1,'panel',0,'area','','deck',null,null,null,'slab note')",[drawing])).rows[0];assert.equal(slab.reinforcement_spec,'');
  await assert.rejects(()=>db.query("select seoripul_private.save_trade_components($1,'slab','panel',1,'area','',null,null,'',false,'CT')",[drawing]),/INVALID_RECORD/);
  await assert.rejects(()=>db.query("update site_trade_records set reinforcement_spec='CT'"),/permission denied/);await assert.rejects(()=>db.query('select * from seoripul_private.trade_record_audit'),/permission denied/);
  await login(owner);await db.query("select site_set_role($1,'blocked')",[viewer]);await login(viewer);await assert.rejects(()=>save(4),/ACCESS_REQUIRED/);
  await db.exec('reset role');const audit=(await db.query("select before_value,after_value from seoripul_private.trade_record_audit where item_key='beam' order by id")).rows;
  assert.equal(audit.length,4);assert.equal(audit[0].before_value,null);assert.equal(audit[0].after_value.spec,'H808 · SM355');assert.equal(audit[0].after_value.reinforcement_spec,'CT300 · SM355');assert.equal(audit[1].before_value.reinforcement_spec,audit[1].after_value.reinforcement_spec);assert.equal(audit[3].after_value.reinforcement_spec,'');
  const perms=(await db.query("select has_function_privilege('anon','public.site_save_steel_components(text,text,integer,text,text,date,date,text,boolean,text)','execute') anon,has_function_privilege('authenticated','public.site_save_steel_components(text,text,integer,text,text,date,date,text,boolean,text)','execute') approved,(select prosecdef from pg_proc where oid='public.site_save_steel_components(text,text,integer,text,text,date,date,text,boolean,text)'::regprocedure) definer")).rows[0];assert.deepEqual(perms,{anon:false,approved:true,definer:false});
 }finally{await db.close();}
});
