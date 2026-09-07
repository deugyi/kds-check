(function(){
'use strict';
const get=id=>document.getElementById(id),fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
let current=null,selectedKey=null;
function read(){const optional=id=>get(id).value.trim()===''?null:Number(get(id).value);const n=id=>{const v=get(id).value.trim();return v===''?NaN:Number(v);};return {b:n('b_b'),h:n('b_h'),bar:get('b_bar').value,stirrup:get('b_stirrup').value,fck:get('b_fck').value==='custom'?n('b_fck_custom'):n('b_fck'),fy:n('b_fy'),fyt:n('b_fyt'),compressionBar:get('b_compression_bar').value,compressionCount:n('b_compression_count'),cover:n('b_cover'),aggregate:n('b_aggregate'),legs:n('b_legs'),stirrupSpacing:n('b_spacing'),Vu:optional('b_vu'),skinMode:get('b_skin_mode').value,skinBar:get('b_skin_bar').value,skinCount:n('b_skin_count'),environment:get('b_environment').value,concretePrice:n('b_concrete_price'),steelPrice:n('b_steel_price'),wastePercent:n('b_waste'),stirrupCutLength:optional('b_cut_length')};}
function diagram(p,g,r,skin){
  const scale=Math.min(260/p.b,280/p.h),w=p.b*scale,h=p.h*scale,x=55,y=30;
  const circles=r.layers.flatMap(l=>l.xs.map(cx=>`<circle cx="${x+cx*scale}" cy="${y+l.d*scale}" r="${g.bar.diameter*scale/2}" fill="var(--accent)"/>`)).join('');
  const top=g.compression?g.compression.xs.map(cx=>`<circle cx="${x+cx*scale}" cy="${y+g.compression.d*scale}" r="${g.compression.bar.diameter*scale/2}" fill="var(--warn)"/>`).join(''):'';
  const skinCircles=skin?skin.points.map(pt=>`<circle cx="${x+pt.x*scale}" cy="${y+pt.d*scale}" r="${skin.bar.diameter*scale/2}" fill="var(--ok)"/>`).join(''):'';
  const internal=Number.isInteger(p.legs)&&p.legs>=2&&p.legs<=6?Array.from({length:p.legs-2},(_,i)=>{const xx=x+(p.cover+g.st.diameter/2+(p.b-2*p.cover-g.st.diameter)*(i+1)/(p.legs-1))*scale;return `<line x1="${xx}" x2="${xx}" y1="${y+(p.cover+g.st.diameter/2)*scale}" y2="${y+h-(p.cover+g.st.diameter/2)*scale}" stroke="var(--dim)" stroke-width="${g.st.diameter*scale}" stroke-dasharray="4 3"/>`;}).join(''):'';
  return `<svg viewBox="0 0 ${w+120} ${h+90}" role="img" aria-label="${p.b}×${p.h} mm 보, ${p.bar} ${r.total}가닥, 하부부터 ${r.key} 배치, 상부 ${p.compressionCount}가닥, 표피철근 ${skin?skin.total:0}가닥, 스터럽 ${p.legs}다리"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--code)" stroke="var(--ink)"/><rect x="${x}" y="${y}" width="${w}" height="${Math.min(r.a,p.h)*scale}" fill="var(--accent)" opacity=".12"/><rect x="${x+(p.cover+g.st.diameter/2)*scale}" y="${y+(p.cover+g.st.diameter/2)*scale}" width="${(p.b-2*p.cover-g.st.diameter)*scale}" height="${(p.h-2*p.cover-g.st.diameter)*scale}" fill="none" stroke="var(--dim)" stroke-width="${g.st.diameter*scale}"/>${internal}${circles}${top}${skinCircles}<line x1="${x-8}" x2="${x+w+8}" y1="${y+Math.min(r.c,p.h)*scale}" y2="${y+Math.min(r.c,p.h)*scale}" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${x+w/2}" y="${y+h+27}" text-anchor="middle">b = ${fmt(p.b,0)} mm</text><text x="${x+w+30}" y="${y+h/2}" text-anchor="middle" transform="rotate(90 ${x+w+30} ${y+h/2})">h = ${fmt(p.h,0)} mm</text><text x="${x}" y="18">상부 압축</text></svg>`;
}
function renderChecks(p,g,r){
  const error=(id,e)=>{get(id).textContent=e.message;};
  const status=(ok,text)=>`<p class="${ok?'ok':'warn'}">${text}</p>`;
  let sk=null;
  try{
    sk=RCBeamChecks.skin(p,g,r);
    get('b_skin').innerHTML=status(sk.ok,sk.ok?(sk.required?'표피철근 간격 조건 충족':sk.count?'임의 배치 · 간격 조건 충족':'h ≤ 900 mm · 의무 배치 대상 아님'):sk.reasons.join(' / '))+`<dl class="beam-values"><div><dt>양측 추가 철근</dt><dd>각 ${sk.count}-${p.skinBar} · 총 ${sk.total}가닥</dd></div><div><dt>허용 중심간격</dt><dd>${fmt(sk.maxSpacing,1)} mm</dd></div><div><dt>배치 최대 중심간격</dt><dd>${fmt(sk.spacing,1)} mm</dd></div><div><dt>검토용 사용응력 fs</dt><dd>2fy/3 = ${fmt(sk.fs,1)} MPa</dd></div></dl><p class="beam-muted">KDS 14 20 20, 4.2.3(4)(6). κcr = ${sk.kappa}, cc = ${fmt(sk.cc,2)} mm. 하부 양끝 주철근을 경계로 하여 h/2까지 추가 배치합니다. 표피철근은 물량에 포함하며 φMn에는 산입하지 않습니다.</p>`;
  }catch(e){error('b_skin',e);}
  try{
    const v=RCBeamChecks.shear(p,g,r);
    get('b_shear').innerHTML=`<p class="beam-capacity">${fmt(v.phiVn,2)} <small>kN</small></p><p>설계전단강도 φVn · φ = 0.75</p>`+status(v.ok,v.ok?(v.Vu===null?'철근량·간격 조건 충족 · Vu 미입력':'입력 Vu 및 전단 조건 충족'):v.reasons.join(' / '))+`<dl class="beam-values"><div><dt>Av / 최소 Av</dt><dd>${fmt(v.Av,2)} / ${fmt(v.avMin,2)} mm²</dd></div><div><dt>Vc / Vs</dt><dd>${fmt(v.Vc,2)} / ${fmt(v.Vs,2)} kN</dd></div><div><dt>Vs 상한</dt><dd>${fmt(v.VsMax,2)} kN</dd></div><div><dt>간격 s / 허용 최대</dt><dd>${fmt(v.s,0)} / ${fmt(v.maxSpacing,1)} mm</dd></div><div><dt>Vu / φVn</dt><dd>${v.ratio===null?'미입력':fmt(v.ratio,3)}</dd></div></dl><p class="beam-muted">KDS 14 20 22, 식 4.2-1·4.3-1·4.3-3, 4.3.2·4.3.4(9). Av = ${p.legs} × 스터럽 1가닥 면적. 상한을 넘는 Vs는 φVn에 산입하지 않고 조건 미달로 표시합니다. 최소철근 면제는 적용하지 않았습니다. 정착된 유효 다리 수를 입력하세요.</p>`;
  }catch(e){error('b_shear',e);}
  try{
    if(!sk)throw Error('표피철근 입력을 수정하면 물량을 계산합니다.');
    const q=RCBeamChecks.quantities(p,g,r,sk);
    get('b_quantities').innerHTML=`<table class="beam-quantity-table"><thead><tr><th>항목</th><th>1m당 물량</th><th>금액 (원)</th></tr></thead><tbody><tr><td>콘크리트</td><td>${fmt(q.concrete,4)} m³</td><td>${fmt(q.concreteCost,0)}</td></tr><tr><td>인장 주철근</td><td>${fmt(q.tension,5)} tonf</td><td>${fmt(q.tension*p.steelPrice,0)}</td></tr><tr><td>상부 압축철근</td><td>${fmt(q.compression,5)} tonf</td><td>${fmt(q.compression*p.steelPrice,0)}</td></tr><tr><td>표피철근</td><td>${fmt(q.skin,5)} tonf</td><td>${fmt(q.skin*p.steelPrice,0)}</td></tr><tr><td>스터럽 · 내부 다리</td><td>${fmt(q.stirrups,5)} tonf</td><td>${fmt(q.stirrups*p.steelPrice,0)}</td></tr><tr><td>철근 할증 ${fmt(p.wastePercent,1)}%</td><td>${fmt(q.steel-q.netSteel,5)} tonf</td><td>${fmt((q.steel-q.netSteel)*p.steelPrice,0)}</td></tr><tr><th>철근 합계</th><th>${fmt(q.steel,5)} tonf</th><th>${fmt(q.steelCost,0)}</th></tr></tbody></table><p class="beam-quantity-total">합계 ${fmt(q.totalCost,0)} 원 / m</p><p class="beam-muted">선택한 ${r.total}-${p.bar} (${r.key}) 배치 기준. 콘크리트는 철근 체적을 공제하지 않은 총체적입니다. 철근 밀도 7,850 kg/m³, 표준중력 중량환산 tonf(수치상 질량 t와 동일)를 사용합니다.</p><p class="beam-muted">스터럽 ${fmt(q.stations,3)}조/m × ${fmt(q.cutLength,1)} mm/조. 길이 ${p.stirrupCutLength===null?'자동 개산':'직접 입력'} · 반복 구간 평균 물량이며 양끝 스터럽을 중복 가산하지 않습니다. 개별 조각 1m의 발주 개수·이음·정착·굽힘 가공 상세는 별도입니다. 금액은 입력 단가에 따른 재료비입니다.</p>${!r.eligible||!sk.ok?'<p class="warn">휨 또는 표피철근 조건 미달 배치의 참고 물량입니다.</p>':''}`;
  }catch(e){error('b_quantities',e);}
  return sk;
}
function select(key){
  if(!current)return;
  const {p,g,results}=current,r=results.find(x=>x.key===key);if(!r)return;
  selectedKey=key;
  const sk=renderChecks(p,g,r);
  get('b_diagram').innerHTML=diagram(p,g,r,sk);
  get('b_selected').innerHTML=`<p class="beam-layout">${r.total}-${p.bar} <span>${r.key} · ${r.counts.length}단</span></p><p class="beam-muted">${g.compression?`상부 ${g.compression.count}-${p.compressionBar} · d′ ${fmt(g.compression.d,2)} mm · 실제 ${r.compression.stress<=0?'압축':'인장'}응력 ${fmt(Math.abs(r.compression.stress),2)} MPa`:'상부 압축철근 없음'}</p><p class="beam-capacity">${fmt(r.phiMn,2)} <small>kN·m</small></p><p>설계휨강도 φMn</p><p class="${r.eligible?'ok':'warn'}">${r.eligible?'휨 단면조건 충족':r.reasons.join(' / ')}</p><dl class="beam-values"><div><dt>인장철근량 As</dt><dd>${fmt(r.As,1)} mm²</dd></div><div><dt>상부 철근량 A′s</dt><dd>${fmt(g.compression?g.compression.count*g.compression.bar.area:0,1)} mm²</dd></div><div><dt>도심 유효깊이 d</dt><dd>${fmt(r.d,2)} mm</dd></div><div><dt>중립축 c</dt><dd>${fmt(r.c,2)} mm</dd></div><div><dt>최외단 변형률 εt</dt><dd>${fmt(r.et,5)} / 최소 ${fmt(r.emin,4)}</dd></div><div><dt>강도감소계수 φ</dt><dd>${fmt(r.phi,4)}</dd></div><div><dt>최소철근 기준 1.2Mcr</dt><dd>${fmt(r.minMoment,2)} kN·m</dd></div></dl><p class="beam-muted">파랑: 인장철근 · 황색: 상부 철근 · 녹색: 표피철근<br>점선: 중립축 · 음영: 압축블록<br>내부 다리는 배치 개념도입니다. 갈고리·굽힘부·정착 상세는 생략했습니다.</p>`;
  for(const tr of get('b_rows').querySelectorAll('tr')){const on=tr.dataset.key===key;tr.classList.toggle('selected',on);tr.querySelector('button').setAttribute('aria-pressed',String(on));}
  get('b_detail_rows').innerHTML=r.layers.map((l,i)=>`<li>${i+1}단: ${l.count}가닥 · 깊이 ${fmt(l.d,2)} mm · 인장변형률 ${fmt(r.strains[i],5)} · 철근응력 ${fmt(r.stresses[i],2)} MPa</li>`).join('');
  if(g.compression)get('b_detail_rows').innerHTML+=`<li>상부 ${g.compression.count}-${p.compressionBar}: 깊이 d′ = ${fmt(g.compression.d,2)} mm · ${r.compression.stress<=0?'압축':'인장'}응력 ${fmt(Math.abs(r.compression.stress),2)} MPa (변형률 적합으로 산정, 항복을 가정하지 않음)</li>`;
}
function update(){
  get('b_error').hidden=true;
  get('b_skin_count_field').hidden=get('b_skin_mode').value!=='manual';
  get('b_custom_field').hidden=get('b_fck').value!=='custom';
  try{
    const p=read(),out=RCBeam.calculate(p),{g,results}=out;
    current={p,...out};get('b_conditions').textContent=`피복 ${fmt(p.cover,0)} mm · 골재 ${fmt(p.aggregate,0)} mm`;
    if(!results.length)throw Error(out.message||'좌우대칭·상하 정렬 조건을 만족하는 배치가 없습니다.');
    get('b_results').hidden=false;
    get('b_stats').innerHTML=`<div><span>한 단 최대</span><b>${g.perLayer}<small> 가닥</small></b></div><div><span>최대 ${g.maxLayers}단의 기하학적 배치</span><b>${g.perLayer*g.maxLayers}<small> 가닥</small></b></div><div><span>휨 단면조건 충족 배치</span><b>${results.filter(r=>r.eligible).length}<small> / ${results.length}개</small></b></div>`;
    get('b_rows').innerHTML=results.map(r=>`<tr data-key="${r.key}"><td>${r.total}-${p.bar}</td><td>${r.key} <small>(${r.counts.length}단)</small></td><td>${fmt(r.As,1)}</td><td>${fmt(r.d,1)}</td><td>${fmt(r.phi,3)}</td><td class="beam-phi">${fmt(r.phiMn,2)}</td><td class="${r.eligible?'ok':'warn'}">${r.eligible?'충족':r.reasons.join('<br>')}</td><td><button type="button" class="beam-view" data-layout="${r.key}" aria-label="${r.key} 배치 보기" aria-pressed="false">보기</button></td></tr>`).join('');
    get('b_basis').innerHTML=`<ul class="beam-basis"><li>fck = ${fmt(p.fck,2)} MPa · fy = ${fmt(p.fy,0)} MPa · fyt = ${fmt(p.fyt,0)} MPa (전단강도에 사용)</li><li>상부 압축철근: ${g.compression?`${g.compression.count}-${p.compressionBar}, d′ = ${fmt(g.compression.d,2)} mm`:'없음'}. 실제 응력은 변형률로 계산하며 압축블록과 중복되는 철근 면적은 공제합니다.</li><li>${p.bar}: 공칭지름 ${fmt(g.bar.diameter,2)} mm, 공칭단면적 ${fmt(g.bar.area,2)} mm² · ${p.stirrup}: 공칭지름 ${fmt(g.st.diameter,2)} mm</li><li>수평 최소 순간격 = max(25, db, 4/3 × 골재) = ${fmt(g.horizontalClear,2)} mm</li><li>수직 순간격 = max(25, 4/3 × 골재) = ${fmt(g.verticalClear,2)} mm</li><li>한 단 최대 = floor((b − 2(피복 + 스터럽 지름) + 수평 순간격) / (db + 수평 순간격)) = ${g.perLayer}가닥</li><li>수평 배치: 하부단 좌우대칭, 상부 철근은 하부 철근과 같은 연직면에 정렬. 배치가 성립하지 않는 가닥 수는 생략합니다.</li><li>각 단 εs = εcu(c − dᵢ)/c, fs = Es·εs (±fy 이내), Es = 200,000 MPa. ΣF = 0을 만족하는 c를 구하고 각 단의 모멘트를 합산합니다.</li><li>φMn ≥ 1.2Mcr와 εt ≥ εmin 확인. Mu 미입력으로 최소철근 면제조건은 적용하지 않습니다.</li></ul><details class="beam-settings"><summary>선택 배치의 단별 계산값 · 근거 조항</summary><ul id="b_detail_rows"></ul><p>KDS 14 20 50 : 2022, 4.2.2(1)(2) / KDS 14 20 01 : 2022, 3.1.1(2)④ / KDS 14 20 20 : 2022, 4.1.1·표 4.1-2·4.1.2(4)(5)·4.2.2(1) / KDS 14 20 10 : 2021, 4.2.3 / KDS 14 20 30 : 2021, 식 4.2-2·4.2-3</p><p>철근 공칭치수: <a href="https://www.hansco.co.kr/kr/index.php?pCode=MN7000044" target="_blank" rel="noopener">KS D 3504 제조사 규격표</a></p></details>`;
    const preferred=results.find(r=>r.key===selectedKey)||results.filter(r=>r.eligible).reduce((a,b)=>!a||b.phiMn>a.phiMn?b:a,null)||results[0];select(preferred.key);
  }catch(e){current=null;get('b_results').hidden=true;get('b_rows').innerHTML='';get('b_diagram').innerHTML='';get('b_selected').innerHTML='';get('b_error').hidden=false;get('b_error').textContent=e.message;for(const id of ['b_skin','b_shear','b_quantities'])get(id).innerHTML='';}
}
get('b_rows').addEventListener('click',e=>{const b=e.target.closest('button[data-layout]');if(b)select(b.dataset.layout);});
get('t1').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
update();
})();
