(function(root){
'use strict';
if(!document.createElementNS)return;
const cloud=root.SiteCloud,O=root.SiteOverview,pages=Array.from(document.querySelectorAll('.site-page'));
const states=new Map(pages.map(page=>[page,{serial:0,busy:false,model:null}]));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value===null?'—':value.toLocaleString('ko-KR',{maximumFractionDigits:1});
const active=page=>page.classList.contains('on')&&!page.querySelector('[data-trade="overview"]').hidden;
function render(model){
 const cards=model.trades.map(t=>`<article class="overview-card ${t.ready?'':'overview-pending'}"><div class="overview-card-head"><h3>${t.name}</h3><span>${t.ready?(t.id==='slab'?'타설 면적 기준':t.id==='steel'?'설치 완료 확인 기준':'완료일 입력 기준'):'집계 준비 중'}</span></div><strong class="overview-percent">${O.percent(t.percent)}</strong><div class="overview-track" role="img" aria-label="${t.name} ${t.ready?t.completed+' / '+t.total+' '+t.unit:'집계 준비 중'}"><span style="width:${t.percent||0}%"></span></div><p class="overview-count">${t.ready?`<b>${number(t.completed)}</b> / ${number(t.total)}${t.unit} · ${t.caption}`:'도면·시공 기록 등록 후 집계'}</p><button type="button" data-overview-trade="${t.id}">공종 화면 보기 <span aria-hidden="true">↗</span></button></article>`).join('');
 const rows=model.zones.map(z=>`<tr><th scope="row">${esc(z.id==='unassigned'?'미분류':z.id)}</th>${z.trades.map(t=>`<td>${t.ready&&t.total?`<div class="overview-zone-number"><b>${O.percent(t.percent)}</b><span>${number(t.completed)} / ${number(t.total)}${t.unit}</span></div><div class="overview-track"><span style="width:${t.percent||0}%"></span></div>`:'<span class="overview-no-data">'+(t.ready?'대상 없음':'준비 중')+'</span>'}</td>`).join('')}</tr>`).join('');
 return `<div class="overview-heading"><div><p class="overview-eyebrow">서리풀 : ${model.site==='south'?'남측':'북측'}</p><h2>종합 현황판</h2></div><div class="overview-date">${esc(model.asOf)} 기준</div></div><div class="overview-cards">${cards}</div><section class="overview-section"><div class="overview-section-head"><h3>공구별 진척도</h3><span>${esc(model.coverage||'전체 도면 기준')}</span></div>${rows?`<div class="overview-table-scroll"><table class="overview-table"><thead><tr><th scope="col">공구</th>${model.trades.map(t=>`<th scope="col">${t.name}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="overview-no-data">공구별 도면이 등록되면 여기에 현황이 표시됩니다.</p>'}</section><section class="overview-schedule"><div class="overview-schedule-icon" aria-hidden="true">▦</div><div><h3>계획 대비 공정 현황</h3><p>공정표를 올려주시면 계획 진척도와 실제 기록을 비교할 수 있습니다.</p><span>현재 공정표 미등록</span></div></section>`;
}
async function refresh(page){
 const state=states.get(page),pane=page.querySelector('[data-trade="overview"]');if(!cloud.allowed()||state.busy)return false;
 const epoch=cloud.generation,serial=++state.serial;state.busy=true;const button=page.querySelector('[data-overview-refresh]'),status=page.querySelector('[data-overview-status]');button.disabled=true;status.textContent='저장된 시공 기록을 불러오고 있습니다…';
 try{let model;
  if(page.id!=='site-prd')model=O.summarize({},root.PRDDashboard.today(),'north');
  else{const [prd,plan]=await Promise.all([root.PRDCloudUI.overviewSnapshot(),root.SitePlanUI.overviewSnapshot()]);if(epoch!==cloud.generation||!cloud.allowed()||serial!==state.serial)return;const prdRows=await cloud.records(),prdRecords=Object.fromEntries(prdRows.map(r=>[r.pile_key,r]));model=O.summarize({prd:{items:prd.items,zoneIds:prd.zoneIds,records:prdRecords},...plan.sources},root.PRDDashboard.today(),'south');model.coverage=plan.coverage;}
  if(epoch!==cloud.generation||!cloud.allowed()||serial!==state.serial)return false;state.model=model;pane.querySelector('[data-overview-body]').innerHTML=render(model);status.textContent='최신 저장 기록으로 집계했습니다.';return true;
 }catch(e){if(epoch===cloud.generation&&cloud.allowed()&&serial===state.serial)status.textContent=(state.model?'이전 집계가 표시 중입니다. ':'')+'현황을 불러오지 못했습니다. 최신 기록 버튼으로 다시 시도해 주세요.';}
 finally{if(serial===state.serial){state.busy=false;button.disabled=false;}}
 return false;
}
for(const page of pages){const pane=page.querySelector('[data-trade="overview"]');pane.innerHTML='<div data-overview-body></div>';page.querySelector('[data-overview-refresh]').addEventListener('click',()=>refresh(page));pane.addEventListener('click',e=>{const button=e.target.closest('button');if(button?.dataset.overviewTrade)root.SiteWorkspace.selectTrade(page,button.dataset.overviewTrade);});}
document.addEventListener('site-auth-change',()=>{for(const [page,state] of states){state.serial++;state.busy=false;state.model=null;const pane=page.querySelector('[data-trade="overview"]');pane.querySelector('[data-overview-body]').innerHTML='';page.querySelector('[data-overview-refresh]').disabled=false;page.querySelector('[data-overview-status]').textContent='승인된 계정으로 로그인하면 현황을 볼 수 있습니다.';if(cloud.allowed()&&active(page))refresh(page);}});
setInterval(()=>{if(!document.hidden&&cloud.allowed())for(const page of pages)if(active(page))refresh(page);},30000);
root.SiteOverviewUI={activate:refresh,async exportSnapshot(page){if(!cloud.allowed())throw Error('접근 권한을 다시 확인해 주세요.');const refreshed=await refresh(page),state=states.get(page);if(!refreshed||!cloud.allowed()||state.busy||!state.model)throw Error('최신 현황을 불러온 후 다시 시도해 주세요.');return structuredClone(state.model);}};
})(globalThis);
