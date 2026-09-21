(function(root){
'use strict';
if(!document.createElementNS)return;
const cfg=root.SITE_CONFIG,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roles={pending:'승인 대기',viewer:'조회 전용',editor:'기록 입력',admin:'관리자',blocked:'이용 중지'};
let client=null,member=null,user=null,errorText='',checking=false,checkAgain=false,generation=0;
const pages=Array.from(document.querySelectorAll('.site-page'));
for(const page of pages){
 const panel=document.createElement('div');panel.className='site-access card';
 panel.innerHTML='<div class="site-access-heading"><div><h2>서리풀 현장</h2><p class="site-account" aria-live="polite">로그인 상태를 확인하고 있습니다.</p></div><div class="site-auth-actions"><button type="button" data-site-login>Google 계정으로 로그인</button><button type="button" data-site-refresh hidden>접근 권한 확인</button><button type="button" data-site-logout hidden>로그아웃</button></div></div><p class="site-auth-message" role="status"></p><div class="site-admin" hidden><button type="button" data-site-users>사용자 승인·권한 관리</button><div class="site-member-list" hidden></div></div>';
 page.prepend(panel);
 panel.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.hasAttribute('data-site-login')){if(!client)throw Error('로그인 연결을 준비하지 못했습니다. 새로고침해 주세요.');try{sessionStorage.setItem('kds-site-return',page.id);}catch{}const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:cfg.redirect,queryParams:{prompt:'select_account'}}});if(error)throw error;}
   if(b.hasAttribute('data-site-refresh'))await refresh();
   if(b.hasAttribute('data-site-logout')){
    if(root.PRDCloudUI?.hasUnsaved()&&!confirm('저장하지 못한 입력이 있습니다. 입력을 버리고 로그아웃할까요?'))return;
    const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await refresh();
   }
   if(b.hasAttribute('data-site-users'))await showUsers(panel);
   if(b.dataset.member){
    const role=b.closest('tr').querySelector('select').value;
    const {error}=await client.rpc('site_set_role',{target_user:b.dataset.member,new_role:role});if(error)throw error;
    await showUsers(panel);
   }
  }catch(e){errorText=explain(e);render();}
 });
}
function explain(e){
 const text=String(e?.message||e);
 if(text.includes('RECORD_CONFLICT'))return '다른 사용자가 이 공의 기록을 변경했습니다. 입력 내용은 유지했습니다. 최신 기록을 확인한 후 다시 입력해 주세요.';
 if(/GOOGLE_VERIFICATION_REQUIRED|ACCOUNT_EMAIL_CHANGED/.test(text))return '확인된 구글 계정으로 다시 로그인해 주세요.';
 if(/42501|permission|EDIT_ACCESS_REQUIRED|ADMIN_REQUIRED/i.test(text)||e?.code==='42501')return '이 작업을 할 권한이 없습니다. 접근 권한을 다시 확인해 주세요.';
 if(/provider.*not.*enabled|unsupported.*provider/i.test(text))return '구글 로그인 연결 설정이 아직 완료되지 않았습니다.';
 return '서버 연결에 실패했습니다. 입력 내용은 자동으로 덮어쓰지 않습니다. 잠시 후 다시 시도해 주세요.';
}
function allowed(){return !!member&&['viewer','editor','admin'].includes(member.role);}
function canEdit(){return !!member&&['editor','admin'].includes(member.role);}
function render(){
 document.body.classList.toggle('site-authorized',allowed());
 for(const page of pages){const panel=page.querySelector('.site-access');
  panel.querySelector('.site-account').textContent=user?`${user.email} · ${roles[member?.role]||'권한 확인 중'}`:'승인된 구글 계정으로 로그인해 주세요.';
  panel.querySelector('[data-site-login]').hidden=!!user;
  panel.querySelector('[data-site-logout]').hidden=!user;
  panel.querySelector('[data-site-refresh]').hidden=!user;
  panel.querySelector('.site-auth-message').textContent=errorText||(member?.role==='pending'?'관리자 승인 후 현장 도면과 시공 현황을 이용할 수 있습니다.':member?.role==='blocked'?'현장 이용 권한이 중지되었습니다. 관리자에게 문의해 주세요.':!user?'구조 계산기는 로그인 없이 이용할 수 있습니다.':'');
  panel.querySelector('.site-admin').hidden=member?.role!=='admin';
  if(member?.role!=='admin'){panel.querySelector('.site-member-list').innerHTML='';panel.querySelector('.site-member-list').hidden=true;}
 }
}
async function refresh(){
 if(checking){checkAgain=true;return;}checking=true;
 const previous=member,previousUser=user?.id;
 try{
  errorText='';const {data,error}=await client.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw error;
  user=data.user;member=null;
  if(user){const r=await client.rpc('site_register');if(r.error)throw r.error;member=r.data;}
 }catch(e){member=null;errorText=explain(e);}
 finally{
  checking=false;render();
  if(previousUser!==user?.id||previous?.role!==member?.role){generation++;document.dispatchEvent(new CustomEvent('site-auth-change'));}
  try{const target=sessionStorage.getItem('kds-site-return');
  if(target&&pages.some(p=>p.id===target)&&root.openKDSPage){sessionStorage.removeItem('kds-site-return');root.openKDSPage(target);}}catch{}
  if(checkAgain){checkAgain=false;setTimeout(refresh,0);}
 }
}
async function showUsers(panel){
 if(member?.role!=='admin')return;
 const {data,error}=await client.from('site_members').select('user_id,email,role,created_at').order('created_at');if(error)throw error;
 const list=panel.querySelector('.site-member-list');list.hidden=false;
 list.innerHTML='<div class="site-members-scroll"><table><thead><tr><th>계정</th><th>권한</th><th>변경</th></tr></thead><tbody>'+data.map(m=>`<tr><td>${esc(m.email)}</td><td>${m.role==='admin'?'관리자':`<select aria-label="${esc(m.email)} 권한">${['pending','viewer','editor','blocked'].map(r=>`<option value="${r}"${r===m.role?' selected':''}>${roles[r]}</option>`).join('')}</select>`}</td><td>${m.role==='admin'?'—':`<button type="button" data-member="${esc(m.user_id)}">적용</button>`}</td></tr>`).join('')+'</tbody></table></div>';
}
async function records(){
 if(!allowed())throw Error('EDIT_ACCESS_REQUIRED');
 const r=await client.from('site_prd_records').select('*').eq('drawing_id',cfg.drawing).order('pile_key').range(0,4999);
 if(r.error)throw r.error;return r.data;
}
root.SiteCloud={allowed,canEdit,explain,refresh,get generation(){return generation;},get userId(){return user?.id;},
 async load(){
  if(!allowed())throw Error('EDIT_ACCESS_REQUIRED');
  const r=await client.from('site_drawings').select('document').eq('id',cfg.drawing).single();if(r.error)throw r.error;
  return {base:r.data.document,rows:await records()};
 },records,
 async save(key,value,version){
  if(!canEdit())throw Error('EDIT_ACCESS_REQUIRED');
  const r=await client.rpc('site_save_prd',{drawing:cfg.drawing,pile:key,expected_version:version,drilled_date:value.drilled||null,delivered_date:value.delivered||null,installed_date:value.installed||null,memo:value.note});
  if(r.error)throw r.error;return r.data;
 }
};
try{
 if(!cfg||!root.supabase?.createClient)throw Error('configuration');
 client=root.supabase.createClient(cfg.url,cfg.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 client.auth.onAuthStateChange(()=>setTimeout(refresh,0));
 refresh();
 setInterval(()=>{if(!document.hidden&&document.querySelector('.site-page.on'))refresh();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}catch(e){errorText='로그인 연결을 준비하지 못했습니다. 새로고침해 주세요.';render();}
})(globalThis);
