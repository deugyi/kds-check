const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('imported PRD facts retain RLS, survive ordinary saves and participate in versioned audit',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(fs.readFileSync(path.join(__dirname,'seoripul.sql'),'utf8'));
  const owner='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002',drawing='a'.repeat(64);
  for(const [id,email] of [[owner,'owner@example.test'],[viewer,'viewer@example.test']]){await db.query('insert into auth.users values($1,$2,now())',[id,email]);await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify({email,email_verified:true})]);}
  await db.query("insert into seoripul_private.settings values(true,'owner@example.test')");await db.query('insert into site_drawings values($1,$2)',[drawing,JSON.stringify({drawing:{piles:[{key:'abc'}]}})]);
  async function login(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));if(id)await db.query('select site_register()');}
  const save=(version,memo)=>db.query('select * from site_save_prd($1,$2,$3,$4,$5,$6,$7)',[drawing,'abc',version,'2026-01-06','2025-12-26','2026-01-15',memo]);
  await login(owner);await save(0,'keep');await db.exec('reset role');await db.exec(fs.readFileSync(path.join(__dirname,'prd-materials.sql'),'utf8'));
  const details={schema:1,source:{file:'synthetic.xlsx',sheet:'A3',row:8},fields:[{id:'column_spec',value:'H-400'}]};
  await db.query('update site_prd_records set material_details=$1',[JSON.stringify(details)]);
  await assert.rejects(()=>db.query("update site_prd_records set material_details='[]'::jsonb"),/site_prd_material_object/);
  await login(viewer);assert.equal((await db.query('select material_details from site_prd_records')).rows.length,0);
  await login(owner);await db.query("select site_set_role($1,'viewer')",[viewer]);await login(viewer);
  assert.deepEqual((await db.query('select material_details from site_prd_records')).rows[0].material_details,details);
  await assert.rejects(()=>db.query("update site_prd_records set material_details='{}'"),/permission denied/);await assert.rejects(()=>save(1,'bypass'),/EDIT_ACCESS_REQUIRED/);
  await login(owner);const saved=(await save(1,'changed')).rows[0];assert.deepEqual(saved.material_details,details);assert.equal(saved.version,2);await assert.rejects(()=>save(1,'stale'),/RECORD_CONFLICT/);
  await db.query("select site_set_role($1,'blocked')",[viewer]);await login(viewer);assert.equal((await db.query('select material_details from site_prd_records')).rows.length,0);
  await login(null);await assert.rejects(()=>db.query('select material_details from site_prd_records'),/permission denied/);
  await db.exec('reset role');const audit=(await db.query('select before_value,after_value from seoripul_private.record_audit order by id desc limit 1')).rows[0];assert.deepEqual(audit.before_value.material_details,details);assert.deepEqual(audit.after_value.material_details,details);
 }finally{await db.close();}
});
