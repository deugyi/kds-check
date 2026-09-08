(function(){
'use strict';
const get=id=>document.getElementById(id);
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const num=id=>{const v=get(id).value.trim();return v===''?NaN:Number(v);};
const int=id=>{const v=num(id);return Number.isFinite(v)?Math.round(v):v;};
function read(){
  return {shape:get('c_shape').value,tie:get('c_tie').value,
    fck:num('c_fck'),fy:num('c_fy'),fyt:num('c_fyt'),
    b:num('c_b'),h:num('c_h'),D:num('c_dia'),
    n:int('c_n'),rows:int('c_rows'),bar:get('c_bar').value,
    hoop:get('c_hoop').value,cover:num('c_cover'),spacing:num('c_spacing'),
    Pu:num('c_pu'),Mux:num('c_mux'),Muy:num('c_muy'),
    concretePrice:num('c_cprice')*10000,steelPrice:num('c_sprice')*10000,wastePercent:num('c_waste')};
}
/* One interaction diagram per axis, from pure flexure up to the axial cap. */
function chart(a,Pu){
  const W=560,H=380,ML=74,MR=24,MT=20,MB=48;
  const pts=a.curve.filter(q=>q.Pn>=0||q.phiPn>=0);
  const Mmax=Math.max(...pts.map(q=>q.Mn),a.demand.phiMn,a.demand.Mu)*1.08;
  const Pmax=Math.max(a.axial.Po,Pu||0)*1.04;
  const X=m=>ML+(m/Mmax)*(W-ML-MR),Y=v=>H-MB-(v/Pmax)*(H-MT-MB);
  const path=(sel,f)=>pts.filter(f).map((q,i)=>`${i?'L':'M'}${X(sel(q)[0]).toFixed(1)} ${Y(sel(q)[1]).toFixed(1)}`).join('');
  const grid=[];
  for(let i=0;i<=4;i++){
    const v=Pmax*i/4,m=Mmax*i/4;
    grid.push(`<line x1="${ML}" x2="${W-MR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/>`,
      `<text class="ax" x="${ML-8}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${fmt(v,0)}</text>`,
      `<line x1="${X(m).toFixed(1)}" x2="${X(m).toFixed(1)}" y1="${MT}" y2="${H-MB}" stroke="var(--line)"/>`,
      `<text class="ax" x="${X(m).toFixed(1)}" y="${H-MB+18}" text-anchor="middle">${fmt(m,0)}</text>`);
  }
  const mark=(m,v,cls,label)=>`<g class="pt ${cls}"><circle cx="${X(m).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4"/><text x="${(X(m)+7).toFixed(1)}" y="${(Y(v)-6).toFixed(1)}">${label}</text></g>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${a.label} 상관도. 소요점 (${fmt(a.demand.Mu,0)} kN·m, ${fmt(Pu,0)} kN)은 ${a.demand.ok?'내부':'밖'}">`+
    grid.join('')+
    `<path class="curve nominal" d="${path(q=>[q.Mn,Math.min(q.Pn,Pmax)],q=>q.Pn>=0)}"/>`+
    `<path class="curve design" d="${path(q=>[q.phiMn,q.phiPn],q=>q.phiPn>=0)}"/>`+
    `<line class="cap" x1="${ML}" x2="${W-MR}" y1="${Y(a.axial.phiPnMax).toFixed(1)}" y2="${Y(a.axial.phiPnMax).toFixed(1)}"/>`+
    mark(a.balanced.phi*a.balanced.Mn,Math.min(a.balanced.phi*a.balanced.Pn,a.axial.phiPnMax),'key','균형점')+
    mark(a.flexure.phi*a.flexure.Mn,0,'key','순수휨')+
    `<g class="pt ${a.demand.ok?'ok':'ng'}"><circle cx="${X(a.demand.Mu).toFixed(1)}" cy="${Y(Pu||0).toFixed(1)}" r="5.5"/><text x="${(X(a.demand.Mu)+9).toFixed(1)}" y="${(Y(Pu||0)+15).toFixed(1)}">(Mu, Pu)</text></g>`+
    `<line x1="${ML}" x2="${W-MR}" y1="${H-MB}" y2="${H-MB}" stroke="var(--ink)"/><line x1="${ML}" x2="${ML}" y1="${MT}" y2="${H-MB}" stroke="var(--ink)"/>`+
    `<text class="ax" x="${(ML+(W-ML-MR)/2).toFixed(0)}" y="${H-8}" text-anchor="middle">M (kN·m)</text>`+
    `<text class="ax" x="16" y="${(MT+(H-MT-MB)/2).toFixed(0)}" text-anchor="middle" transform="rotate(-90 16 ${(MT+(H-MT-MB)/2).toFixed(0)})">P (kN)</text></svg>`;
}
// Section looking along the member axis, with bars at their real positions.
function sectionView(p,o){
  const W=280,H=280,M=32;
  const bw=p.shape==='circle'?p.D:p.b,bh=p.shape==='circle'?p.D:p.h;
  const scale=Math.min((W-2*M)/bw,(H-2*M)/bh);
  const cx=W/2,cy=H/2,r=BARR(o.geo.bar.d*scale/2);
  const outline=p.shape==='circle'
    ?`<circle cx="${cx}" cy="${cy}" r="${(p.D/2*scale).toFixed(1)}" fill="var(--code)" stroke="var(--ink)"/>`
    :`<rect x="${(cx-bw/2*scale).toFixed(1)}" y="${(cy-bh/2*scale).toFixed(1)}" width="${(bw*scale).toFixed(1)}" height="${(bh*scale).toFixed(1)}" fill="var(--code)" stroke="var(--ink)"/>`;
  const hoopLine=p.shape==='circle'
    ?`<circle cx="${cx}" cy="${cy}" r="${((p.D/2-p.cover-o.geo.hoop.d/2)*scale).toFixed(1)}" fill="none" stroke="var(--dim)" stroke-width="${Math.max(1,o.geo.hoop.d*scale)}"/>`
    :`<rect x="${(cx-(bw/2-p.cover-o.geo.hoop.d/2)*scale).toFixed(1)}" y="${(cy-(bh/2-p.cover-o.geo.hoop.d/2)*scale).toFixed(1)}" width="${((bw-2*p.cover-o.geo.hoop.d)*scale).toFixed(1)}" height="${((bh-2*p.cover-o.geo.hoop.d)*scale).toFixed(1)}" fill="none" stroke="var(--dim)" stroke-width="${Math.max(1,o.geo.hoop.d*scale)}"/>`;
  const bars=o.geo.bars.map(b=>`<circle cx="${(cx+b.x*scale).toFixed(1)}" cy="${(cy-b.y*scale).toFixed(1)}" r="${r}" fill="var(--accent)"/>`).join('');
  const dim=p.shape==='circle'
    ?`<text class="ax" x="${cx}" y="${(cy+bh/2*scale+20).toFixed(0)}" text-anchor="middle">D = ${fmt(p.D,0)} mm</text>`
    :`<text class="ax" x="${cx}" y="${(cy+bh/2*scale+20).toFixed(0)}" text-anchor="middle">b = ${fmt(p.b,0)} mm</text>`+
     `<text class="ax" x="${(cx+bw/2*scale+16).toFixed(0)}" y="${cy}" text-anchor="middle" transform="rotate(90 ${(cx+bw/2*scale+16).toFixed(0)} ${cy})">h = ${fmt(p.h,0)} mm</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${p.shape==='circle'?`지름 ${fmt(p.D,0)} mm 원형`:`${fmt(p.b,0)} × ${fmt(p.h,0)} mm 사각`} 단면, 주철근 ${p.n}-${p.bar}, ${RCColumn.TIES[p.tie].label} ${p.hoop}@${fmt(p.spacing,0)}">`+
    outline+hoopLine+bars+dim+
    `<text class="ax" x="${(cx-bw/2*scale).toFixed(0)}" y="${(cy-bh/2*scale-8).toFixed(0)}">${p.n}-${p.bar}</text></svg>`;
}
const BARR=v=>Math.max(2.4,v).toFixed(1);
function renderSummary(p,o){
  const Pu=p.Pu||0;
  const rows=o.axes.map(a=>`<tr><td>${a.label}</td><td>${fmt(a.demand.Mu,1)}</td><td>${fmt(a.demand.phiMn,1)}</td><td>${fmt(a.demand.phiPn,1)}</td><td>${a.demand.ratioP===null?'—':fmt(a.demand.ratioP,3)}</td><td>${fmt(a.demand.ratioM,3)}</td><td class="${a.demand.ok?'ok':'ng'}">${a.demand.ok?'충족':'미달'}</td></tr>`).join('');
  get('c_summary').innerHTML=`<p class="${o.ok?'ok':'ng'}" style="font-size:19px">${o.ok?'모든 검토 방향에서 (Mu, Pu)가 상관도 내부 — 충족':'상관도를 벗어난 방향이 있습니다 — 미달'}</p>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>검토 방향</th><th>Mu (kN·m)</th><th>φMn (kN·m)</th><th>φPn (kN)</th><th>Pu/φPn</th><th>Mu/φMn</th><th>판정</th></tr></thead><tbody>${rows}</tbody></table></div>`+
    `<dl class="beam-values"><div><dt>전체 철근량 Ast</dt><dd>${fmt(o.Ast,1)} mm² · ρ = ${fmt(100*o.rho,3)}%</dd></div>`+
    `<div><dt>단면적 Ag</dt><dd>${fmt(o.Ag,0)} mm²</dd></div>`+
    `<div><dt>소요축력 Pu</dt><dd>${fmt(Pu,1)} kN</dd></div></dl>`+
    `<p class="beam-muted">${p.shape==='circle'?'원형 단면은 축대칭이라 휨 방향과 무관하게 한 번만 검토합니다. Mux·Muy 중 큰 값을 씁니다.':'각 축을 <b>독립적으로</b> 검토합니다. 두 방향 휨이 동시에 작용하는 2축 휨(4.5)은 다루지 않습니다.'}</p>`+
    (o.notes.length?`<ul class="beam-basis">${o.notes.map(n=>`<li class="warn">${n}</li>`).join('')}</ul>`:'');
}
function renderAxes(p,o){
  const Pu=p.Pu||0;
  get('c_axes').innerHTML=o.axes.map(a=>{
    const pt=(name,r,extra)=>`<tr><td>${name}</td><td>${fmt(r.c,2)}</td><td>${fmt(r.et,5)}</td><td>${fmt(r.phi,3)}</td><td>${fmt(r.phi*r.Pn,1)}</td><td class="beam-phi">${fmt(r.phi*r.Mn,2)}</td></tr>`;
    return `<div class="card"><h2>${a.label}</h2>`+
      `<p class="beam-muted">깊이 ${fmt(a.depth,0)} mm · 폭 ${fmt(a.width,0)} mm · 철근 ${a.lay.length}단 · dt = ${fmt(a.dt,1)} mm</p>`+
      chart(a,Pu)+
      `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>검토점</th><th>c (mm)</th><th>εt</th><th>φ</th><th>φPn (kN)</th><th>φMn (kN·m)</th></tr></thead><tbody>`+
      `<tr><td>중심축하중</td><td>—</td><td>—</td><td>${fmt(a.axial.phi0,2)}</td><td class="beam-phi">${fmt(a.axial.phiPnMax,1)}</td><td>0.00</td></tr>`+
      pt('균형변형률',a.balanced)+pt('순수휨',a.flexure)+pt('소요점',a.demand)+
      `</tbody></table></div>`+
      `<p class="beam-muted">Po = ${fmt(a.axial.Po,1)} kN · φPn,max = ${fmt(a.axial.phiPnMax,1)} kN (${a.axial.clause}) · ${a.demand.zone}${a.demand.capped?' · φPn,max 지배':''}${a.demand.pure?' · Pu = 0이므로 순수휨':` · e = ${fmt(a.demand.e,1)} mm`}</p></div>`;
  }).join('');
}
function renderTransverse(p,o){
  const t=o.transverse,ties=RCColumn.TIES[p.tie];
  let body=`<p class="${t.ok?'ok':'warn'}">${t.ok?'횡보강 상세 조건 충족':t.reasons.join(' / ')}</p>`+
    `<dl class="beam-values"><div><dt>형식 · 규격 · 간격</dt><dd>${ties.label} ${p.hoop}@${fmt(p.spacing,0)} mm</dd></div>`+
    `<div><dt>주철근 최소 개수</dt><dd>${ties.minBars}개 · 배치 ${p.n}개</dd></div>`+
    `<div><dt>요구 최소 규격</dt><dd>${t.minHoop} 이상</dd></div>`;
  if(t.maxSpacing!==null)body+=`<div><dt>띠철근 최대 간격</dt><dd>${fmt(t.maxSpacing,1)} mm</dd></div>`;
  if(t.spiral)body+=`<div><dt>나선철근비 ρs</dt><dd>배치 ${fmt(t.spiral.provided,5)} / 소요 ${fmt(t.spiral.required,5)}</dd></div>`+
    `<div><dt>심부 지름 Dch</dt><dd>${fmt(t.spiral.Dch,1)} mm · Ach = ${fmt(t.spiral.Ach,0)} mm²</dd></div>`;
  body+=`</dl>`;
  if(t.limits)body+=`<p class="beam-muted">최대 간격 = min(${t.limits.map(l=>`${l.why} ${fmt(l.v,1)}`).join(', ')}) mm (KDS 14 20 50, 4.4.2(3)②).</p>`;
  if(t.spiral)body+=`<p class="beam-muted">ρs ≥ 0.45(Ag/Ach − 1)·fck/fyt (KDS 14 20 20, 식 4.3-1). fyt ≤ 700 MPa이며 400 MPa 초과 시 겹침이음을 할 수 없습니다.</p>`;
  body+=`<p class="beam-muted">횡보강은 상세와 물량만 반영하며 <b>횡구속에 의한 강도·연성 증가(4.1.1(9))는 P-M에 산입하지 않습니다.</b> 전단 검토는 대상이 아닙니다.</p>`;
  get('c_transverse').innerHTML=body;
}
function renderQuantities(p,o){
  const q=o.quantities,won=v=>fmt(v/10000,2);
  get('c_quantities').innerHTML=`<table class="beam-quantity-table"><thead><tr><th>항목</th><th>1m당 물량</th><th>단가 (만원)</th><th>금액 (만원)</th></tr></thead><tbody>`+
    `<tr><td>콘크리트</td><td>${fmt(q.concrete,4)} m³</td><td>${fmt(p.concretePrice/10000,2)}</td><td>${won(q.concreteCost)}</td></tr>`+
    `<tr><td>주철근 ${p.n}-${p.bar}</td><td>${fmt(q.main,5)} tonf</td><td>${fmt(p.steelPrice/10000,2)}</td><td>${won(q.main*p.steelPrice)}</td></tr>`+
    `<tr><td>${RCColumn.TIES[p.tie].label} ${p.hoop}@${fmt(p.spacing,0)}</td><td>${fmt(q.hoop,5)} tonf</td><td>${fmt(p.steelPrice/10000,2)}</td><td>${won(q.hoop*p.steelPrice)}</td></tr>`+
    `<tr><td>철근 할증 ${fmt(p.wastePercent,1)}%</td><td>${fmt(q.steel-q.net,5)} tonf</td><td>${fmt(p.steelPrice/10000,2)}</td><td>${won((q.steel-q.net)*p.steelPrice)}</td></tr>`+
    `<tr><th>철근 합계</th><th>${fmt(q.steel,5)} tonf</th><th>—</th><th>${won(q.steelCost)}</th></tr>`+
    `</tbody></table><p class="beam-quantity-total">합계 ${won(q.totalCost)} 만원 / m</p>`+
    `<p class="beam-muted">횡보강근 ${fmt(q.stations,3)}조/m × 1조 ${fmt(q.cut,1)} mm. ${p.shape==='circle'?'원형은 심부 둘레 1회전 길이입니다.':'외곽 폐쇄형 1개에 135° 갈고리 연장 max(6dt, 75 mm) 2개를 더한 개산값입니다.'} 콘크리트는 철근 체적을 공제하지 않은 총체적이고, 철근 밀도는 7,850 kg/m³입니다. 겹침이음·정착·가공 상세와 거푸집·노무·부가세는 별도입니다.</p>`;
}
function renderBasis(p,o){
  get('c_basis').innerHTML=`<ul class="beam-basis">`+
    `<li>단면력은 변형률 적합으로 산정합니다. εs = εcu(c − d)/c, fs = Es·εs (|fs| ≤ fy), Es = 200,000 MPa. 압축블록 안의 철근은 fs에서 η·0.85fck를 공제합니다.</li>`+
    `<li>응력블록 변수는 KDS 14 20 20 표 4.1-2이며 표에 없는 fck는 직선보간합니다. φ는 4.1.2(3)(4)와 KDS 14 20 10 4.2.3(2)에 따릅니다.</li>`+
    `<li>Po = 0.85fck(Ag − Ast) + fy·Ast, φPn,max = ${fmt(o.axes[0].axial.k,2)} × ${fmt(o.axes[0].axial.phi0,2)} × Po (4.1.2(7), ${o.axes[0].axial.clause}).</li>`+
    `<li>${p.shape==='circle'?'원형 단면의 압축영역은 활꼴로 적분해 면적과 도심을 구합니다.':'주철근은 둘레 배근으로 총 개수와 행 수에서 위치를 정하고, 각 축 검토마다 해당 방향 좌표로 다시 층을 묶습니다.'}</li>`+
    `<li>철근비 0.01 ≤ ρ ≤ 0.08, 겹침이음 구간 ρ ≤ 0.04 (4.3.2(1)). 주철근 최소 개수는 띠철근 4개, 나선철근 6개 (4.3.2(2)).</li>`+
    `</ul><details class="beam-settings"><summary>검토하지 않은 항목</summary><ul class="beam-basis">`+
    `<li><b>2축 휨 (4.5)</b> — 두 방향 휨이 <b>동시에</b> 작용하는 경우는 다루지 않습니다. 이 화면은 X축·Y축을 각각 독립적으로 검토합니다.</li>`+
    `<li><b>장주효과 (4.4)</b> — 세장비와 모멘트 확대를 다루지 않습니다. <b>Mu는 확대계수휨모멘트를 입력</b>해야 합니다.</li>`+
    `<li>횡구속에 의한 강도·연성 증가 (4.1.1(9)), 전단·비틀림, 정착·이음, 내진 특수규정</li>`+
    `<li>단면은 직사각형과 원형만 지원합니다. 나선철근은 원형 단면에만 적용합니다.</li>`+
    `<li>물량은 개산값입니다. 겹침이음·정착·갈고리 가공 상세를 반영하지 않습니다.</li>`+
    `</ul></details>`;
}
function update(){
  get('c_error').hidden=true;
  const circle=get('c_shape').value==='circle';
  get('c_rect_field').hidden=circle;
  get('c_circle_field').hidden=!circle;
  get('c_rows_field').hidden=circle;
  get('c_muy_field').hidden=circle;
  try{
    const p=read(),o=RCColumn.calculate(p);
    get('c_results').hidden=false;
    get('c_diagram').innerHTML=sectionView(p,o);
    renderSummary(p,o);renderAxes(p,o);renderTransverse(p,o);renderQuantities(p,o);renderBasis(p,o);
  }catch(e){
    get('c_results').hidden=true;get('c_error').hidden=false;get('c_error').textContent=e.message;
    for(const id of ['c_diagram','c_summary','c_axes','c_transverse','c_quantities','c_basis'])get(id).innerHTML='';
  }
}
get('c_print').addEventListener('click',()=>{
  const closed=[...document.querySelectorAll('#t2 details')].filter(d=>!d.open);
  closed.forEach(d=>{d.open=true;});
  const restore=()=>{closed.forEach(d=>{d.open=false;});window.removeEventListener('afterprint',restore);};
  window.addEventListener('afterprint',restore);
  window.print();
});
get('t2').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
update();
})();
