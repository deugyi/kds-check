/* Shared page navigation; calculator inputs remain mounted when returning home. */
(function(root){
'use strict';
const byId=id=>document.getElementById(id);
const items=Array.from(document.querySelectorAll('#nav button[data-t]'));
const cards=Array.from(document.querySelectorAll('#home .home-program'));
const key='kds-check-recent-programs';
let recent=[];
try { const saved=JSON.parse(root.localStorage.getItem(key)||'[]'); if(Array.isArray(saved)) recent=[...new Set(saved)].filter(id=>items.some(b=>b.dataset.t===id)).slice(0,3); } catch (_) {}
function renderRecent(){
  byId('home-recent').hidden=!recent.length;
  byId('home-recent-list').innerHTML=recent.map(id=>{
    const item=items.find(b=>b.dataset.t===id),group=item.closest('.menu').querySelector('.menu-top').textContent;
    return `<button type="button" data-open="${id}">${group} · ${item.textContent}</button>`;
  }).join('');
}
root.openKDSPage=function(id){
  const item=items.find(b=>b.dataset.t===id);
  if(id!=='home'&&!item)return;
  document.querySelectorAll('section.tab').forEach(s=>s.classList.toggle('on',s.id===id));
  document.querySelectorAll('#nav .menu-top').forEach(b=>b.classList.remove('on'));
  items.forEach(b=>b.removeAttribute('aria-current'));
  byId('home-button').removeAttribute('aria-current');
  if(item){
    item.setAttribute('aria-current','page');item.closest('.menu').querySelector('.menu-top').classList.add('on');
    recent=[id,...recent.filter(x=>x!==id)].slice(0,3);
    try{root.localStorage.setItem(key,JSON.stringify(recent));}catch(_){}
  }else{byId('home-button').classList.add('on');byId('home-button').setAttribute('aria-current','page');}
  closeMenus();renderRecent();
  root.scrollTo({top:0,behavior:'instant'});
  const target=byId(id);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
};
byId('home-title-link').addEventListener('click',event=>{event.preventDefault();root.openKDSPage('home');});
byId('home-button').addEventListener('click',()=>root.openKDSPage('home'));
byId('home').addEventListener('click',event=>{const button=event.target.closest('button[data-open]');if(button)root.openKDSPage(button.dataset.open);});
renderRecent();
})(globalThis);
