(function(){
'use strict';
const E=Seismic,$=id=>document.getElementById('eq_'+id),num=id=>Number.parseFloat($(id).value),val=id=>$(id).value;
const fmt=(n,d=3)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
let current=null;
function input(){const p={zone:val('zone'),importance:val('importance'),hazardMode:val('hazardMode'),mapS:num('mapS'),soil:val('soil'),depthMode:val('depthMode'),depth:num('depth'),vs:num('vs'),height:num('height'),weight:num('weight'),correction:val('correction')==='yes'};for(const a of ['x','y'])p[a]={system:val(a+'_system'),periodType:val(a+'_periodType'),periodMode:val(a+'_periodMode'),period:num(a+'_period'),infill:val(a+'_infill')==='yes',Vt:num(a+'_Vt')};return p;}
const dl=rows=>'<dl class="beam-values">'+rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')+'</dl>';
function plot(){
 const r=current;if(!r)return;
 const max=Math.max(6,Math.ceil(Math.max(r.x.T,r.y.T)*1.15)),t=Math.max(0,Math.min(max,num('probe')||0));$('probe').max=String(max);
 const x=v=>58+v/max*708,y=v=>264-v/(r.SDS*1.2)*222;
 const pts=[0,r.T0,r.Ts,5,max];for(let i=0;i<=240;i++)pts.push(max*i/240);pts.sort((a,b)=>a-b);
 let grid='';for(let i=0;i<=5;i++){const v=max*i/5;grid+=`<path d="M${x(v)} 35V264" stroke="var(--line)"/><text x="${x(v)}" y="286" text-anchor="middle">${fmt(v,1)}</text>`;const sa=r.SDS*i/4;if(i<5)grid+=`<path d="M58 ${y(sa)}H766" stroke="var(--line)"/><text x="50" y="${y(sa)+4}" text-anchor="end">${fmt(sa,2)}</text>`;}
 const path=pts.map((v,i)=>`${i?'L':'M'}${x(v).toFixed(2)},${y(E.spectrum(v,r)).toFixed(2)}`).join(' ');
 const marks=[['T₀',r.T0],['Tₛ',r.Ts],['Tₗ',5]].map(([s,v])=>`<path d="M${x(v)} 36V264" stroke="var(--dim)" stroke-dasharray="3 5" opacity=".5"><title>${s} = ${fmt(v)} s</title></path>`).join('');
 const axes=['x','y'].map((a,i)=>`<path d="M${x(r[a].T)} 35V264" stroke="${i?'#cb732d':'var(--accent)'}" stroke-dasharray="5 4"/><text x="${x(r[a].T)+5}" y="${16+i*16}" fill="${i?'#cb732d':'var(--accent)'}">${a.toUpperCase()} · ${fmt(r[a].T)} s</text>`).join('');
 $('plot').innerHTML=`<svg viewBox="0 0 800 320" role="img" aria-label="설계응답스펙트럼 그래프"><text x="8" y="18">Sa (g)</text>${grid}${marks}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3"/>${axes}<path d="M${x(t)} 35V264" stroke="var(--ok)"/><circle cx="${x(t)}" cy="${y(E.spectrum(t,r))}" r="5" fill="var(--ok)"/><text x="764" y="309" text-anchor="end">주기 T (s)</text></svg>`;
 $('probe_result').textContent=`T = ${fmt(t)} s → Sa = ${fmt(E.spectrum(t,r),4)} g · T₀ = ${fmt(r.T0)} s / Tₛ = ${fmt(r.Ts)} s / Tₗ = 5 s`;
}
function render(){
 const p=input();
 $('map_wrap').hidden=p.hazardMode!=='map';$('ground_wrap').hidden=p.depthMode==='unknown';$('dynamic_wrap').hidden=!p.correction;
 for(const a of ['x','y']){const s=E.SYSTEMS.find(s=>s.id===p[a].system);$(a+'_coefficients').textContent=s?`${s.group} / ${s.name} · R = ${s.R} · Ω₀ = ${s.omega} · Cd = ${s.Cd}`:'';$(a+'_period_wrap').hidden=p[a].periodMode!=='analysis';$(a+'_infill_wrap').hidden=!['rc','steel'].includes(p[a].periodType);}
 const r=E.calculate(p);current=r.valid?r:null;$('error').hidden=r.valid;$('results').hidden=!r.valid;
 if(!r.valid){$('error').textContent=r.errors.join(' ');for(const id of ['summary','plot','axes','ground','limits','basis','probe_result'])$(id).innerHTML='';return;}
 $('error').textContent='';
 $('summary').innerHTML=`<div class="eq-metrics"><div class="eq-metric">단주기 SDS<strong>${fmt(r.SDS,4)} <small>g</small></strong></div><div class="eq-metric">1초주기 SD1<strong>${fmt(r.SD1,4)} <small>g</small></strong></div><div class="eq-metric">내진설계범주<strong>${r.categories.governing}</strong><small>내진등급 ${p.importance==='special'?'특':p.importance} · IE ${r.IE}</small></div></div><div class="eq-axis-summary">`+['x','y'].map(a=>`<div><h3>${a.toUpperCase()} 방향</h3><p>밑면전단력 V<br><strong>${fmt(r[a].V,1)}</strong> kN</p><p>지진응답계수 Cs = ${fmt(r[a].Cs,5)}</p><p>${p.correction?`보정계수 Cm = <b>${fmt(r[a].Cm,3)}</b> · ${r[a].Cm>1?'증대 적용':'추가 보정 없음'}`:'동적해석 보정 검토 안 함'}</p>${!r[a].limitOK?'<p class="ng">시스템·높이 제한 미충족</p>':''}</div>`).join('')+'</div>';
 const rows=[['약산주기 Ta (s)',a=>fmt(a.Ta)],['주기상한 Cu·Ta (s)',a=>fmt(a.cap)],['적용주기 T (s)',a=>fmt(a.T)+(a.periodCapped?' · 상한 적용':'')],['Cs 기본값 · SDS·IE/R',a=>fmt(a.plateau,5)],['Cs 주기별 상한',a=>fmt(a.periodTerm,5)],['Cs 하한 · max(0.044·SDS·IE, 0.01)',a=>fmt(a.minimum,5)],['적용 Cs',a=>`<b>${fmt(a.Cs,5)}</b>`],['등가정적 밑면전단력 V (kN)',a=>fmt(a.V,2)],['동적해석 입력 Vt (kN)',a=>fmt(a.Vt,2)],['보정 기준 0.85V (kN)',a=>p.correction?fmt(.85*a.V,2):'—'],['보정비 0.85V/Vt',a=>fmt(a.raw,4)],['적용 보정계수 Cm ≥ 1.0',a=>`<b>${fmt(a.Cm,4)}</b>`],['보정 후 동적 밑면전단력 Cm·Vt (kN)',a=>fmt(a.corrected,2)]];
 $('axes').innerHTML='<table class="beam-table"><thead><tr><th>검토 항목</th><th>X 방향</th><th>Y 방향</th></tr></thead><tbody>'+rows.map(([s,f])=>`<tr><td>${s}</td><td>${f(r.x)}</td><td>${f(r.y)}</td></tr>`).join('')+'</tbody></table><p class="beam-muted">Cm = max(1, 0.85V/Vt). 보정 후 Vt가 등가정적 V와 같아야 하는 것은 아닙니다.</p>';
 $('ground').innerHTML=dl([['지진구역 기준 S = 2Z',fmt(r.zoneS,3)+' g'],['적용 S',fmt(r.S,4)+' g'+(p.hazardMode==='map'&&p.mapS<.8*r.zoneS?' · 지도 값에 80% 하한 적용':'')],['표에서 보간한 Fa / Fv',fmt(r.baseFa)+' / '+fmt(r.baseFv)],['적용 Fa / Fv',fmt(r.Fa)+' / '+fmt(r.Fv)],['지반 보정',r.reduce?'Fv × 0.8':r.amplify?'S5 · 깊이 불분명: Fa·Fv × 1.1':'추가 보정 없음'],['주기상한계수 Cu',fmt(r.Cu,4)],['SDS 기준 / SD1 기준 범주',r.categories.sds+' / '+r.categories.sd1]]);
 $('limits').innerHTML=['x','y'].map(a=>{const q=r[a],lim=q.limit===null?'표의 높이 제한 없음':q.limit==='prohibited'?'해당 범주에서 사용 불가':fmt(q.limit,0)+' m 이하';return `<p><b>${a.toUpperCase()} · ${q.system.group} / ${q.system.name}</b><br>${lim} · <span class="${q.limitOK?'ok':'ng'}">${q.limitOK?'표의 제한 충족':'표의 제한 미충족'}</span></p>`;}).join('');
 $('basis').innerHTML=dl([['지진구역 / 내진등급',p.zone+' / '+(p.importance==='special'?'특':p.importance)],['지반 / 깊이 / 평균 Vs',p.soil+' / '+(p.depthMode==='unknown'?'불분명':fmt(p.depth,1)+' m / '+fmt(p.vs,1)+' m/s')],['높이 hn / 중량 W',fmt(p.height,2)+' m / '+fmt(p.weight,2)+' kN'],...['x','y'].map(a=>[a.toUpperCase()+' 주기 입력',E.PERIODS[p[a].periodType].name+' · '+(p[a].periodMode==='analysis'?'해석 '+fmt(p[a].period)+' s':'약산식')+(r[a].infill?' · 채움벽 2/3 적용':'')])])+`<ul class="beam-basis"><li>3.2: 구역 방식 S = 2Z / 지도 방식 S = max(S지도, 0.8 × 2Z).</li><li>4.2.2~4.2.3: SDS = 2S·2.5Fa/3, SD1 = 2S·Fv/3. Fa·Fv는 S의 중간값을 직선보간합니다.</li><li>5.2: SDS와 SD1에 따른 내진설계범주 중 더 엄격한 범주를 적용합니다.</li><li>7.2.3~7.2.4: Ta = Ct·hnˣ. 약산 모드는 T = Ta, 해석 모드는 T = min(T해석, Cu·Ta). 해석주기를 Ta까지 올리는 하한은 적용하지 않습니다.</li><li>7.2.2: Cs = max[0.044·SDS·IE, 0.01, min(SDS·IE/R, 주기별 상한)]. T ≤ 5 s이면 상한은 SD1·IE/(R·T), T > 5 s이면 SD1·5·IE/(R·T²).</li><li>7.2.1: V = Cs·W. 입력 W의 단위는 kN입니다.</li><li>7.3.3.5: Cm = max(1, 0.85V/Vt). 층간변위에는 적용하지 않습니다.</li></ul>`;
 plot();
}
for(const id of ['zone','importance','hazardMode','mapS','soil','depthMode','depth','vs','height','weight','correction',...['x','y'].flatMap(a=>['system','periodType','periodMode','period','infill','Vt'].map(k=>a+'_'+k))]){ $(id).addEventListener('input',render);$(id).addEventListener('change',render);}
$('probe').addEventListener('input',plot);
$('plot').addEventListener('click',e=>{if(!current)return;const svg=$('plot').querySelector('svg');if(!svg)return;const rect=svg.getBoundingClientRect();const max=Number($('probe').max),t=((e.clientX-rect.left)/rect.width*800-58)/708*max;$('probe').value=String(Math.max(0,Math.min(max,t)));plot();});
render();
})();
