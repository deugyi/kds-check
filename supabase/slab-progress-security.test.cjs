const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('date-free reinforcement enforces roles, versioning, hidden-region access and accurate audit records',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','site-trades-approved.sql','site-slab-records.sql','site-slab-openings.sql','site-slab-regions.sql','site-slab-partition.sql','site-slab-progress.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002',drawing='b'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[viewer,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");
  const geometry={points:[[1000,1000],[3000,1000],[3000,3000],[1000,3000]],holes:[]};
  await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({drawing:{members:[{key:'beam'}],zones:[{id:'A1',points:[[0,0],[10000,0],[10000,10000],[0,10000]]}],slabs:[{key:'panel',...geometry}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const save=(version=0,flag=true,cast=null,item='panel')=>db.query('select * from site_save_slab_progress($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[drawing,item,version,'DS13','200 mm','deck',null,null,cast,'keep',flag]);
  await login(null);await assert.rejects(save,/permission denied/);await login(viewer);await assert.rejects(save,/ACCESS_REQUIRED/);
  await login(owner);await db.query("select site_set_role($1,'viewer')",[viewer]);await login(viewer);
  const row=(await save()).rows[0];assert.equal(row.reinforcement_in_progress,true);assert.equal(row.version,1);for(const key of ['decked','reinforced','completed'])assert.equal(row[key],null);
  await assert.rejects(()=>save(0),/RECORD_CONFLICT/);await assert.rejects(()=>save(1,null),/INVALID_RECORD/);await assert.rejects(()=>save(0,true,null,'beam'),/UNKNOWN_MEMBER/);
  const legacy=(await db.query("select * from site_save_slab_record($1,'panel',1,'DS13','200 mm','deck',null,null,null,'legacy edit')",[drawing])).rows[0];assert.equal(legacy.reinforcement_in_progress,true);
  const done=(await save(2,true,'2026-10-07')).rows[0];assert.equal(done.reinforcement_in_progress,false);assert.ok(done.completed);
  await db.query('select * from site_save_slab_region($1,$2,$3,$4,$5)',[drawing,'panel',0,JSON.stringify(geometry),true]);await assert.rejects(()=>save(3),/UNKNOWN_MEMBER/);
  await assert.rejects(()=>db.query('update site_trade_records set reinforcement_in_progress=false'),/permission denied/);
  await assert.rejects(()=>db.query('select * from seoripul_private.trade_record_audit'),/permission denied/);
  await login(owner);await db.query("select site_set_role($1,'blocked')",[viewer]);await login(viewer);await assert.rejects(()=>save(3),/ACCESS_REQUIRED/);
  await db.exec('reset role');const audit=(await db.query('select after_value from seoripul_private.trade_record_audit order by id')).rows;assert.equal(audit.length,3);assert.equal(audit[0].after_value.reinforcement_in_progress,true);assert.equal(audit[2].after_value.reinforcement_in_progress,false);
 }finally{await db.close();}
});
