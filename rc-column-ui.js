(function(){
'use strict';
const get=id=>document.getElementById(id);
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const num=id=>{const v=get(id).value.trim();return v===''?NaN:Number(v);};
const int=id=>{const v=num(id);return Number.isFinite(v)?Math.round(v):v;};
let current=null;
function read(){
  return {fck:num('c_fck'),fy:num('c_fy'),tie:get('c_tie').value,
    b:num('c_b'),h:num('c_h'),mode:get('c_mode').value,dp:num('c_dp'),d:num('c_d'),
    asp:num('c_asp'),as:num('c_as'),nx:int('c_nx'),ny:int('c_ny'),ab:num('c_ab'),
    Pu:num('c_pu'),Mu:num('c_mu')};
}
/* Interaction diagram. Plotted from pure flexure up to the axial cap, which is
 * the range a column check actually uses; the pure-tension branch is dropped. */
function chart(p,o){
  const W=640,H=440,ML=78,MR=26,MT=22,MB=54;
  const pts=o.curve.filter(q=>q.Pn>=0||q.phiPn>=0);
  const Mmax=Math.max(...pts.map(q=>q.Mn),o.demand.phiMn,p.Mu)*1.08;
  // The nominal curve tops out at Po, so that is the natural axis top.
  const Pmax=Math.max(o.axial.Po,p.Pu||0)*1.04;
  const X=m=>ML+(m/Mmax)*(W-ML-MR),Y=v=>H-MB-(v/Pmax)*(H-MT-MB);
  const path=(sel,f)=>pts.filter(f).map((q,i)=>`${i?'L':'M'}${X(sel(q)[0]).toFixed(1)} ${Y(sel(q)[1]).toFixed(1)}`).join('');
  const nominal=path(q=>[q.Mn,Math.min(q.Pn,Pmax)],q=>q.Pn>=0);
  const design=path(q=>[q.phiMn,q.phiPn],q=>q.phiPn>=0);
  const grid=[];
  for(let i=0;i<=4;i++){
    const v=Pmax*i/4,m=Mmax*i/4;
    grid.push(`<line x1="${ML}" x2="${W-MR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/>`);
    grid.push(`<text class="ax" x="${ML-8}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${fmt(v,0)}</text>`);
    grid.push(`<line x1="${X(m).toFixed(1)}" x2="${X(m).toFixed(1)}" y1="${MT}" y2="${H-MB}" stroke="var(--line)"/>`);
    grid.push(`<text class="ax" x="${X(m).toFixed(1)}" y="${H-MB+18}" text-anchor="middle">${fmt(m,0)}</text>`);
  }
  const mark=(m,v,cls,label)=>`<g class="pt ${cls}"><circle cx="${X(m).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5"/><text x="${(X(m)+8).toFixed(1)}" y="${(Y(v)-7).toFixed(1)}">${label}</text></g>`;
  const key=[
    mark(o.balanced.phi*o.balanced.Mn,Math.min(o.balanced.phi*o.balanced.Pn,o.axial.phiPnMax),'key','균형점'),
    mark(o.tensionPoint.phi*o.tensionPoint.Mn,Math.max(0,o.tensionPoint.phi*o.tensionPoint.Pn),'key','인장지배 한계'),
    mark(o.flexure.phi*o.flexure.Mn,0,'key','순수휨')
  ].join('');
  const demand=`<g class="pt ${o.demand.ok?'ok':'ng'}"><circle cx="${X(p.Mu).toFixed(1)}" cy="${Y(p.Pu||0).toFixed(1)}" r="6"/><text x="${(X(p.Mu)+10).toFixed(1)}" y="${(Y(p.Pu||0)+16).toFixed(1)}">(Mu, Pu)</text></g>`;
  const cap=`<line class="cap" x1="${ML}" x2="${W-MR}" y1="${Y(o.axial.phiPnMax).toFixed(1)}" y2="${Y(o.axial.phiPnMax).toFixed(1)}"/>`+
    `<text class="ax cap-label" x="${W-MR}" y="${(Y(o.axial.phiPnMax)-7).toFixed(1)}" text-anchor="end">φPn,max ${fmt(o.axial.phiPnMax,0)} kN</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="φPn – φMn 상관도. φPn,max ${fmt(o.axial.phiPnMax,0)} kN, 소요점 (${fmt(p.Mu,0)} kN·m, ${fmt(p.Pu,0)} kN)은 ${o.demand.ok?'상관도 내부':'상관도 밖'}">`+
    grid.join('')+
    `<path class="curve nominal" d="${nominal}"/><path class="curve design" d="${design}"/>${cap}${key}${demand}`+
    `<line x1="${ML}" x2="${W-MR}" y1="${H-MB}" y2="${H-MB}" stroke="var(--ink)"/><line x1="${ML}" x2="${ML}" y1="${MT}" y2="${H-MB}" stroke="var(--ink)"/>`+
    `<text class="ax" x="${(ML+(W-ML-MR)/2).toFixed(0)}" y="${H-10}" text-anchor="middle">M (kN·m)</text>`+
    `<text class="ax" x="18" y="${(MT+(H-MT-MB)/2).toFixed(0)}" text-anchor="middle" transform="rotate(-90 18 ${(MT+(H-MT-MB)/2).toFixed(0)})">P (kN)</text></svg>`;
}
// Section looking along the member axis; d is measured from the compression face.
function sectionView(p,o){
  const s=o.sec,W=260,H=260,M=34;
  const scale=Math.min((W-2*M)/s.b,(H-2*M)/s.h);
  const w=s.b*scale,h=s.h*scale,x=(W-w)/2,y=(H-h)/2;
  const bars=s.lay.map(([As,d],i)=>{
    const cy=y+d*scale;
    if(p.mode!=='grid')return `<line x1="${x+8}" x2="${x+w-8}" y1="${cy.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="var(--accent)" stroke-width="3"/>`;
    const n=(i===0||i===s.lay.length-1)?p.nx:2,r=Math.max(2.2,Math.sqrt(p.ab/Math.PI)*scale);
    const edge=Math.max(x+10,x+ (p.dp*scale));
    const right=Math.min(x+w-10,x+w-p.dp*scale);
    return Array.from({length:n},(_,j)=>{
      const cx=n===1?x+w/2:edge+(right-edge)*j/(n-1);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="var(--accent)"/>`;
    }).join('');
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="단면 ${fmt(s.b,0)} × ${fmt(s.h,0)} mm, 철근 ${s.lay.length}단, Ast ${fmt(s.Ast,0)} mm²">`+
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--code)" stroke="var(--ink)"/>${bars}`+
    `<text class="ax" x="${(x+w/2).toFixed(0)}" y="${(y+h+20).toFixed(0)}" text-anchor="middle">b = ${fmt(s.b,0)} mm</text>`+
    `<text class="ax" x="${(x+w+16).toFixed(0)}" y="${(y+h/2).toFixed(0)}" text-anchor="middle" transform="rotate(90 ${(x+w+16).toFixed(0)} ${(y+h/2).toFixed(0)})">h = ${fmt(s.h,0)} mm</text>`+
    `<text class="ax" x="${x}" y="${(y-8).toFixed(0)}">압축연단</text></svg>`;
}
function renderSummary(p,o){
  const d=o.demand,t=RCColumn.TIES[p.tie];
  const rows=d.pure
    ?`<div><dt>Mu / φMn</dt><dd>${fmt(d.ratioM,3)}</dd></div>`
    :`<div><dt>Pu / φPn</dt><dd>${fmt(d.ratioP,3)}</dd></div><div><dt>Mu / φMn</dt><dd>${fmt(d.ratioM,3)}</dd></div>`;
  get('c_summary').innerHTML=`<p class="beam-capacity">${fmt(d.phiMn,2)} <small>kN·m</small></p><p>설계휨강도 φMn ${d.pure?'(순수휨)':`· 편심 e = ${fmt(d.e,1)} mm 에서`}</p>`+
    `<p class="${d.ok?'ok':'ng'}">${d.ok?'(Mu, Pu)가 상관도 내부 — 충족':'(Mu, Pu)가 상관도 밖 — 미달'}</p>`+
    `<dl class="beam-values"><div><dt>설계축강도 φPn</dt><dd>${fmt(d.phiPn,1)} kN${d.capped?' <small>(φPn,max 지배)</small>':''}</dd></div>`+
    `<div><dt>중립축 c / 응력블록 a</dt><dd>${fmt(d.c,2)} / ${fmt(d.a,2)} mm</dd></div>`+
    `<div><dt>최외단 변형률 εt</dt><dd>${fmt(d.et,5)}</dd></div>`+
    `<div><dt>단면 구분</dt><dd>${d.zone}</dd></div>`+
    `<div><dt>강도감소계수 φ</dt><dd>${fmt(d.phi,4)}</dd></div>`+rows+`</dl>`+
    `<p class="beam-muted">${t.label} · φ0 = ${fmt(t.phi0,2)} · ${t.clause}. 소요점은 같은 편심 e = Mu/Pu 선상에서 상관도와 만나는 점으로 비교합니다.</p>`;
}
function renderPoints(p,o){
  const line=(name,r,extra)=>`<tr><td>${name}</td><td>${fmt(r.c,2)}</td><td>${fmt(r.et,5)}</td><td>${fmt(r.phi,3)}</td><td>${fmt(r.phi*r.Pn,1)}</td><td class="beam-phi">${fmt(r.phi*r.Mn,2)}</td><td>${extra||'—'}</td></tr>`;
  get('c_points').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>검토점</th><th>c (mm)</th><th>εt</th><th>φ</th><th>φPn (kN)</th><th>φMn (kN·m)</th><th>비고</th></tr></thead><tbody>`+
    `<tr><td>중심축하중</td><td>—</td><td>—</td><td>${fmt(o.axial.phi0,2)}</td><td class="beam-phi">${fmt(o.axial.phiPnMax,1)}</td><td>0.00</td><td>Po = ${fmt(o.axial.Po,1)} kN · ${o.axial.clause}</td></tr>`+
    line('균형변형률',o.balanced,o.balanced.eb!==null?`eb = ${fmt(o.balanced.eb,1)} mm`:'—')+
    line('인장지배 한계',o.tensionPoint,`εtl = ${fmt(o.etl,4)}`)+
    line('순수휨',o.flexure,'Pn = 0')+
    line('소요점',o.demand,o.demand.pure?'Pu = 0':`e = ${fmt(o.demand.e,1)} mm`)+
    `</tbody></table></div>`+
    `<p class="beam-muted">각 점은 변형률 적합으로 중립축 c를 찾아 산정합니다. φPn,max는 KDS 14 20 20 ${o.axial.clause}의 절단선이며 상관도 상단을 자릅니다.</p>`;
}
function renderBasis(p,o){
  const s=o.sec;
  get('c_basis').innerHTML=`<dl class="beam-values"><div><dt>단면 b × h</dt><dd>${fmt(s.b,0)} × ${fmt(s.h,0)} mm · Ag = ${fmt(s.Ag,0)} mm²</dd></div>`+
    `<div><dt>전체 철근량 Ast</dt><dd>${fmt(s.Ast,1)} mm² · ρ = ${fmt(100*s.rho,3)}%</dd></div>`+
    `<div><dt>철근 배치</dt><dd>${s.lay.length}단 · dt = ${fmt(s.dt,1)} mm</dd></div>`+
    `<div><dt>응력블록 변수</dt><dd>εcu ${fmt(o.params.ecu,5)} · η ${fmt(o.params.eta,3)} · β₁ ${fmt(o.params.beta,3)}</dd></div></dl>`+
    (o.notes.length?`<ul class="beam-basis">${o.notes.map(n=>`<li class="warn">${n}</li>`).join('')}</ul>`:'')+
    `<ul class="beam-basis">`+
    `<li>단면력은 변형률 적합으로 산정합니다. 각 단 εs = εcu(c − d)/c, fs = Es·εs (|fs| ≤ fy), Es = 200,000 MPa. 압축블록 안에 들어간 철근은 fs에서 η·0.85fck를 공제해 콘크리트 면적 중복을 제거합니다.</li>`+
    `<li>응력블록 변수는 KDS 14 20 20 표 4.1-2이며 표에 없는 fck는 직선보간합니다. φ는 4.1.2(3)(4)의 변형률 한계와 KDS 14 20 10 4.2.3(2)에 따릅니다.</li>`+
    `<li>Po = 0.85fck(Ag − Ast) + fy·Ast, φPn,max = ${fmt(o.axial.k,2)} × ${fmt(o.axial.phi0,2)} × Po (4.1.2(7), ${o.axial.clause}).</li>`+
    `<li>철근비 제한 0.01 ≤ ρ ≤ 0.08, 겹침이음 구간 ρ ≤ 0.04 (4.3.2(1)).</li>`+
    `</ul><details class="beam-settings"><summary>검토하지 않은 항목</summary><ul class="beam-basis">`+
    `<li><b>장주효과 (4.4)</b> — 세장비와 모멘트 확대를 다루지 않습니다. <b>Mu는 확대계수휨모멘트를 입력</b>해야 합니다.</li>`+
    `<li><b>2축 휨 (4.5)</b> — 한 방향 휨만 검토합니다.</li>`+
    `<li>전단·비틀림, 횡철근 상세와 간격, 정착·이음, 내진 특수규정</li>`+
    `<li>단면은 직사각형만 지원하며 철근은 입력한 단으로 이상화합니다. 원형·부정형 단면은 대상이 아닙니다.</li>`+
    `</ul></details>`;
}
function update(){
  get('c_error').hidden=true;
  const grid=get('c_mode').value==='grid';
  get('c_layers_field').hidden=grid;
  get('c_grid_field').hidden=!grid;
  try{
    const p=read(),o=RCColumn.calculate(p);
    current={p,o};
    get('c_results').hidden=false;
    get('c_pm').innerHTML=chart(p,o);
    get('c_diagram').innerHTML=sectionView(p,o);
    renderSummary(p,o);renderPoints(p,o);renderBasis(p,o);
  }catch(e){
    current=null;get('c_results').hidden=true;get('c_error').hidden=false;get('c_error').textContent=e.message;
    for(const id of ['c_pm','c_diagram','c_summary','c_points','c_basis'])get(id).innerHTML='';
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
