const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('approved users edit versioned slab boundaries; invalid shapes, stale edits and unauthorized access are rejected',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','site-trades-approved.sql','site-slab-records.sql','site-slab-openings.sql','site-slab-regions.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002',drawing='b'.repeat(64),other='c'.repeat(64),key='USER-SLAB-00000000-0000-4000-8000-000000000001';
  for(const [id,email] of [[owner,'owner@example.test'],[viewer,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");
  const geometry={points:[[1000,1000],[3000,1000],[3000,3000],[1000,3000]],holes:[]};
  for(const id of [drawing,other])await db.query('insert into site_drawings values($1,$2)',[id,JSON.stringify({drawing:{members:[{key:'beam'}],zones:[{id:'A1',points:[[0,0],[10000,0],[10000,10000],[0,10000]]}],slabs:[{key:'panel',...geometry}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const save=(item='panel',version=0,g=geometry,hide=false,id=drawing)=>db.query('select * from site_save_slab_region($1,$2,$3,$4,$5)',[id,item,version,JSON.stringify(g),hide]);
  const record=(item,version=0)=>db.query("select * from site_save_slab_record($1,$2,$3,'saved','150','deck',null,null,'2026-10-06','keep')",[drawing,item,version]);
  await login(null);await assert.rejects(save,/permission denied/);await assert.rejects(()=>db.query('select * from site_slab_regions'),/permission denied/);
  await login(viewer);await assert.rejects(save,/ACCESS_REQUIRED/);
  await login(owner);await db.query("select site_set_role($1,'viewer')",[viewer]);await login(viewer);
  await record('panel');const first=(await save()).rows[0];assert.equal(first.version,1);assert.equal((await db.query('select * from site_slab_regions')).rows.length,1);
  await assert.rejects(()=>save('panel',0),/REGION_CONFLICT/);await assert.rejects(()=>save('beam'),/UNKNOWN_MEMBER/);await assert.rejects(()=>save('missing'),/UNKNOWN_MEMBER/);
  await assert.rejects(()=>save('panel',1,{points:[[0,0],[3000,3000],[0,3000],[3000,0]],holes:[]}),/INVALID_GEOMETRY/);
  await assert.rejects(()=>save('panel',1,{points:[[0,0],[0,0],[3000,3000]],holes:[]}),/INVALID_GEOMETRY/);
  await assert.rejects(()=>save('panel',1,{points:[[0,0],["bad",0],[3000,3000]],holes:[]}),/INVALID_GEOMETRY/);
  await assert.rejects(()=>save('panel',1,{...geometry,holes:[[[4000,4000],[5000,4000],[5000,5000],[4000,5000]]]}),/INVALID_GEOMETRY/);
  await assert.rejects(()=>save('panel',1,{points:[[-100,0],[1000,0],[1000,1000]],holes:[]}),/OUTSIDE_DRAWING/);
  await save(key);await record(key);assert.equal((await db.query("select * from site_trade_records where item_key=$1",[key])).rows[0].label,'saved');
  await save(key,1,geometry,true);await assert.rejects(()=>record(key,1),/UNKNOWN_MEMBER/);
  await save(key,2,geometry,false);assert.equal((await db.query("select * from site_trade_records where item_key=$1",[key])).rows[0].note,'keep');await record(key,1);
  await save('panel',1,{...geometry,points:[[1000,1000],[5000,1000],[5000,3000],[1000,3000]]});
  const kept=(await db.query("select * from site_trade_records where item_key='panel'")).rows[0];assert.equal(kept.version,1);assert.equal(kept.label,'saved');
  await save(key,0,geometry,false,other);await assert.rejects(()=>save(key,3,geometry,false,other),/REGION_CONFLICT/);
  await assert.rejects(()=>db.query('update site_slab_regions set hidden=true'),/permission denied/);
  await assert.rejects(()=>db.query('select * from seoripul_private.slab_region_audit'),/permission denied/);
  await assert.rejects(()=>db.query("select seoripul_private.validate_slab_geometry('{}')"),/permission denied/);
  await login(owner);await db.query("select site_set_role($1,'blocked')",[viewer]);await login(viewer);await assert.rejects(()=>save('panel',2),/ACCESS_REQUIRED/);assert.equal((await db.query('select * from site_slab_regions')).rows.length,0);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from seoripul_private.slab_region_audit')).rows[0].n,6);assert.equal((await db.query("select document->'drawing'->'slabs'->0->'points' points from site_drawings where id=$1",[drawing])).rows[0].points[1][0],3000);
 }finally{await db.close();}
});
