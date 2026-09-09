(function(){
'use strict';
const get=id=>document.getElementById(id);
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const num=id=>{const v=get(id).value.trim();return v===''?NaN:Number(v);};
function read(){
  const j=get('cb_J').value.trim(),edge=get('cb_edge').value.trim();
  const ks=SectionPicker.selected(get('cb_mode'),get('cb_sec'));
  return {H:num('cb_H'),B:num('cb_B'),tw:num('cb_tw'),tf:num('cb_tf'),
    Fy:num('cb_fy'),E:num('cb_e'),rolled:get('cb_mode').value==='ks',
    J:j!==''?Number(j):(ks&&ks.listed?ks.J:null),
    r:ks?ks.r:null,section:ks,
    span:num('cb_span'),spacing:num('cb_spacing'),edge:edge===''?null:Number(edge),
    ts:num('cb_ts'),hr:0,fck:num('cb_fck'),wc:num('cb_wc'),
    stud:get('cb_stud').value,Fu:num('cb_fu'),studsPerRow:num('cb_per_row'),studSpacing:num('cb_stud_spacing'),studTransverseSpacing:num('cb_transverse'),studLength:num('cb_slen'),
    Mu:num('cb_mu'),Vu:num('cb_vu'),MuConstruction:num('cb_mucon'),
    LbConstruction:num('cb_lbcon'),CbConstruction:num('cb_cbcon')};
}
function syncGrade(){
  const g=get('cb_gr').value;
  if(!g)return;
  const Fy=SteelSection.yieldStrength(g,num('cb_tf'));
  if(Fy)get('cb_fy').value=Fy;
}
/* Composite section with the plastic stress blocks drawn where they act. */
function sectionView(p,o){
  const W=340,Hs=280,M=30;
  const total=p.ts+p.H,width=Math.max(o.ew.be,p.B);
  const scale=Math.min((W-2*M)/width,(Hs-2*M)/total);
  const cx=W/2,top=(Hs-total*scale)/2;
  const slabY=top,steelTop=top+p.ts*scale;
  const be=o.ew.be*scale,bw=p.B*scale,tf=p.tf*scale,tw=p.tw*scale,h=p.H*scale;
  const a=o.plastic.a*scale;
  const steel='fill="var(--accent)" fill-opacity=".22" stroke="var(--accent)"';
  return `<svg viewBox="0 0 ${W} ${Hs}" role="img" aria-label="합성단면. 유효폭 ${fmt(o.ew.be,0)} mm, 슬래브 ${fmt(p.ts,0)} mm, H형강 ${fmt(p.H,0)}×${fmt(p.B,0)}. 압축블록 깊이 ${fmt(o.plastic.a,1)} mm">`+
    `<rect x="${(cx-be/2).toFixed(1)}" y="${slabY.toFixed(1)}" width="${be.toFixed(1)}" height="${(p.ts*scale).toFixed(1)}" fill="var(--code)" stroke="var(--ink)"/>`+
    `<rect x="${(cx-be/2).toFixed(1)}" y="${slabY.toFixed(1)}" width="${be.toFixed(1)}" height="${a.toFixed(1)}" fill="var(--ok)" fill-opacity=".28"/>`+
    `<rect x="${(cx-bw/2).toFixed(1)}" y="${steelTop.toFixed(1)}" width="${bw.toFixed(1)}" height="${tf.toFixed(1)}" ${steel}/>`+
    `<rect x="${(cx-bw/2).toFixed(1)}" y="${(steelTop+h-tf).toFixed(1)}" width="${bw.toFixed(1)}" height="${tf.toFixed(1)}" ${steel}/>`+
    `<rect x="${(cx-tw/2).toFixed(1)}" y="${(steelTop+tf).toFixed(1)}" width="${tw.toFixed(1)}" height="${(h-2*tf).toFixed(1)}" ${steel}/>`+
    (o.plastic.pna!==null?`<line class="cap" x1="${(cx-be/2).toFixed(1)}" x2="${(cx+be/2).toFixed(1)}" y1="${(steelTop+o.plastic.pna*scale).toFixed(1)}" y2="${(steelTop+o.plastic.pna*scale).toFixed(1)}"/>`:'')+
    `<text class="ax" x="${cx}" y="${(slabY-8).toFixed(0)}" text-anchor="middle">be = ${fmt(o.ew.be,0)} mm</text>`+
    `<text class="ax" x="${(cx-be/2+4).toFixed(0)}" y="${(slabY+a+12).toFixed(0)}">a = ${fmt(o.plastic.a,1)}</text>`+
    `<text class="ax" x="${cx}" y="${(steelTop+h+18).toFixed(0)}" text-anchor="middle">H-${fmt(p.H,0)}×${fmt(p.B,0)}×${fmt(p.tw,0)}×${fmt(p.tf,0)}</text></svg>`;
}
function renderSummary(p,o){
  get('cb_summary').innerHTML=sectionView(p,o)+
    `<p class="beam-capacity">${fmt(o.phiMn,2)} <small>kN·m</small></p><p>정모멘트 설계휨강도 φbMn · φb = 0.90</p>`+
    `<p class="${o.ok?'ok':'ng'}">${o.ok?'휨 · 전단 · 시공 중 · 입력 상세조건 충족':'미달 항목이 있습니다'}</p>`+
    `<dl class="beam-values"><div><dt>Mu / φbMn</dt><dd class="${o.okM?'ok':'ng'}">${fmt(p.Mu,1)} / ${fmt(o.phiMn,1)} = ${fmt(o.ratioM,3)}</dd></div>`+
    `<div><dt>소성중립축</dt><dd>${o.plastic.case}${o.plastic.pna!==null?` · 강재 상단에서 ${fmt(o.plastic.pna,2)} mm`:''}</dd></div>`+
    `<div><dt>압축블록 깊이 a</dt><dd>${fmt(o.plastic.a,2)} mm (슬래브 ${fmt(p.ts,0)} mm 이내)</dd></div>`+
    `<div><dt>합성률</dt><dd>${fmt(100*o.shearFlow.degree,1)}% · ${o.shearFlow.partial?'부분합성':'완전합성'}</dd></div></dl>`;
}
function renderShearFlow(p,o){
  const h=o.shearFlow,s=o.stud,d=o.detail;
  const row=(name,v,on)=>`<tr class="${on?'economical':''}"><td>${name}</td><td>${fmt(v,1)}</td><td>${on?'← 지배':''}</td></tr>`;
  get('cb_flow').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>한계상태</th><th>수평전단력 (kN)</th><th></th></tr></thead><tbody>`+
    row('콘크리트 압괴 0.85fck·Ac',h.concrete,h.governs==='콘크리트 압괴')+
    row('강재단면 인장항복 Fy·As',h.steel,h.governs==='강재단면 인장항복')+
    row(`강재 전단연결재 ΣQn (${o.layout.count}개)`,h.studs,h.governs==='강재 전단연결재')+
    `</tbody></table></div>`+
    `<dl class="beam-values"><div><dt>총 수평전단력 V′</dt><dd>${fmt(h.V,1)} kN</dd></div>`+
    `<div><dt>유효폭 be</dt><dd>${fmt(o.ew.be,0)} mm · 한쪽 ${fmt(o.ew.each,0)} mm (${o.ew.governs})</dd></div>`+
    `<div><dt>슬래브 단면적 Ac</dt><dd>${fmt(o.Ac,0)} mm²</dd></div>`+
    `<div><dt>스터드 1개 Qn</dt><dd>${fmt(s.Qn/1000,2)} kN · ${s.governs} 지배</dd></div>`+
    `<div><dt>완전합성 소요 개수</dt><dd class="${o.layout.count>=o.requiredStuds?'ok':'warn'}">${o.requiredStuds}개 · 배치 ${o.layout.count}개</dd></div>`+
    `<div><dt>스터드 배치</dt><dd>한 줄 ${o.layout.perRow}개 × 반 경간 ${o.layout.rowsPerHalf}줄 = ${o.layout.count}개 / 전 경간 ${o.layout.total}개</dd></div>
    <div><dt>길이방향 / 폭 방향 간격</dt><dd>${fmt(o.layout.spacing,0)} / ${o.layout.perRow>1?fmt(d.transverse,0):'—'} mm</dd></div>
    <div><dt>반 경간 / 끝 여유 / 중앙 간격</dt><dd>${fmt(o.layout.half,0)} / ${fmt(o.layout.endGap,1)} / ${fmt(o.layout.centreGap,1)} mm</dd></div>
    <div><dt>스터드 상세</dt><dd class="${d.ok?'ok':'warn'}">${d.ok?'충족':d.reasons.join(' / ')}</dd></div></dl>`+
    `<p class="beam-muted">V′는 3가지 한계상태의 최솟값입니다 (식 4.5-1). Qn = 0.5·Asa√(fck·Ec) ≤ Rg·Rp·Asa·Fu, Rg = ${fmt(s.Rg,2)}, Rp = ${fmt(s.Rp,2)} (골데크 미사용, 형강 직접 용접 · 표 4.3-4). Ec = ${fmt(s.Ec,0)} MPa. 단순보의 최대모멘트 위치를 중앙으로 가정합니다. 각 반 경간에 floor((L/2)/s)줄을 입력 간격으로 중앙 정렬하고 좌우 대칭 배치합니다. 강도에는 한쪽 반 경간 개수만 사용합니다 (4.8.2.3, 4.8.2.4).</p>`;
}
function renderSteel(p,o){
  const b=o.steel;
  if(!b.supported){get('cb_steel').innerHTML=`<p class="warn">${b.message}</p>`;return;}
  get('cb_steel').innerHTML=`<dl class="beam-values">`+
    `<div><dt>시공 중 φbMn (강재단면)</dt><dd class="${b.flexure.ok?'ok':'ng'}">${fmt(b.flexure.phiMn,1)} kN·m · Mu ${fmt(p.MuConstruction,1)} → ${fmt(b.flexure.ratio,3)}</dd></div>`+
    `<div><dt>설계전단강도 φvVn</dt><dd class="${b.shear.ok?'ok':'ng'}">${fmt(b.shear.phiVn,1)} kN · Vu ${fmt(p.Vu,1)} → ${fmt(b.shear.ratio,3)}</dd></div>`+
    `<div><dt>Lb / Cb (시공 중)</dt><dd>${fmt(p.LbConstruction,0)} mm / ${fmt(p.CbConstruction,2)}</dd></div>`+
    `<div><dt>Mp / Lp / Lr</dt><dd>${fmt(b.flexure.Mp,1)} kN·m / ${fmt(b.flexure.Lp,0)} / ${fmt(b.flexure.Lr,0)} mm</dd></div>`+
    `<div><dt>판폭두께비</dt><dd>플랜지 ${b.cls.flange.grade} · 웨브 ${b.cls.web.grade}</dd></div></dl>`+
    `<p class="beam-muted">동바리를 쓰지 않으면 콘크리트가 설계기준강도의 75%에 이르기 전 시공하중은 강재단면만으로 지지해야 합니다 (4.5.1(3)). 전단도 강재단면만으로 구합니다 (4.6.2). 둘 다 KDS 14 31 10에 따르며 철골 보 화면과 같은 엔진을 씁니다.</p>`;
}
function renderBasis(p,o){
  get('cb_basis').innerHTML=`<ul class="beam-basis">`+
    `<li>유효폭은 보경간의 1/8, 인접보 중심간 거리의 1/2, 슬래브 가장자리까지의 거리 중 최솟값을 좌우 각각 구해 합합니다 (4.5.1(2)).</li>`+
    `<li>정모멘트 휨강도는 웨브가 h/tw ≤ 3.76√(E/Fy)인 경우 소성응력분포로 구합니다 (4.5.2(2)). 콘크리트는 0.85fck의 등분포 압축으로 봅니다 (4.1.1(1)).</li>`+
    `<li>총 수평전단력 V′는 콘크리트 압괴, 강재단면 인장항복, 전단연결재 강도의 최솟값입니다 (4.5.2(5)①, 식 4.5-1). ΣQn이 지배하면 부분합성이고 소성중립축이 강재 안으로 들어옵니다.</li>`+
    `<li>콘크리트 강도는 21–70 MPa 범위여야 합니다 (4.2(1)).</li>`+
    `<li>스터드 상세는 직경 ≤ 2.5tf (4.8.1(1)), 길이 ≥ 4d (4.8.2(1)), 길이방향 간격 ≥ 6d, 폭 방향 간격 ≥ 4d, 최대 간격 ≤ min(슬래브 두께의 8배, 900 mm) (4.8.2.4)입니다.</li>`+
    `</ul><p class="beam-muted">KDS 14 31 80 원문 수식 객체 대조 완료 (2026-09-10): 식 4.5-1a~c, 식 4.8-1, 4.5.2(2)의 3.76√(E/Fy), 골데크 미사용 Rg=1.0·Rp=0.75. 스터드 몸체 지름은 선택 규격의 mm 값이며 단면적은 πd²/4입니다.</p>`+
    `<details class="beam-settings"><summary>검토하지 않은 항목</summary><ul class="beam-basis">`+
    `<li><b>부모멘트 구간 (4.5.2(3))</b> — 연속합성보의 부모멘트는 다루지 않습니다. 단순보 정모멘트 구간만 검토합니다.</li>`+
    `<li><b>골데크플레이트 (4.5.2(4))</b> — 골데크를 쓰지 않는 충실 슬래브만 다룹니다. Rg·Rp는 형강 직접 용접 값으로 고정됩니다.</li>`+
    `<li>매입형·충전형 합성부재, 합성트러스, 합성데크슬래브, 합성기둥</li>`+
    `<li>처짐·진동 등 사용성, 동바리 사용 시의 시공 단계별 응력 중첩, 콘크리트 크리프·건조수축</li>`+
    `<li>스터드는 최대모멘트~모멘트 0 구간에 일정 간격으로 배치한다고 가정합니다. 집중하중 위치별 개수 검토(4.8.2.3(2))는 하지 않습니다.</li>`+
    `<li>슬래브 철근, 횡방향 철근, 균열 제어. 슬래브 실제 자유단까지 거리(4.8.2.4(3)), 측면 피복, 용접부·머리 간섭은 실제 상세도에서 별도 확인합니다. 스터드 상단 피복 25 mm는 이 도구의 배치 가정입니다.</li>`+
    `</ul></details>`;
}
function update(){
  get('cb_error').hidden=true;
  try{
    const p=read(),o=CompositeBeam.calculate(p);
    get('cb_results').hidden=false;
    renderSummary(p,o);renderShearFlow(p,o);renderSteel(p,o);renderBasis(p,o);
  }catch(e){
    get('cb_results').hidden=true;get('cb_error').hidden=false;get('cb_error').textContent=e.message;
    for(const id of ['cb_summary','cb_flow','cb_steel','cb_basis'])get(id).innerHTML='';
  }
}
get('cb_gr').innerHTML='<option value="">직접입력</option>'+
  Object.keys(SteelSection.STEEL).map(k=>`<option${k==='SM355'?' selected':''}>${k}</option>`).join('');
for(const id of ['cb_gr','cb_tf'])get(id).addEventListener('input',syncGrade);
SectionPicker.bind(get('cb_mode'),get('cb_sec'),
  {H:get('cb_H'),B:get('cb_B'),tw:get('cb_tw'),tf:get('cb_tf')},()=>{syncGrade();update();});
get('cb_print').addEventListener('click',()=>{
  const closed=[...document.querySelectorAll('#t6 details')].filter(d=>!d.open);
  closed.forEach(d=>{d.open=true;});
  const restore=()=>{closed.forEach(d=>{d.open=false;});window.removeEventListener('afterprint',restore);};
  window.addEventListener('afterprint',restore);
  window.print();
});
get('t6').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
syncGrade();update();
})();
