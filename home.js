/* Shared page navigation; calculator inputs remain mounted when returning home. */
(function(root){
'use strict';
const byId=id=>document.getElementById(id);
const items=Array.from(document.querySelectorAll('#nav button[data-t]'));
root.openKDSPage=async function(id){
  // Old trade links resolve to the unified site workspace.
  const legacy=/^(site(?:-north)?)-(steel|slab|curtainwall)$/.exec(id);
  if(legacy){id=legacy[1]+'-prd';if(root.SiteWorkspace&&!await root.SiteWorkspace.selectTrade(byId(id),legacy[2]))return;}
  const item=items.find(b=>b.dataset.t===id);
  if(id!=='home'&&!item)return;
  document.querySelectorAll('section.tab').forEach(s=>s.classList.toggle('on',s.id===id));
  document.querySelectorAll('#nav .menu-top').forEach(b=>b.classList.remove('on'));
  items.forEach(b=>b.removeAttribute('aria-current'));
  byId('home-button').removeAttribute('aria-current');
  if(item){
    item.setAttribute('aria-current','page');item.closest('.menu').querySelector('.menu-top').classList.add('on');
  }else{byId('home-button').classList.add('on');byId('home-button').setAttribute('aria-current','page');}
  closeMenus();
  root.scrollTo({top:0,behavior:'instant'});
  const target=byId(id);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
};
byId('home-title-link').addEventListener('click',event=>{event.preventDefault();root.openKDSPage('home');});
byId('home-button').addEventListener('click',()=>root.openKDSPage('home'));
byId('home').addEventListener('click',event=>{const button=event.target.closest('button[data-open]');if(button)root.openKDSPage(button.dataset.open);});
})(globalThis);
