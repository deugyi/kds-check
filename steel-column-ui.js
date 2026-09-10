(function(root){
'use strict';
const get=id=>document.getElementById(id),num=id=>String(get(id).value).trim()===''?NaN:Number(get(id).value);
const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
const values=rows=>`<dl class="beam-values">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
function syncGrade(){
  const grade=get('sc_gr').value;
  get('sc_fy').readOnly=!!grade;
  if(grade){const fy=SteelSection.yieldStrength(grade,num('sc_tf'));if(fy)get('sc_fy').value=fy;}
}
function diagram(p){
  const s=Math.min(180/p.B,200/p.H),w=p.B*s,h=p.H*s,x=150-w/2,y=135-h/2,tf=p.tf*s,tw=p.tw*s;
  const plate='fill="var(--accent)" fill-opacity=".22" stroke="var(--accent)"';
  return `<svg viewBox="0 0 300 290" role="img" aria-label="H형강 ${p.H}×${p.B}×${p.tw}×${p.tf} mm, 수평 X 강축과 수직 Y 약축"><rect x="${x}" y="${y}" width="${w}" height="${tf}" ${plate}/><rect x="${x}" y="${y+h-tf}" width="${w}" height="${tf}" ${plate}/><rect x="${150-tw/2}" y="${y+tf}" width="${tw}" height="${h-2*tf}" ${plate}/><path d="M30 135H270 M150 15V255" stroke="var(--dim)" stroke-dasharray="4 4" fill="none"/><text x="270" y="127">X</text><text x="159" y="22">Y</text><text x="150" y="${y+h+24}" text-anchor="middle">B = ${fmt(p.B)} mm</text><text x="${x+w+20}" y="135" text-anchor="middle" transform="rotate(-90 ${x+w+20} 135)">H = ${fmt(p.H)} mm</text></svg>`;
}
function interactionChart(c){
  const max=Math.max(1.1,c.x*1.15,c.y*1.15),X=v=>60+v/max*370,Y=v=>250-v/max*205;
  const intercept=c.limit;
  return `<svg viewBox="0 0 460 300" role="img" aria-label="현재 축력에서 강축과 약축 모멘트비 상호작용. X ${fmt(c.x,3)}, Y ${fmt(c.y,3)}, 합 한계 ${fmt(intercept,3)}"><path d="M60 45V250H430" stroke="var(--dim)" fill="none"/><path d="M60 250L${X(intercept)} 250L60 ${Y(intercept)}Z" fill="var(--accent)" fill-opacity=".1" stroke="var(--accent)"/><circle cx="${X(c.x)}" cy="${Y(c.y)}" r="5" fill="var(${c.ok?'--ok':'--ng'})"><title>입력점: (${fmt(c.x,3)}, ${fmt(c.y,3)})</title></circle><text x="${Math.min(380,X(c.x)+9)}" y="${Math.max(25,Y(c.y)-10)}">입력점</text><text x="60" y="270">0</text><text x="${X(intercept)}" y="270" text-anchor="middle">${fmt(intercept,3)}</text><text x="52" y="${Y(intercept)+4}" text-anchor="end">${fmt(intercept,3)}</text><text x="260" y="292" text-anchor="middle">|Mux| / φbMnx</text><text x="16" y="145" text-anchor="middle" transform="rotate(-90 16 145)">|Muy| / φbMny</text></svg>`;
}
function renderMoments(p,o){
  const x=o.flexure.strong,y=o.flexure.weak,c=o.combined;
  get('sc_moments').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>축</th><th>|Mu| (kN·m)</th><th>φbMn (kN·m)</th><th>강도비</th><th>휨강도 확인</th></tr></thead><tbody>${[['X · 강축',Math.abs(p.Mux),x?.phiMn],['Y · 약축',Math.abs(p.Muy),y.phiMn]].map(([name,demand,capacity])=>`<tr><td>${name}</td><td>${fmt(demand)}</td><td class="beam-phi">${fmt(capacity)}</td><td>${fmt(demand/capacity,3)}</td><td class="${!capacity||!p.rolled?'warn':demand<=capacity?'ok':'ng'}">${!capacity?'산정 범위 밖':!p.rolled?'참고값':demand<=capacity?'충족':'미달'}</td></tr>`).join('')}</tbody></table></div>${values([['강축 강도 지배',x?(x.flb!==null&&x.flb<x.ltb?'압축플랜지 국부좌굴':x.mode):'비조밀·세장 웨브 별도 검토'],['Lp / Lr / Lb',x?`${fmt(x.Lp)} / ${fmt(x.Lr)} / ${fmt(p.Lb)} mm`:'—'],['약축 플랜지',`${y.grade} · 식 (${y.clause})`],['약축 Sy / Zy',`${fmt(y.Sy,0)} / ${fmt(y.Zy,0)} mm³`],['약축 항복 상한 Mp',`${fmt(y.Mp)} kN·m (min(FyZy, 1.6FySy))`]])}<p class="beam-muted">φb = 0.90. 강축은 항복·횡비틀림좌굴·플랜지 국부좌굴을 반영합니다. 약축은 항복과 플랜지 국부좌굴을 검토하며 횡비틀림좌굴은 적용하지 않습니다. 각 축의 개별 충족만으로 조합강도 충족을 뜻하지 않습니다.</p>`;
  if(!c){get('sc_interaction').innerHTML=`<p class="warn">상호작용 판정 보류 · ${o.reason}</p>`;return;}
  get('sc_interaction').innerHTML=`<p class="beam-capacity">${fmt(c.value,3)} <small>/ 1.000</small></p><p class="${c.ok?'ok':'ng'}">${c.ok?'축력–2축 휨 검토 충족':'축력–2축 휨 검토 미달'}</p><p class="beam-muted">${o.reason}. 같은 하중조합의 Pu·Mux·Muy를 함께 검토합니다.</p>${interactionChart(c)}${values([['축력비 Pu / Pr',fmt(c.axial,3)],['강축비 |Mux| / Mrx',fmt(c.x,3)],['약축비 |Muy| / Mry',fmt(c.y,3)],['적용 식',`(${c.clause}) · 축력비 ${c.high?'≥':'<'} 0.2`],['상호작용식',c.high?'Pu/Pr + (8/9)(|Mux|/Mrx + |Muy|/Mry) ≤ 1':'Pu/(2Pr) + |Mux|/Mrx + |Muy|/Mry ≤ 1']])}<p class="beam-muted">Pr = φcPn, Mrx = φbMnx, Mry = φbMny. 음영은 현재 축력에서 허용하는 모멘트비 영역입니다. 2차 효과를 자동 증폭하지 않으며, 비틀림·휨비틀림 압축좌굴 및 접합부 검토는 별도입니다.</p>`;
}
function update(){
  try{
    syncGrade();
    const p={H:num('sc_H'),B:num('sc_B'),tw:num('sc_tw'),tf:num('sc_tf'),Fy:num('sc_fy'),E:num('sc_e'),klx:num('sc_klx'),kly:num('sc_kly'),Pu:num('sc_pu'),Mux:num('sc_mux'),Muy:num('sc_muy'),Lb:num('sc_lb'),Cb:num('sc_cb'),rolled:get('sc_mode').value==='ks'};
    const ks=SectionPicker.selected(get('sc_mode'),get('sc_sec'));p.r=ks?.r??null;p.J=ks?.listed?ks.J:null;
    const o=SteelColumn.calculate(p),s=o.props,g=o.governing,rolled=get('sc_mode').value==='ks';
    get('sc_diagram').innerHTML=diagram(p);
    const label=`H ${fmt(p.H)} × ${fmt(p.B)} × ${fmt(p.tw)} × ${fmt(p.tf)}`;
    const status=!o.nonslender?'세장판 요소 · 압축강도 판정 보류':!rolled?'용접 단면의 판요소 분류 별도 · 휨좌굴 참고값':o.ok?'휨좌굴 압축강도 충족':'휨좌굴 압축강도 미달';
    get('sc_summary').innerHTML=`<p class="beam-layout">${label}</p><p class="beam-muted">${rolled?'KS 압연 H형강':'Built-up 용접 조립'} · ${get('sc_gr').value||'강도 직접입력'}</p><p class="beam-capacity">${fmt(o.phiPn,1)} <small>kN</small></p><p>설계압축강도 φcPn · φc = 0.90</p><p class="${!rolled?'warn':o.ok?'ok':'ng'}">${status}</p>${values([['소요압축력 Pu',`${fmt(p.Pu,1)} kN`],['강도비 Pu / φcPn',fmt(o.ratio,3)],['지배 축',`${g.key}축 · ${g.key==='X'?'강축':'약축'}`]])}${o.nonslender?`<div class="sc-meter" role="img" aria-label="강도비 ${fmt(o.ratio*100,1)} 퍼센트"><span style="width:${Math.min(100,o.ratio*100)}%;background:var(${o.ok?'--accent':'--ng'})"></span></div>`:''}<p class="beam-muted">위 값은 압축 내력입니다. 최종 조합 검토는 아래 축력–2축 휨 상호작용 결과를 확인하세요.</p>`;
    get('sc_props').innerHTML=values([['단면적 Ag',`${fmt(s.A,1)} mm²`],['강축 단면2차모멘트 Ix',`${fmt(s.Ix,0)} mm⁴`],['약축 단면2차모멘트 Iy',`${fmt(s.Iy,0)} mm⁴`],['강축 회전반경 rx',`${fmt(s.rx)} mm`],['약축 회전반경 ry',`${fmt(s.ry)} mm`]])+'<p class="beam-muted">필릿을 제외한 치수 기반 계산값입니다. 규격표 단면성능과 차이가 있을 수 있습니다.</p>';
    get('sc_plate').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>판요소</th><th>판폭두께비</th><th>비세장 한계 λr</th><th>분류</th></tr></thead><tbody>${[['플랜지 B/(2tf)',o.flange],['웨브 (H−2tf)/tw',o.web]].map(([name,a])=>`<tr><td>${name}</td><td>${fmt(a.ratio,3)}</td><td>${fmt(a.limit,3)}</td><td class="${a.ratio<=a.limit?'ok':'ng'}">${a.ratio<=a.limit?'비세장':'세장'}</td></tr>`).join('')}</tbody></table></div><p class="beam-muted">기존 판요소 기준: 플랜지 0.56√(E/Fy), 웨브 1.49√(E/Fy). ${rolled?'세장판이면 압축강도를 판정하지 않습니다.':'용접 조립단면에는 별도 판요소 기준 확인이 필요하며 이 공통 분류만으로 적합 판정을 제공하지 않습니다.'}</p>`;
    get('sc_axes').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>축</th><th>KL (mm)</th><th>r (mm)</th><th>KL/r</th><th>Fe (MPa)</th><th>Fcr (MPa)</th><th>φcPn (kN)</th></tr></thead><tbody>${o.axes.map(a=>`<tr class="${a===g?'selected':''}"><td>${a.key} · ${a.key==='X'?'강축':'약축'}${a===g?' (지배)':''}</td><td>${fmt(a.length,0)}</td><td>${fmt(a.r)}</td><td>${fmt(a.slenderness)}</td><td>${fmt(a.Fe)}</td><td>${o.nonslender?fmt(a.Fcr):'—'}</td><td class="beam-phi">${o.nonslender?fmt(a.phiPn,1):'—'}</td></tr>`).join('')}</tbody></table></div><p class="${g.slenderness>200?'warn':'beam-muted'}">지배 세장비 ${fmt(g.slenderness)}${g.slenderness>200?' · KL/r > 200 권장 한계 초과':' · KL/r ≤ 200'}. ${o.nonslender?`${g.inelastic?'비탄성':'탄성'} 휨좌굴 구간.`:'세장판 단면의 강도 산정은 별도입니다.'}</p>`;
    renderMoments(p,o);
    get('sc_basis').innerHTML='<ul class="beam-basis"><li>KDS 14 31 10: 4.2.1~4.2.3 압축재 휨좌굴, 표 4.2-2 판폭두께비.</li><li>KDS 14 31 05: 표 3.4-1의 판두께별 항복강도. 강종 선택 시 플랜지 두께 기준으로 적용합니다.</li><li>2축대칭 압연 H형강 · 유효좌굴길이와 2차 효과 반영 설계력은 사용자 입력입니다.</li><li>강축 휨: 4.3.2.1.1.2/3, 약축 휨: 4.3.2.1.1.6, 축력–2축 휨: 4.4.1.1 식 (4.4-1/2).</li><li>비틀림·휨비틀림좌굴(4.2.4), 세장판(4.2.7), 조립재(4.2.6), 2차 구조해석, 접합부는 별도 검토합니다.</li></ul>';
    get('sc_steps').innerHTML=values([['재료',`Fy = ${fmt(p.Fy)} MPa · E = ${fmt(p.E,0)} MPa`],['지배 세장비',`KL/r = ${fmt(g.length)}/${fmt(g.r)} = ${fmt(g.slenderness)}`],['Euler 좌굴응력',`Fe = π²E/(KL/r)² = ${fmt(g.Fe)} MPa`],['구간 경계',`4.71√(E/Fy) = ${fmt(g.limit)}`],['Fy / Fe',fmt(p.Fy/g.Fe,4)],['좌굴응력 식',g.inelastic?'Fcr = 0.658^(Fy/Fe) × Fy':'Fcr = 0.877 × Fe'],['압축강도',o.nonslender?`φcPn = 0.90 × ${fmt(g.Fcr)} × ${fmt(s.A)} / 1000 = ${fmt(o.phiPn,1)} kN`:'세장판 요소가 있어 산정하지 않음']]);
    get('sc_error').hidden=true;get('sc_results').hidden=false;
  }catch(e){get('sc_error').textContent=e.message;get('sc_error').hidden=false;get('sc_results').hidden=true;for(const id of ['sc_diagram','sc_summary','sc_props','sc_plate','sc_axes','sc_basis','sc_steps','sc_moments','sc_interaction'])get(id).innerHTML='';}
}
get('sc_gr').innerHTML='<option value="">직접입력</option>'+Object.keys(SteelSection.STEEL).map(k=>`<option${k==='SM355'?' selected':''}>${k}</option>`).join('');
// Explicit initial value also supports the existing lightweight DOM smoke harness.
get('sc_gr').value='SM355';
SectionPicker.bind(get('sc_mode'),get('sc_sec'),{H:get('sc_H'),B:get('sc_B'),tw:get('sc_tw'),tf:get('sc_tf')},update);
for(const id of ['sc_gr','sc_fy','sc_e','sc_H','sc_B','sc_tw','sc_tf','sc_klx','sc_kly','sc_pu','sc_mux','sc_muy','sc_lb','sc_cb'])get(id).addEventListener('input',update);
get('sc_print').addEventListener('click',()=>root.print());
root.runSteelCol=update;
update();
})(typeof globalThis!=='undefined'?globalThis:this);
