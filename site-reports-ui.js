(function(root){
'use strict';
if(!document.createElementNS)return;
const page=document.getElementById('site-prd'),cloud=root.SiteCloud,R=root.SiteReports;
const button=document.createElement('button');button.type='button';button.textContent='실적 보고';button.dataset.siteReports='';page.querySelector('.site-workspace-actions').prepend(button);
const dialog=document.createElement('dialog');dialog.className='site-report-dialog';dialog.setAttribute('aria-labelledby','site-report-heading');
dialog.innerHTML='<div class="site-report-heading"><h2 id="site-report-heading">공종별 실적 보고</h2><button type="button" data-report-close>닫기</button></div><form class="site-report-controls"><label>보고서 종류<select name="kind"><option value="daily">일보</option><option value="weekly" selected>주간보고</option><option value="period">기간 선택</option></select></label><label>시작일<input type="date" name="start" required></label><label>종료일<input type="date" name="end" required></label><button type="submit">실적 조회</button></form><p data-report-status role="status" aria-live="polite"></p><div data-report-body></div><div class="site-report-actions"><button type="button" data-report-download disabled>보고서 엑셀 다운로드</button></div>';
page.appendChild(dialog);
dialog.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Escape')e.stopPropagation();});
const form=dialog.querySelector('form'),kind=form.elements.namedItem('kind'),start=form.elements.namedItem('start'),end=form.elements.namedItem('end'),status=dialog.querySelector('[data-report-status]'),body=dialog.querySelector('[data-report-body]'),download=dialog.querySelector('[data-report-download]');
let busy=false,serial=0,model=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v.toLocaleString('ko-KR',{maximumFractionDigits:1});
function controls(){button.disabled=busy||!cloud.allowed();for(const el of form.querySelectorAll('input,select,button'))el.disabled=busy;start.disabled=busy||kind.value!=='period';download.disabled=busy||!model||!cloud.allowed();}
function period(){if(kind.value==='daily')start.value=end.value;else if(kind.value==='weekly'&&R.validDate(end.value))start.value=R.monday(end.value);}
function resetReport(){model=null;body.innerHTML='';status.textContent='';controls();}
function close(){serial++;busy=false;resetReport();if(dialog.open)dialog.close();button.focus();}
function render(m){body.innerHTML=`<p class="site-report-scope">전체 공구 · ${esc(m.start)} ~ ${esc(m.end)}</p><div class="site-report-table-wrap"><table><thead><tr><th>공종</th><th>공정</th><th>단위</th><th>기간 실적</th><th>종료일 누계</th><th>날짜 미입력·확인 필요</th></tr></thead><tbody>${m.summary.map(s=>`<tr><th scope="row">${esc(s.trade)}</th><td>${esc(s.stage)}</td><td>${esc(s.unit)}</td><td>${number(s.period)}</td><td>${number(s.cumulative)}</td><td>${number(s.undated)}</td></tr>`).join('')}</tbody></table></div>${m.missing.length?'<p class="site-report-date-note">날짜가 없는 완료 기록은 기간 실적과 누계에서 제외하며, 엑셀의 ‘날짜 확인’ 시트에 표시합니다.</p>':''}`;}
async function load(){
 if(busy||!cloud.allowed()||!dialog.open)return;
 period();const range={start:start.value,end:end.value};if(!R.validDate(range.start)||!R.validDate(range.end)||range.start>range.end||range.end>root.PRDDashboard.today()){resetReport();status.textContent='실적 기간을 확인해 주세요.';return;}
 const token=++serial,epoch=cloud.generation;busy=true;model=null;body.innerHTML='';status.textContent='저장된 공정 기록을 취합하고 있습니다…';controls();
 try{const prd=await root.PRDCloudUI.reportSnapshot();if(token!==serial||epoch!==cloud.generation||!cloud.allowed()||!dialog.open)return;const plans=await root.SitePlanUI.reportSnapshot();if(token!==serial||epoch!==cloud.generation||!cloud.allowed()||!dialog.open)return;
  model=R.summarize({prd,plans,asOf:root.PRDDashboard.today()},range.start,range.end);render(model);status.textContent='저장된 시공일 기준으로 집계했습니다.';
 }catch(e){if(token===serial&&epoch===cloud.generation&&dialog.open)status.textContent=e.message||'실적을 불러오지 못했습니다. 다시 시도해 주세요.';}
 finally{if(token===serial){busy=false;controls();}}
}
button.addEventListener('click',()=>{if(busy||!cloud.allowed())return;resetReport();const today=root.PRDDashboard.today();start.max=end.max=today;end.value=today;period();dialog.showModal();load();});
dialog.querySelector('[data-report-close]').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
form.addEventListener('submit',e=>{e.preventDefault();load();});kind.addEventListener('change',()=>{period();resetReport();});end.addEventListener('change',()=>{period();resetReport();});start.addEventListener('change',resetReport);
download.addEventListener('click',async()=>{if(busy||!model||!cloud.allowed())return;const token=serial,epoch=cloud.generation,report=model;busy=true;controls();status.textContent='보고서 엑셀을 만들고 있습니다…';try{const saved=await R.download(report,()=>dialog.open&&token===serial&&epoch===cloud.generation&&cloud.allowed());if(saved)status.textContent='보고서 엑셀 다운로드 완료';}catch(e){if(token===serial&&dialog.open)status.textContent=e.message||'엑셀을 만들지 못했습니다.';}finally{if(token===serial){busy=false;controls();}}});
document.addEventListener('site-auth-change',()=>{if(!cloud.allowed()){serial++;busy=false;model=null;body.innerHTML='';status.textContent='';if(dialog.open)dialog.close();}controls();});controls();
})(globalThis);
