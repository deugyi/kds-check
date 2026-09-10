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
function update(){
  try{
    syncGrade();
    const p={H:num('sc_H'),B:num('sc_B'),tw:num('sc_tw'),tf:num('sc_tf'),Fy:num('sc_fy'),E:num('sc_e'),klx:num('sc_klx'),kly:num('sc_kly'),Pu:num('sc_pu')};
    const o=SteelColumn.calculate(p),s=o.props,g=o.governing,rolled=get('sc_mode').value==='ks';
    get('sc_diagram').innerHTML=diagram(p);
    const label=`H ${fmt(p.H)} × ${fmt(p.B)} × ${fmt(p.tw)} × ${fmt(p.tf)}`;
    const status=!o.nonslender?'세장판 요소 · 압축강도 판정 보류':!rolled?'용접 단면의 판요소 분류 별도 · 휨좌굴 참고값':o.ok?'휨좌굴 압축강도 충족':'휨좌굴 압축강도 미달';
    get('sc_summary').innerHTML=`<p class="beam-layout">${label}</p><p class="beam-muted">${rolled?'KS 압연 H형강':'Built-up 용접 조립'} · ${get('sc_gr').value||'강도 직접입력'}</p><p class="beam-capacity">${fmt(o.phiPn,1)} <small>kN</small></p><p>설계압축강도 φcPn · φc = 0.90</p><p class="${!rolled?'warn':o.ok?'ok':'ng'}">${status}</p>${values([['소요압축력 Pu',`${fmt(p.Pu,1)} kN`],['강도비 Pu / φcPn',fmt(o.ratio,3)],['지배 축',`${g.key}축 · ${g.key==='X'?'강축':'약축'}`]])}${o.nonslender?`<div class="sc-meter" role="img" aria-label="강도비 ${fmt(o.ratio*100,1)} 퍼센트"><span style="width:${Math.min(100,o.ratio*100)}%;background:var(${o.ok?'--accent':'--ng'})"></span></div>`:''}<p class="beam-muted">순수 압축의 휨좌굴 검토 결과입니다. 휨모멘트와의 상호작용은 포함하지 않습니다.</p>`;
    get('sc_props').innerHTML=values([['단면적 Ag',`${fmt(s.A,1)} mm²`],['강축 단면2차모멘트 Ix',`${fmt(s.Ix,0)} mm⁴`],['약축 단면2차모멘트 Iy',`${fmt(s.Iy,0)} mm⁴`],['강축 회전반경 rx',`${fmt(s.rx)} mm`],['약축 회전반경 ry',`${fmt(s.ry)} mm`]])+'<p class="beam-muted">필릿을 제외한 치수 기반 계산값입니다. 규격표 단면성능과 차이가 있을 수 있습니다.</p>';
    get('sc_plate').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>판요소</th><th>판폭두께비</th><th>비세장 한계 λr</th><th>분류</th></tr></thead><tbody>${[['플랜지 B/(2tf)',o.flange],['웨브 (H−2tf)/tw',o.web]].map(([name,a])=>`<tr><td>${name}</td><td>${fmt(a.ratio,3)}</td><td>${fmt(a.limit,3)}</td><td class="${a.ratio<=a.limit?'ok':'ng'}">${a.ratio<=a.limit?'비세장':'세장'}</td></tr>`).join('')}</tbody></table></div><p class="beam-muted">기존 판요소 기준: 플랜지 0.56√(E/Fy), 웨브 1.49√(E/Fy). ${rolled?'세장판이면 압축강도를 판정하지 않습니다.':'용접 조립단면에는 별도 판요소 기준 확인이 필요하며 이 공통 분류만으로 적합 판정을 제공하지 않습니다.'}</p>`;
    get('sc_axes').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>축</th><th>KL (mm)</th><th>r (mm)</th><th>KL/r</th><th>Fe (MPa)</th><th>Fcr (MPa)</th><th>φcPn (kN)</th></tr></thead><tbody>${o.axes.map(a=>`<tr class="${a===g?'selected':''}"><td>${a.key} · ${a.key==='X'?'강축':'약축'}${a===g?' (지배)':''}</td><td>${fmt(a.length,0)}</td><td>${fmt(a.r)}</td><td>${fmt(a.slenderness)}</td><td>${fmt(a.Fe)}</td><td>${o.nonslender?fmt(a.Fcr):'—'}</td><td class="beam-phi">${o.nonslender?fmt(a.phiPn,1):'—'}</td></tr>`).join('')}</tbody></table></div><p class="${g.slenderness>200?'warn':'beam-muted'}">지배 세장비 ${fmt(g.slenderness)}${g.slenderness>200?' · KL/r > 200 권장 한계 초과':' · KL/r ≤ 200'}. ${o.nonslender?`${g.inelastic?'비탄성':'탄성'} 휨좌굴 구간.`:'세장판 단면의 강도 산정은 별도입니다.'}</p>`;
    get('sc_basis').innerHTML='<ul class="beam-basis"><li>KDS 14 31 10: 4.2.1~4.2.3 압축재 휨좌굴, 표 4.2-2 판폭두께비.</li><li>KDS 14 31 05: 표 3.4-1의 판두께별 항복강도. 강종 선택 시 플랜지 두께 기준으로 적용합니다.</li><li>2축대칭 H형강 · 순수 압축 · 유효좌굴길이는 사용자 입력입니다.</li><li>비틀림·휨비틀림좌굴(4.2.4), 세장판(4.2.7), 조립재(4.2.6), 압축·휨 상호작용, 접합부는 별도 검토합니다.</li></ul>';
    get('sc_steps').innerHTML=values([['재료',`Fy = ${fmt(p.Fy)} MPa · E = ${fmt(p.E,0)} MPa`],['지배 세장비',`KL/r = ${fmt(g.length)}/${fmt(g.r)} = ${fmt(g.slenderness)}`],['Euler 좌굴응력',`Fe = π²E/(KL/r)² = ${fmt(g.Fe)} MPa`],['구간 경계',`4.71√(E/Fy) = ${fmt(g.limit)}`],['Fy / Fe',fmt(p.Fy/g.Fe,4)],['좌굴응력 식',g.inelastic?'Fcr = 0.658^(Fy/Fe) × Fy':'Fcr = 0.877 × Fe'],['압축강도',o.nonslender?`φcPn = 0.90 × ${fmt(g.Fcr)} × ${fmt(s.A)} / 1000 = ${fmt(o.phiPn,1)} kN`:'세장판 요소가 있어 산정하지 않음']]);
    get('sc_error').hidden=true;get('sc_results').hidden=false;
  }catch(e){get('sc_error').textContent=e.message;get('sc_error').hidden=false;get('sc_results').hidden=true;for(const id of ['sc_diagram','sc_summary','sc_props','sc_plate','sc_axes','sc_basis','sc_steps'])get(id).innerHTML='';}
}
get('sc_gr').innerHTML='<option value="">직접입력</option>'+Object.keys(SteelSection.STEEL).map(k=>`<option${k==='SM355'?' selected':''}>${k}</option>`).join('');
// Explicit initial value also supports the existing lightweight DOM smoke harness.
get('sc_gr').value='SM355';
SectionPicker.bind(get('sc_mode'),get('sc_sec'),{H:get('sc_H'),B:get('sc_B'),tw:get('sc_tw'),tf:get('sc_tf')},update);
for(const id of ['sc_gr','sc_fy','sc_e','sc_H','sc_B','sc_tw','sc_tf','sc_klx','sc_kly','sc_pu'])get(id).addEventListener('input',update);
get('sc_print').addEventListener('click',()=>root.print());
root.runSteelCol=update;
update();
})(typeof globalThis!=='undefined'?globalThis:this);
