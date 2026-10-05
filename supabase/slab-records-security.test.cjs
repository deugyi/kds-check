const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('slab stages preserve existing data and enforce approval, dates, versioning and audit access',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','site-trades-approved.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002',drawing='b'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[viewer,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");
  await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({drawing:{members:[{key:'beam'}],slabs:[{key:'panel'},{key:'legacy'}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  await login(owner);
  await db.query("select site_save_trade($1,'slab','legacy',0,'old','150 mm',null,'2026-10-02','keep')",[drawing]);
  await db.exec('reset role');await db.exec(fs.readFileSync(path.join(__dirname,'site-slab-records.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'site-slab-openings.sql'),'utf8'));
  const old=(await db.query("select * from site_trade_records where item_key='legacy'")).rows[0];
  assert.equal(old.label,'old');assert.equal(old.version,1);assert.equal(old.slab_kind,'');assert.equal(old.decked,null);assert.ok(old.completed);
  const save=(item='panel',version=0,kind='deck',deck='2026-09-29',rebar='2026-10-01',cast='2026-10-02')=>db.query('select * from site_save_slab_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[drawing,item,version,'TEST','150 mm',kind,deck,rebar,cast,'memo']);
  await login(null);await assert.rejects(save,/permission denied/);
  await login(viewer);await assert.rejects(save,/ACCESS_REQUIRED/);
  await login(owner);await db.query("select site_set_role($1,'viewer')",[viewer]);await login(viewer);
  const row=(await save()).rows[0];assert.equal(row.slab_kind,'deck');assert.equal(row.version,1);assert.ok(row.decked&&row.reinforced&&row.completed);
  await assert.rejects(()=>save('panel',0),/RECORD_CONFLICT/);await assert.rejects(()=>save('panel',1,'wrong'),/INVALID_RECORD/);
  await assert.rejects(()=>save('beam'),/UNKNOWN_MEMBER/);await assert.rejects(()=>save('missing'),/UNKNOWN_MEMBER/);
  await assert.rejects(()=>save('panel',1,'deck','2026-10-02','2026-10-01'),/slab_dates_order/);
  await assert.rejects(()=>save('panel',1,'deck','2026-09-29','2026-10-03'),/slab_dates_order/);
  await assert.rejects(()=>save('panel',1,'deck','2026-02-30'),/date\/time field/);
  await assert.rejects(()=>save('panel',1,'deck','10000-01-01',null,null),/slab_dates_range/);
  await save('panel',1,'conventional',null,'2026-10-01','2026-10-02');
  await save('panel',2,'temporary',null,null,null);
  await db.query("select site_save_trade($1,'slab','panel',3,'legacy-client','spec',null,'2026-10-03','note')",[drawing]);
  assert.equal((await db.query("select slab_kind from site_trade_records where item_key='panel'")).rows[0].slab_kind,'temporary');const opening=(await save('panel',4,'opening',null,null,'2026-10-03')).rows[0];assert.equal(opening.slab_kind,'opening');assert.equal(opening.version,5);assert.ok(opening.completed);const reset=(await db.query("select * from site_save_slab_record($1,'panel',5,'','','opening',null,null,null,'')",[drawing])).rows[0];assert.equal(reset.version,6);assert.equal(reset.slab_kind,'opening');for(const field of ['label','spec','note'])assert.equal(reset[field],'');for(const field of ['completed','decked','reinforced'])assert.equal(reset[field],null);await assert.rejects(()=>save('panel',5),/RECORD_CONFLICT/);
  const steel=(await db.query("select * from site_save_trade($1,'steel','beam',0,'beam','H',null,'2026-10-02','')",[drawing])).rows[0];
  assert.equal(steel.slab_kind,'');assert.equal(steel.decked,null);assert.equal(steel.reinforced,null);
  await assert.rejects(()=>db.query("update site_trade_records set version=100"),/permission denied/);
  await assert.rejects(()=>db.query('select * from seoripul_private.trade_record_audit'),/permission denied/);
  await login(owner);await db.query("select site_set_role($1,'blocked')",[viewer]);await login(viewer);
  await assert.rejects(()=>save('panel',4),/ACCESS_REQUIRED/);assert.equal((await db.query('select * from site_trade_records')).rows.length,0);
  await db.exec('reset role');const audit=(await db.query('select count(*)::int n from seoripul_private.trade_record_audit')).rows[0];assert.equal(audit.n,8);
 }finally{await db.close();}
});
