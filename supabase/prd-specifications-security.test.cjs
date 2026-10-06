const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('PRD specifications save atomically with existing dates, retain import data, enforce roles and conflicts',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['seoripul.sql','site-trades.sql','prd-materials.sql','prd-specifications.sql'])await db.exec(fs.readFileSync(path.join(__dirname,file),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',user='00000000-0000-0000-0000-000000000002',drawing='a'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[user,'user@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({drawing:{piles:[{key:'abc',diameter:1000}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const spec={diameter:1200,column_spec:'BH-650×650×70×70',insert_spec:'H-400×400×13×21'},empty={diameter:null,column_spec:'',insert_spec:''};
  const save=(version=0,value=spec,pile='abc',installed='2026-09-16',delivered='2026-09-07')=>db.query('select * from site_save_prd_details($1,$2,$3,$4,$5,$6,$7,$8)',[drawing,pile,version,'2026-09-09',delivered,installed,'keep',value]);
  await login(owner);const row=(await save()).rows[0];assert.deepEqual(row.specifications,spec);assert.equal(row.version,1);assert.ok(row.delivered<row.drilled);
  await db.exec('reset role');const raw={schema:1,fields:[{id:'weight',value:39.3}]};await db.query('update site_prd_records set material_details=$1',[raw]);
  await login(owner);await assert.rejects(()=>save(0),/RECORD_CONFLICT/);await assert.rejects(()=>save(1,spec,'unknown'),/UNKNOWN_PILE/);
  for(const invalid of [{...spec,diameter:0},{...spec,diameter:'1200'},{...spec,diameter:true},{...spec,column_spec:'x'.repeat(121)},{...spec,insert_spec:null},{...spec,extra:'no'},{}])await assert.rejects(()=>save(1,invalid),/INVALID_RECORD/);
  await assert.rejects(()=>save(1,empty,'abc','2026-09-08'),/check constraint/);assert.equal((await db.query('select version from site_prd_records')).rows[0].version,1);
  const cleared=(await save(1,empty,'abc','2026-09-16','2026-09-13')).rows[0];assert.deepEqual(cleared.specifications,empty);assert.deepEqual(cleared.material_details,raw);assert.ok(cleared.delivered>cleared.drilled);
  const legacy=(await db.query("select * from site_save_prd($1,'abc',2,'2026-09-09','2026-09-13','2026-09-16','old browser')",[drawing])).rows[0];assert.deepEqual(legacy.specifications,empty);
  await login(user);
  for(const role of ['pending','viewer','blocked']){await login(owner);await db.query('select site_set_role($1,$2)',[user,role]);await login(user);await assert.rejects(()=>save(3),/EDIT_ACCESS_REQUIRED/);}
  await login(owner);await db.query("select site_set_role($1,'editor')",[user]);await login(user);assert.deepEqual((await save(3)).rows[0].specifications,spec);
  await assert.rejects(()=>db.query("update site_prd_records set specifications='{}'"),/permission denied/);
  await login(null);await assert.rejects(()=>save(4),/permission denied/);
  await db.exec('reset role');const audit=(await db.query('select before_value,after_value from seoripul_private.record_audit order by id desc limit 1')).rows[0];assert.deepEqual(audit.before_value.specifications,empty);assert.deepEqual(audit.after_value.specifications,spec);assert.deepEqual(audit.after_value.material_details,raw);
  assert.equal((await db.query("select count(*)::int n from seoripul_private.record_audit")).rows[0].n,4);
 }finally{await db.close();}
});
