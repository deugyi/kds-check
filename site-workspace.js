(function(root){
'use strict';
if(!document.createElementNS)return;
const pages=Array.from(document.querySelectorAll('.site-page'));
const states=new Map(pages.map(page=>[page,{trade:'prd',switching:false,focus:null}]));
const expanded=page=>page.classList.contains('site-fullscreen');
function setExpanded(page,on){
 if(expanded(page)===on)return;
 if(page.id==='site-prd')root.PRDCloudUI.onFullscreenChange(on);
 page.classList.toggle('site-fullscreen',on);
 document.body.classList.toggle('prd-fullscreen-open',pages.some(expanded));
 const button=page.querySelector('[data-site-fullscreen]');
 button.textContent=on?'전체 화면 닫기':'전체 화면';button.setAttribute('aria-pressed',String(on));
 if(on){page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');button.focus();}
 else{page.removeAttribute('role');page.removeAttribute('aria-modal');const focus=states.get(page).focus;if(focus?.isConnected)focus.focus({preventScroll:true});}
}
async function exit(page){
 setExpanded(page,false);
 if(document.fullscreenElement===page){try{await document.exitFullscreen();}catch{}}
}
async function selectTrade(page,trade){
 const state=states.get(page),select=page.querySelector('[data-site-trade]');
 const panes=Array.from(page.querySelectorAll('[data-trade]'));
 if(!state||!panes.some(p=>p.dataset.trade===trade))return false;
 if(state.switching||!root.SiteCloud?.allowed()){select.value=state.trade;return false;}
 if(state.trade===trade)return true;
 const epoch=root.SiteCloud.generation;state.switching=true;select.disabled=true;
 try{
  if(page.id==='site-prd'&&state.trade==='prd'&&!await root.PRDCloudUI.beforeTradeChange())return false;
  if(!root.SiteCloud.allowed()||epoch!==root.SiteCloud.generation)return false;
  for(const pane of panes)pane.hidden=pane.dataset.trade!==trade;
  state.trade=trade;return true;
 }finally{select.value=state.trade;select.disabled=false;state.switching=false;}
}
for(const page of pages){
 const select=page.querySelector('[data-site-trade]'),button=page.querySelector('[data-site-fullscreen]');
 select.addEventListener('change',()=>selectTrade(page,select.value));
 button.addEventListener('click',async()=>{
  if(expanded(page)){await exit(page);return;}
  if(!root.SiteCloud?.allowed())return;
  states.get(page).focus=document.activeElement;setExpanded(page,true);
  if(page.requestFullscreen){try{await page.requestFullscreen();}catch{/* Retain viewport fullscreen. */}}
 });
 page.addEventListener('keydown',e=>{
  if(!expanded(page))return;
  if(e.key==='Escape'){e.preventDefault();exit(page);}
  if(e.key==='Tab'){
   const items=Array.from(page.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')).filter(n=>!n.disabled&&n.getClientRects().length);
   const first=items[0],last=items.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
 });
}
document.addEventListener('fullscreenchange',()=>{for(const page of pages)if(expanded(page)&&document.fullscreenElement!==page)setExpanded(page,false);});
document.addEventListener('site-auth-change',()=>{if(!root.SiteCloud?.allowed())for(const page of pages)exit(page);});
root.SiteWorkspace={selectTrade,exit};
})(globalThis);
