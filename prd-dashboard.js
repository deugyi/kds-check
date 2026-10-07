/* Read-only graphics derived from the authenticated PRD records. */
(function(root){
'use strict';
const DAY=86400000;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=t=>new Date(t).toISOString().slice(0,10);
const today=()=>iso(Date.now()+9*3600000);
function stamp(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
 const t=Date.parse(value+'T00:00:00Z');return Number.isFinite(t)&&iso(t)===value?t:null;
}
function summarize(piles,records,zoneData,asOf=today()){
 const end=stamp(asOf);if(end===null)throw Error('INVALID_REPORT_DATE');
 const monday=end-((new Date(end).getUTCDay()+6)%7)*DAY;
 const weeks=Array.from({length:8},(_,i)=>{const start=monday-(7-i)*7*DAY;return {start:iso(start),end:iso(start+6*DAY),drilled:0,installed:0};});
 const fresh=()=>({total:0,drilled:0,delivered:0,installed:0,remaining:0,percent:0});
 const all=fresh(),zones=zoneData.zones.map(z=>({id:z.id,...fresh()})),byZone=new Map(zones.map(z=>[z.id,z]));
 let latest=null;
 for(const p of piles){
  const id=zoneData.membership[p.key]||'unassigned';
  if(!byZone.has(id)){const z={id,...fresh()};byZone.set(id,z);zones.push(z);}
  const z=byZone.get(id),r=records[p.key]||{};all.total++;z.total++;
  for(const field of ['drilled','delivered','installed']){
   const t=stamp(r[field]);if(t===null)continue;
   all[field]++;z[field]++;if(!latest||r[field]>latest)latest=r[field];
   if(field!=='delivered'&&t<=end){const i=Math.floor((t-stamp(weeks[0].start))/(7*DAY));if(i>=0&&i<8)weeks[i][field]++;}
  }
 }
 for(const s of [all,...zones]){s.remaining=s.total-s.installed;s.percent=s.total?100*s.installed/s.total:0;}
 return {all,zones,weeks,asOf,latest};
}
function render(m){
 const a=m.all,short=d=>d.slice(5).replace('-','/'),name=id=>id==='unassigned'?'미분류':id;
 const max=Math.max(1,...m.weeks.flatMap(w=>[w.drilled,w.installed]));
 const bars=m.weeks.map((w,i)=>{
  const x=35+i*51;return `<g><title>${w.start}~${w.end}: 천공 ${w.drilled}공, 시공 완료 ${w.installed}공</title><rect x="${x}" y="${132-w.drilled/max*96}" width="14" height="${w.drilled/max*96}" rx="3" class="prd-chart-drilled"/><rect x="${x+17}" y="${132-w.installed/max*96}" width="14" height="${w.installed/max*96}" rx="3" class="prd-chart-poured"/><text x="${x+7}" y="${124-w.drilled/max*96}" text-anchor="middle">${w.drilled}</text><text x="${x+24}" y="${124-w.installed/max*96}" text-anchor="middle">${w.installed}</text><text x="${x+15}" y="153" text-anchor="middle">${short(w.start)}</text></g>`;
 }).join('');
 return `<div class="prd-overview"><div class="prd-progress-ring" style="--prd-progress:${a.percent}%" role="img" aria-label="시공 완료율 ${a.percent.toFixed(1)}퍼센트"><div><strong>${a.percent.toFixed(1)}<small>%</small></strong><span>시공 완료율</span></div></div><div class="prd-overview-copy"><span class="prd-eyebrow">서리풀 : 남측 · PRD</span><h3>현장 진행 현황</h3><p>전체 <strong>${a.total.toLocaleString('ko-KR')}</strong>공 중 <strong>${a.installed.toLocaleString('ko-KR')}</strong>공 시공 완료</p><p class="prd-muted">마지막 작업일 ${m.latest?esc(m.latest):'기록 없음'}</p></div><div class="prd-kpis"><div><span>천공 기록</span><strong>${a.drilled}<small>공</small></strong></div><div><span>시공 완료</span><strong>${a.installed}<small>공</small></strong></div><div><span>잔여 공수</span><strong>${a.remaining}<small>공</small></strong></div><div><span>자재 반입</span><strong>${a.delivered?`${a.delivered}<small>공</small>`:'<small>기록 없음</small>'}</strong></div></div></div>
 <div class="prd-chart-grid"><div class="prd-chart-card"><div class="prd-chart-heading"><h3>공구별 시공 완료율</h3><span class="prd-muted">공구 클릭 → 도면 보기</span></div><div class="prd-zone-chart">${m.zones.map(z=>`<button type="button" class="prd-zone-bar" data-zone="${esc(z.id)}" aria-label="${esc(name(z.id))} 공구, 시공 완료 ${z.installed} / ${z.total}공, 완료율 ${z.percent.toFixed(1)}퍼센트"><strong>${esc(name(z.id))}</strong><span class="prd-bar-track" aria-hidden="true"><span style="width:${z.percent}%"></span></span><span class="prd-bar-percent">${z.percent.toFixed(1)}%</span><span class="prd-bar-count">${z.installed} / ${z.total}공</span></button>`).join('')}</div></div>
 <div class="prd-chart-card"><div class="prd-chart-heading"><h3>주간 작업 실적</h3><span class="prd-chart-legend"><span><i class="prd-legend-drilled"></i>천공</span><span><i class="prd-legend-poured"></i>시공 완료</span></span></div><svg class="prd-week-chart" viewBox="0 0 455 170" role="img" aria-label="주간 천공·시공 완료 실적. 상세 수치는 아래 표에서 확인할 수 있습니다."><path d="M28 132H449" class="prd-chart-baseline"/>${bars}</svg><p class="prd-muted">${esc(m.asOf)} 기준 · 이번 주는 입력된 실적만 집계합니다.</p><details class="prd-week-table"><summary>주간 실적 표 보기</summary><table><caption>남측 전체 주간 실적 (공)</caption><thead><tr><th scope="col">주간</th><th scope="col">천공</th><th scope="col">시공 완료</th></tr></thead><tbody>${m.weeks.map(w=>`<tr><th scope="row">${short(w.start)}~${short(w.end)}</th><td>${w.drilled}</td><td>${w.installed}</td></tr>`).join('')}</tbody></table></details></div></div>`;
}
root.PRDDashboard={today,summarize,render};if(typeof module!=='undefined')module.exports=root.PRDDashboard;
})(globalThis);
