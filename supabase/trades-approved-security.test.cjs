const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('approved ordinary users edit steel/slab records; approval, PRD, admin tools and version checks stay enforced',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','site-member-visibility.sql','site-trades-approved.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',drawing='b'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[other,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({id:drawing,drawing:{members:[{key:'beam'}],slabs:[{key:'panel'}],piles:[{key:'pile'}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const save=(trade='steel',item='beam',version=0)=>db.query('select * from site_save_trade($1,$2,$3,$4,$5,$6,null,$7,$8)',[drawing,trade,item,version,'ordinary user','spec','2026-10-02','memo']);
  await login(null);await assert.rejects(save,/permission denied/);
  await login(other);await assert.rejects(save,/ACCESS_REQUIRED/);
  await login(owner);await db.query("select site_set_role($1,'viewer')",[other]);await login(other);
  assert.equal((await save()).rows[0].version,1);assert.equal((await save('slab','panel')).rows[0].version,1);assert.equal((await save('steel','beam',1)).rows[0].version,2);
  await assert.rejects(()=>save('steel','beam',1),/RECORD_CONFLICT/);await assert.rejects(()=>save('steel','panel'),/UNKNOWN_MEMBER/);
  await assert.rejects(()=>db.query("select site_save_prd($1,'pile',0,null,null,null,'memo')",[drawing]),/ACCESS_REQUIRED/);
  await assert.rejects(()=>db.query("select site_set_member_visibility($1,'beam',0,true)",[drawing]),/ADMIN_REQUIRED/);
  await assert.rejects(()=>db.query("update site_trade_records set version=100"),/permission denied/);await assert.rejects(()=>db.query('select * from seoripul_private.trade_record_audit'),/permission denied/);
  await login(owner);await db.query("select site_set_role($1,'blocked')",[other]);await login(other);await assert.rejects(()=>save('steel','beam',2),/ACCESS_REQUIRED/);assert.equal((await db.query('select * from site_trade_records')).rows.length,0);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from seoripul_private.trade_record_audit')).rows[0].n,3);
 }finally{await db.close();}
});
