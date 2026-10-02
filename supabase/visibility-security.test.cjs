const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('only the administrator hides/restores known steel members; records survive and stale writes fail',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','site-member-visibility.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',drawing='b'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[other,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({id:drawing,drawing:{members:[{key:'beam'}],slabs:[{key:'panel'}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const hide=(hidden=true,version=0,key='beam')=>db.query('select * from site_set_member_visibility($1,$2,$3,$4)',[drawing,key,version,hidden]);
  await login(null);await assert.rejects(hide,/permission denied/);await assert.rejects(()=>db.query('select * from site_member_visibility'),/permission denied/);
  await login(other);await assert.rejects(hide,/ADMIN_REQUIRED/);assert.equal((await db.query('select * from site_member_visibility')).rows.length,0);
  await login(owner);await db.query("select site_set_role($1,'editor')",[other]);await login(other);await assert.rejects(hide,/ADMIN_REQUIRED/);
  await db.query("select * from site_save_trade($1,'steel','beam',0,'B-1','H',null,'2026-10-01','keep')",[drawing]);
  await login(owner);await assert.rejects(()=>hide(true,0,'panel'),/UNKNOWN_MEMBER/);await assert.rejects(()=>hide(null),/INVALID_RECORD/);
  assert.equal((await hide()).rows[0].hidden,true);await assert.rejects(hide,/RECORD_CONFLICT/);
  assert.equal((await db.query('select completed,note,version from site_trade_records')).rows[0].note,'keep');
  await login(other);assert.equal((await db.query('select * from site_member_visibility')).rows[0].hidden,true);await assert.rejects(()=>db.query('update site_member_visibility set hidden=false'),/permission denied/);await assert.rejects(()=>hide(false,1),/ADMIN_REQUIRED/);
  await login(owner);assert.equal((await hide(false,1)).rows[0].hidden,false);await db.query("select site_set_role($1,'viewer')",[other]);await login(other);assert.equal((await db.query('select * from site_member_visibility')).rows[0].hidden,false);await assert.rejects(()=>hide(true,2),/ADMIN_REQUIRED/);
  await login(owner);await db.query("select site_set_role($1,'blocked')",[other]);await login(other);assert.equal((await db.query('select * from site_member_visibility')).rows.length,0);
  await assert.rejects(()=>db.query('select * from seoripul_private.member_visibility_audit'),/permission denied/);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from seoripul_private.member_visibility_audit')).rows[0].n,2);assert.equal((await db.query('select note,version from site_trade_records')).rows[0].version,1);
 }finally{await db.close();}
});
