(function(root){
'use strict';
if(!document.createElementNS)return;
const pages=Array.from(document.querySelectorAll('.site-page'));
const states=new Map(pages.map(page=>[page,{trade:page.querySelector('[data-site-trade]').value,switching:false,focus:null}]));
const expanded=page=>page.classList.contains('site-fullscreen');
function exportControls(page,preserveStatus=false){
 const drawingTools=page.querySelector('[data-prd-tools]');
 if(drawingTools)drawingTools.hidden=states.get(page).trade!=='prd';
 const overviewTools=page.querySelector('[data-overview-tools]');
 if(overviewTools)overviewTools.hidden=states.get(page).trade!=='overview';
 const prdSync=page.querySelector('[data-prd-sync]');
 if(prdSync)prdSync.hidden=states.get(page).trade!=='prd';
 const floorControl=page.querySelector('[data-plan-floor-control]');if(floorControl)floorControl.hidden=!['steel','slab'].includes(states.get(page).trade);
 const planTools=page.querySelector('[data-plan-tools]');
 if(planTools)planTools.hidden=!['steel','slab'].includes(states.get(page).trade);
 const planStatus=page.querySelector('[data-plan-sync-status]');
 if(planStatus&&!preserveStatus)planStatus.textContent='';
 const button=page.querySelector('[data-site-export]');
 button.disabled=page.id!=='site-prd'||!['prd','steel','slab','overview'].includes(states.get(page).trade)||(['steel','slab'].includes(states.get(page).trade)&&root.SitePlanUI?.isReady?.(states.get(page).trade)===false);
 button.title=button.disabled?'등록된 시공 현황이 없습니다.':'현재 공구와 상태 필터에 해당하는 저장 기록 다운로드';
 if(!preserveStatus)page.querySelector('[data-site-export-status]').textContent='';
}
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
 if(state.trade===trade){if(trade==='overview')root.SiteOverviewUI?.activate(page);return true;}
 const epoch=root.SiteCloud.generation;state.switching=true;select.disabled=true;
 try{
  if(page.id==='site-prd'&&state.trade==='prd'&&!await root.PRDCloudUI.beforeTradeChange())return false;
  if(page.id==='site-prd'&&['steel','slab'].includes(state.trade)&&!await root.SitePlanUI.beforeTradeChange(state.trade))return false;
  if(!root.SiteCloud.allowed()||epoch!==root.SiteCloud.generation)return false;
  for(const pane of panes)pane.hidden=pane.dataset.trade!==trade;
  state.trade=trade;if(trade==='overview')root.SiteOverviewUI?.activate(page);if(page.id==='site-prd'&&['steel','slab'].includes(trade))await root.SitePlanUI.activate(trade);return true;
 }finally{select.value=state.trade;select.disabled=false;state.switching=false;exportControls(page);}
}
for(const page of pages){
 if(root.MutationObserver)for(const status of page.querySelectorAll('[role="status"]')){if(!status.closest('.site-workspace-toolbar'))continue;const update=()=>status.title=status.textContent;update();new root.MutationObserver(update).observe(status,{childList:true,subtree:true,characterData:true});}
 const select=page.querySelector('[data-site-trade]'),button=page.querySelector('[data-site-fullscreen]');
 const exportButton=page.querySelector('[data-site-export]'),exportStatus=page.querySelector('[data-site-export-status]');
 exportControls(page);
 exportButton.addEventListener('click',async()=>{
  const state=states.get(page);
  if(state.switching||exportButton.disabled||!root.SiteCloud?.allowed())return;
  const epoch=root.SiteCloud.generation;state.switching=true;select.disabled=true;exportButton.disabled=true;exportStatus.textContent='엑셀 파일을 만들고 있습니다…';
  try{
   const isPRD=state.trade==='prd',isOverview=state.trade==='overview',snapshot=await(isOverview?root.SiteOverviewUI.exportSnapshot(page):isPRD?root.PRDCloudUI.exportSnapshot():root.SitePlanUI.exportSnapshot(state.trade));
   const saved=await(isOverview?root.SiteOverview:isPRD?root.PRDExport:root.SitePlanExport).download(snapshot,()=>root.SiteCloud.allowed()&&epoch===root.SiteCloud.generation);
   exportStatus.textContent=saved?`${snapshot.scope} · ${isOverview?'종합 현황':isPRD?snapshot.piles.length+'공':snapshot.items.length+'개'} 다운로드 완료`:'접근 권한이 변경되어 다운로드를 중단했습니다.';
  }catch(e){exportStatus.textContent=e.message||'다운로드에 실패했습니다. 다시 시도해 주세요.';}
  finally{state.switching=false;select.disabled=false;exportButton.disabled=page.id!=='site-prd'||!['prd','steel','slab','overview'].includes(state.trade)||(['steel','slab'].includes(state.trade)&&root.SitePlanUI?.isReady?.(state.trade)===false);}
 });
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
root.SiteWorkspace={selectTrade,exit,refreshControls:page=>exportControls(page,true)};
})(globalThis);
