(function(){
'use strict';
const get=id=>document.getElementById(id);
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const exp=(n,d=4)=>Number.isFinite(n)?n.toExponential(d):'—';
const num=id=>{const v=get(id).value.trim();return v===''?NaN:Number(v);};
function read(){
  const j=get('sb_J').value.trim();
  const ks=SectionPicker.selected(get('sb_mode'),get('sb_sec'));
  return {H:num('sb_H'),B:num('sb_B'),tw:num('sb_tw'),tf:num('sb_tf'),
    Fy:num('sb_fy'),E:num('sb_e'),rolled:get('sb_mode').value==='ks',
    r:ks?ks.r:null,section:ks,
    J:j===''?null:Number(j),Lb:num('sb_lb'),Cb:num('sb_cb'),Mu:num('sb_mu'),Vu:num('sb_vu')};
}
function syncGrade(){
  const g=get('sb_gr').value;
  if(!g)return;
  const Fy=SteelSection.yieldStrength(g,num('sb_tf'));
  if(Fy)get('sb_fy').value=Fy;
}
// Cross-section drawn to scale with the plate thickness ratios visible.
function sectionView(p){
  const W=200,Hs=240,M=30,scale=Math.min((W-2*M)/p.B,(Hs-2*M)/p.H);
  const w=p.B*scale,h=p.H*scale,x=(W-w)/2,y=(Hs-h)/2,tf=p.tf*scale,tw=p.tw*scale;
  const fill='fill="var(--accent)" fill-opacity=".22" stroke="var(--accent)"';
  return `<svg viewBox="0 0 ${W} ${Hs}" role="img" aria-label="H형강 ${fmt(p.H,0)}×${fmt(p.B,0)}×${fmt(p.tw,0)}×${fmt(p.tf,0)}">`+
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${tf.toFixed(1)}" ${fill}/>`+
    `<rect x="${x.toFixed(1)}" y="${(y+h-tf).toFixed(1)}" width="${w.toFixed(1)}" height="${tf.toFixed(1)}" ${fill}/>`+
    `<rect x="${(W/2-tw/2).toFixed(1)}" y="${(y+tf).toFixed(1)}" width="${tw.toFixed(1)}" height="${(h-2*tf).toFixed(1)}" ${fill}/>`+
    `<text class="ax" x="${W/2}" y="${(y+h+18).toFixed(0)}" text-anchor="middle">B = ${fmt(p.B,0)}</text>`+
    `<text class="ax" x="${(x+w+14).toFixed(0)}" y="${Hs/2}" text-anchor="middle" transform="rotate(90 ${(x+w+14).toFixed(0)} ${Hs/2})">H = ${fmt(p.H,0)}</text></svg>`;
}
/* Mn against the unbraced length, with the plateau, the inelastic line and the
 * elastic branch, plus where this beam's Lb falls. */
function ltbChart(p,o){
  const m=o.flexure,W=560,H=300,ML=70,MR=24,MT=18,MB=44;
  const Lmax=Math.max(m.Lr*1.35,p.Lb*1.15),Mmax=m.Mp*1.12;
  const X=v=>ML+(v/Lmax)*(W-ML-MR),Y=v=>H-MB-(v/Mmax)*(H-MT-MB);
  const at=L=>{
    if(L<=m.Lp)return m.Mp;
    if(L<=m.Lr)return Math.min(m.Mp,p.Cb*(m.Mp-(m.Mp-m.Msr)*(L-m.Lp)/(m.Lr-m.Lp)));
    const s=L/o.props.rts;
    return Math.min(m.Mp,p.Cb*Math.PI*Math.PI*p.E/(s*s)*Math.sqrt(1+.078*m.q*s*s)*o.props.Sx/1e6);
  };
  const pts=[];
  for(let i=0;i<=120;i++){const L=Math.max(1,Lmax*i/120);pts.push(`${i?'L':'M'}${X(L).toFixed(1)} ${Y(at(L)).toFixed(1)}`);}
  const grid=[];
  for(let i=0;i<=4;i++){
    const v=Mmax*i/4,L=Lmax*i/4;
    grid.push(`<line x1="${ML}" x2="${W-MR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/>`,
      `<text class="ax" x="${ML-8}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${fmt(v,0)}</text>`,
      `<text class="ax" x="${X(L).toFixed(1)}" y="${H-MB+18}" text-anchor="middle">${fmt(L,0)}</text>`);
  }
  const vline=(L,label,cls)=>`<line class="cap ${cls}" x1="${X(L).toFixed(1)}" x2="${X(L).toFixed(1)}" y1="${MT}" y2="${H-MB}"/>`+
    `<text class="ax" x="${(X(L)+4).toFixed(1)}" y="${MT+12}">${label}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lb에 따른 공칭휨강도. Lp ${fmt(m.Lp,0)}, Lr ${fmt(m.Lr,0)}, Lb ${fmt(p.Lb,0)} mm">`+
    grid.join('')+vline(m.Lp,'Lp','')+vline(m.Lr,'Lr','')+
    `<path class="curve design" d="${pts.join('')}"/>`+
    `<g class="pt ${m.ok?'ok':'ng'}"><circle cx="${X(p.Lb).toFixed(1)}" cy="${Y(m.Mn).toFixed(1)}" r="5"/><text x="${(X(p.Lb)+8).toFixed(1)}" y="${(Y(m.Mn)-8).toFixed(1)}">Lb</text></g>`+
    `<line x1="${ML}" x2="${W-MR}" y1="${H-MB}" y2="${H-MB}" stroke="var(--ink)"/><line x1="${ML}" x2="${ML}" y1="${MT}" y2="${H-MB}" stroke="var(--ink)"/>`+
    `<text class="ax" x="${(ML+(W-ML-MR)/2).toFixed(0)}" y="${H-8}" text-anchor="middle">Lb (mm)</text>`+
    `<text class="ax" x="14" y="${(MT+(H-MT-MB)/2).toFixed(0)}" text-anchor="middle" transform="rotate(-90 14 ${(MT+(H-MT-MB)/2).toFixed(0)})">Mn (kN·m)</text></svg>`;
}
function renderProps(p,o){
  const s=o.props,c=o.cls,badge=g=>`<span class="slab-face ${g==='조밀'?'top':'bottom'}">${g}</span>`;
  get('sb_props').innerHTML=sectionView(p)+
    `<dl class="beam-values"><div><dt>A</dt><dd>${fmt(s.A,0)} mm²</dd></div>`+
    `<div><dt>Ix / Sx</dt><dd>${exp(s.Ix)} / ${exp(s.Sx)} mm³</dd></div>`+
    `<div><dt>Zx</dt><dd>${exp(s.Zx)} mm³</dd></div>`+
    `<div><dt>Iy / ry</dt><dd>${exp(s.Iy)} mm⁴ / ${fmt(s.ry,2)} mm</dd></div>`+
    `<div><dt>ho / Cw</dt><dd>${fmt(s.ho,1)} mm / ${exp(s.Cw)} mm⁶</dd></div>`+
    `<div><dt>J / rts</dt><dd>${exp(s.J)} mm⁴ / ${fmt(s.rts,2)} mm</dd></div>`+
    `<div><dt>단면 구분</dt><dd>${p.section?`KS ${p.section.name} · 필릿 r = ${p.section.r} mm 포함`:'Built-up · 필릿 없음'}</dd></div>`+
    `<div><dt>플랜지 b/2tf</dt><dd>${fmt(c.flange.ratio,3)} · λp ${fmt(c.flange.lp,3)} · λr ${fmt(c.flange.lr,3)} ${badge(c.flange.grade)}</dd></div>`+
    `<div><dt>웨브 h/tw</dt><dd>${fmt(c.web.ratio,3)} · λp ${fmt(c.web.lp,3)} · λr ${fmt(c.web.lr,3)} ${badge(c.web.grade)}</dd></div></dl>`+
    (o.notes.length?`<ul class="beam-basis">${o.notes.map(n=>`<li class="warn">${n}</li>`).join('')}</ul>`:'')+
    `<p class="beam-muted">판폭두께비는 KDS 14 31 10 표 4.3-2. 압연형강의 웨브는 필릿을 공제하지 않아 h/tw가 크게 나오며 안전측입니다.</p>`;
}
function renderFlexure(p,o){
  const m=o.flexure;
  get('sb_flexure').innerHTML=`<p class="beam-capacity">${fmt(m.phiMn,2)} <small>kN·m</small></p><p>설계휨강도 φbMn · φb = 0.90</p>`+
    `<p class="${m.ok?'ok':'ng'}">${m.ok?'휨강도 충족':'휨강도 미달'} · Mu/φbMn = ${fmt(m.ratio,3)}</p>`+
    ltbChart(p,o)+
    `<dl class="beam-values"><div><dt>Mp = Fy·Zx</dt><dd>${fmt(m.Mp,2)} kN·m</dd></div>`+
    `<div><dt>0.7Fy·Sx</dt><dd>${fmt(m.Msr,2)} kN·m</dd></div>`+
    `<div><dt>Lp / Lr / Lb</dt><dd>${fmt(m.Lp,1)} / ${fmt(m.Lr,1)} / ${fmt(p.Lb,1)} mm</dd></div>`+
    `<div><dt>Mn (횡비틀림좌굴)</dt><dd>${fmt(m.ltb,2)} kN·m</dd></div>`+
    (m.flb!==null?`<div><dt>Mn (플랜지 국부좌굴)</dt><dd>${fmt(m.flb,2)} kN·m${m.kc!==null?` · kc = ${fmt(m.kc,4)}`:''}</dd></div>`:'')+
    `<div><dt>Mn</dt><dd>${fmt(m.Mn,2)} kN·m</dd></div>`+
    `<div><dt>소요휨모멘트 Mu</dt><dd>${fmt(p.Mu,2)} kN·m</dd></div></dl>`+
    `<p class="beam-muted">${m.mode}${m.flbMode?` · ${m.flbMode}`:''}. Cb = ${fmt(p.Cb,2)}, c = 1.0 (2축대칭 H형강, 식 4.3-8a). ${m.Fcr!==null?`Fcr = ${fmt(m.Fcr,2)} MPa.`:''}</p>`;
}
function renderShear(p,o){
  const v=o.shear;
  get('sb_shear').innerHTML=`<p class="beam-capacity">${fmt(v.phiVn,1)} <small>kN</small></p><p>설계전단강도 φvVn · φv = ${fmt(v.phi,2)}</p>`+
    `<p class="${v.ok?'ok':'ng'}">${v.ok?'전단강도 충족':'전단강도 미달'} · Vu/φvVn = ${fmt(v.ratio,3)}</p>`+
    `<dl class="beam-values"><div><dt>Aw = H·tw</dt><dd>${fmt(v.Aw,0)} mm²</dd></div>`+
    `<div><dt>Cv</dt><dd>${fmt(v.Cv,4)}</dd></div>`+
    `<div><dt>Vn = 0.6Fy·Aw·Cv</dt><dd>${fmt(v.Vn,1)} kN</dd></div>`+
    `<div><dt>소요전단력 Vu</dt><dd>${fmt(p.Vu,1)} kN</dd></div>`+
    `<div><dt>수직보강재</dt><dd class="${v.needsStiffener?'warn':'ok'}">${v.needsStiffener?`필요 · h/tw > 2.46√(E/Fy) = ${fmt(v.stiffenerLimit,2)}`:`불필요 · h/tw ≤ ${fmt(v.stiffenerLimit,2)}`}</dd></div></dl>`+
    `<p class="beam-muted">${v.mode}. kv = 5 (수직보강재 없음, 식 4.3-89). 식 (4.3-85)~(4.3-89), 4.3.2.1.2.2.</p>`;
}
function renderBasis(){
  get('sb_basis').innerHTML=`<ul class="beam-basis">`+
    `<li>단면성능은 2축대칭 H형강의 이론식으로 계산합니다. rts = √(√(Iy·Cw)/Sx) (식 4.3-8), Cw = Iy·ho²/4.</li>`+
    `<li>휨강도는 소성모멘트, 횡비틀림좌굴(4.3.2.1.1.2), 압축플랜지 국부좌굴(4.3.2.1.1.3) 중 작은 값입니다. φb = 0.90 (4.3.1(1)).</li>`+
    `<li>전단강도는 4.3.2.1.2.2입니다. 압연 H형강이고 h/tw ≤ 2.24√(E/Fy)이면 φv = 1.0, 그 외에는 φv = 0.90입니다.</li>`+
    `<li>Fy는 KDS 14 31 05 표 3.4-1에서 플랜지 두께로 정하고, E = 210,000 MPa는 표 3.5-1입니다.</li>`+
    `</ul><details class="beam-settings"><summary>검토하지 않은 항목</summary><ul class="beam-basis">`+
    `<li><b>웨브 비조밀·세장 단면 (4.3.2.1.1.4/5)</b> — 조밀 웨브만 다룹니다.</li>`+
    `<li>T형·ㄱ형강, 1축대칭 단면, 약축 휨, 인장역작용(4.3.2.1.2.3), 수직보강재 설계</li>`+
    `<li>처짐·진동 등 사용성, 웨브 크리플링·항복, 접합부, 내진 특수규정</li>`+
    `<li>Cb는 입력값을 그대로 씁니다. 모멘트 분포로부터 자동 산정하지 않습니다.</li>`+
    `</ul></details>`;
}
function update(){
  get('sb_error').hidden=true;
  try{
    const p=read(),o=SteelBeam.calculate(p);
    get('sb_results').hidden=false;
    renderProps(p,o);
    if(!o.supported){
      get('sb_flexure').innerHTML=`<p class="warn">${o.message}</p>`;
      get('sb_shear').innerHTML='';
    }else{renderFlexure(p,o);renderShear(p,o);}
    renderBasis();
  }catch(e){
    get('sb_results').hidden=true;get('sb_error').hidden=false;get('sb_error').textContent=e.message;
    for(const id of ['sb_props','sb_flexure','sb_shear','sb_basis'])get(id).innerHTML='';
  }
}
get('sb_gr').innerHTML='<option value="">직접입력</option>'+
  Object.keys(SteelSection.STEEL).map(k=>`<option${k==='SM355'?' selected':''}>${k}</option>`).join('');
for(const id of ['sb_gr','sb_tf','sb_H'])get(id).addEventListener('input',syncGrade);
SectionPicker.bind(get('sb_mode'),get('sb_sec'),
  {H:get('sb_H'),B:get('sb_B'),tw:get('sb_tw'),tf:get('sb_tf')},()=>{syncGrade();update();});
get('sb_print').addEventListener('click',()=>{
  const closed=[...document.querySelectorAll('#t3 details')].filter(d=>!d.open);
  closed.forEach(d=>{d.open=true;});
  const restore=()=>{closed.forEach(d=>{d.open=false;});window.removeEventListener('afterprint',restore);};
  window.addEventListener('afterprint',restore);
  window.print();
});
get('t3').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
syncGrade();update();
})();
