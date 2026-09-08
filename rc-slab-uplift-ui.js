(function(){
'use strict';
const get=id=>document.getElementById(id);
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const num=id=>{const v=get(id).value.trim();return v===''?NaN:Number(v);};
const FACE={top:{label:'상부',cls:'top'},bottom:{label:'하부',cls:'bottom'}};
const DIR={l1:'X',l2:'Y'};
let current=null,planDir='l1',planStrip=null;
function read(){
  return {l1:num('s_l1'),l2:num('s_l2'),footing:num('s_footing'),h:num('s_h'),
    hw:num('s_hw'),qsd:num('s_qsd'),gammaW:num('s_gw'),gammaC:num('s_gc'),
    fck:num('s_fck'),fy:num('s_fy'),bar:get('s_bar').value,spacing:num('s_spacing'),
    coverTop:num('s_cover_top'),coverBottom:num('s_cover_bottom'),
    spanType:get('s_span_type').value,endCase:Number(get('s_end_case').value),
    column:num('s_col')};
}
const face=f=>`<span class="slab-face ${FACE[f].cls}">${FACE[f].label} 인장</span>`;

/* Plan of a 2x2 bay so the design strip straddling the centre grid line reads
 * correctly: it is centred on the line, not on a panel. */
function diagram(p,o){
  const f=p.footing,col=Math.max(0,Math.min(p.column||0,f));
  const W=2*p.l1+f,H=2*p.l2+f;
  const scale=Math.min(470/W,360/H),ML=54,MT=44,MR=104,MB=48;
  const X=v=>ML+v*scale,Y=v=>MT+v*scale;
  const gx=[f/2,f/2+p.l1,f/2+2*p.l1],gy=[f/2,f/2+p.l2,f/2+2*p.l2];
  const d=o.directions.find(x=>x.dir===planDir)||o.directions[0];
  const cw=d.columnWidth,total=d.transverse,along=planDir==='l1';
  const centre=along?gy[1]:gx[1];
  const pick=s=>s?`${s.bar}@${s.spacing}`:'배근 불가';
  const spec=strip=>pick((d.rows.find(r=>r.strip===strip)||{}).suggestion);
  const bottomSpec=()=>pick(d.bottom.suggestion);
  const band=(from,to,strip)=>{
    const fill=strip==='column'?'var(--accent)':'var(--ok)';
    const r=along
      ?`<rect x="${X(0)}" y="${Y(from)}" width="${W*scale}" height="${(to-from)*scale}" fill="${fill}"/>`
      :`<rect x="${X(from)}" y="${Y(0)}" width="${(to-from)*scale}" height="${H*scale}" fill="${fill}"/>`;
    return `<g class="slab-strip" data-dir="${planDir}" data-strip="${strip}" data-on="${planStrip===strip}" style="color:${fill}"><title>${strip==='column'?'주열대':'중간대'} — 클릭하면 검토표에서 해당 행을 강조합니다</title>${r}</g>`;
  };
  const strips=[band(centre-cw/2,centre+cw/2,'column'),
    band(centre-total/2,centre-cw/2,'middle'),band(centre+cw/2,centre+total/2,'middle')].join('');
  /* Practice runs both mats continuously for buildability rather than cutting
   * them off where each moment sign ends, so the drawing shows one
   * uninterrupted top layer and one bottom layer per strip. */
  const extent=along?W:H;
  const px=(a,t)=>along?[X(a),Y(t)]:[X(t),Y(a)];
  function rebar(bc,thickness,strip,labelled){
    const line=(cls,off)=>{
      const [x1,y1]=px(0,bc),[x2,y2]=px(extent,bc);
      return along?`<line class="bar ${cls}" x1="${x1}" x2="${x2}" y1="${y1+off}" y2="${y2+off}"/>`
                 :`<line class="bar ${cls}" x1="${x1+off}" x2="${x2+off}" y1="${y1}" y2="${y2}"/>`;
    };
    const out=line('top',-6)+line('bottom',6);
    if(!labelled||thickness*scale<30)return out;
    const anchor=along?(gx[0]+gx[1])/2:(gy[0]+gy[1])/2;
    const lab=(txt,off)=>{
      const [x,y]=px(anchor,bc);
      return along?`<text class="bar-label" x="${x}" y="${y+off}" text-anchor="middle">${txt}</text>`
                 :`<text class="bar-label" x="${x+off}" y="${y}" text-anchor="middle" transform="rotate(-90 ${x+off} ${y})">${txt}</text>`;
    };
    return out+lab(`${spec(strip)}(T)`,-11)+lab(`${bottomSpec()}(B)`,19);
  }
  // Both halves of the middle strip carry the same bars, so only one is labelled.
  const bars=[rebar(centre,cw,'column',true),
    rebar((centre-total/2+centre-cw/2)/2,total/2-cw/2,'middle',true),
    rebar((centre+cw/2+centre+total/2)/2,total/2-cw/2,'middle',false)].join('');
  const lines=[];
  for(const v of gx)lines.push(`<line x1="${X(v)}" x2="${X(v)}" y1="${Y(0)-16}" y2="${Y(H)+16}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="7 5"/>`);
  for(const v of gy)lines.push(`<line x1="${X(0)-16}" x2="${X(W)+16}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="7 5"/>`);
  const pads=[],cols=[];
  for(const cx of gx)for(const cy of gy){
    pads.push(`<rect x="${X(cx-f/2)}" y="${Y(cy-f/2)}" width="${f*scale}" height="${f*scale}" fill="var(--dim)" fill-opacity=".45" stroke="var(--dim)"/>`);
    if(col>0)cols.push(`<rect x="${X(cx-col/2)}" y="${Y(cy-col/2)}" width="${col*scale}" height="${col*scale}" fill="var(--accent)"/>`);
  }
  const dimH=(x1,x2,y,label)=>`<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="var(--dim)"/><line x1="${x1}" x2="${x1}" y1="${y-4}" y2="${y+4}" stroke="var(--dim)"/><line x1="${x2}" x2="${x2}" y1="${y-4}" y2="${y+4}" stroke="var(--dim)"/><text class="dim" x="${(x1+x2)/2}" y="${y-6}" text-anchor="middle">${label}</text>`;
  const dimV=(y1,y2,x,label)=>`<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}" stroke="var(--dim)"/><line x1="${x-4}" x2="${x+4}" y1="${y1}" y2="${y1}" stroke="var(--dim)"/><line x1="${x-4}" x2="${x+4}" y1="${y2}" y2="${y2}" stroke="var(--dim)"/><text class="dim" x="${x+7}" y="${(y1+y2)/2+4}">${label}</text>`;
  const gap=along?p.l1-f:p.l2-f;
  const dims=[
    dimH(X(gx[0]),X(gx[1]),MT-24,`l1 = ${fmt(p.l1,0)}`),
    dimV(Y(gy[0]),Y(gy[1]),X(W)+26,`l2 = ${fmt(p.l2,0)}`),
    dimH(X(gx[0]-f/2),X(gx[0]+f/2),Y(H)+22,`기초 ${fmt(f,0)}`),
    // Kept on the first grid line so it never runs under the rebar labels.
    along?dimH(X(gx[0]+f/2),X(gx[1]-f/2),Y(gy[0])-10,`기초면 ${fmt(gap,0)}`)
         :dimV(Y(gy[0]+f/2),Y(gy[1]-f/2),X(gx[0])+10,`기초면 ${fmt(gap,0)}`)
  ].join('');
  const label=along?`<text x="${X(0)}" y="${Y(centre-total/2)-6}">X 방향 설계대 (폭 ${fmt(total,0)} mm)</text>`
    :`<text x="${X(centre-total/2)}" y="${Y(0)-6}">Y 방향 설계대 (폭 ${fmt(total,0)} mm)</text>`;
  return `<svg viewBox="0 0 ${ML+W*scale+MR} ${MT+H*scale+MB}" role="img" aria-label="기둥 그리드 ${fmt(p.l1,0)} × ${fmt(p.l2,0)} mm, 독립기초 ${fmt(f,0)} mm 정사각형, ${DIR[planDir]} 방향 설계대 주열대 폭 ${fmt(cw,0)} mm">`+
    `<rect x="${X(0)}" y="${Y(0)}" width="${W*scale}" height="${H*scale}" fill="var(--code)" stroke="var(--line)"/>`+
    strips+lines.join('')+pads.join('')+cols.join('')+bars+dims+label+`</svg>`;
}
function renderPlan(p,o){
  if(!o.directions.length){get('s_diagram').innerHTML='';get('s_plan_controls').innerHTML='';return;}
  const d=o.directions.find(x=>x.dir===planDir)||o.directions[0];
  const spec=s=>s?`${s.bar}@${s.spacing}`:'<span class="warn">배근 불가</span>';
  const bot=`${spec(d.bottom.suggestion)} <small>최소철근 지배</small>`;
  const specs=['column','middle'].map(s=>{
    const r=d.rows.find(x=>x.strip===s);
    return `<tr><td>${s==='column'?'주열대':'중간대'}</td><td>${spec(r&&r.suggestion)} <small>Mu ${fmt(r?r.Mu:NaN,1)}</small></td><td>${bot}</td></tr>`;
  }).join('');
  const rule=dash=>`<svg width="34" height="9" aria-hidden="true"><line x1="1" y1="5" x2="33" y2="5" stroke="var(--bar)" stroke-width="2.4"${dash?' stroke-dasharray="7 5"':''}/></svg>`;
  get('s_plan_controls').innerHTML=['l1','l2'].map(dir=>
    `<button type="button" data-plan-dir="${dir}" aria-pressed="${planDir===dir}">${DIR[dir]} 방향 설계대</button>`).join('')+
    `<span>주열대 ${fmt(d.columnWidth,0)} · 중간대 ${fmt(d.middleWidth,0)} mm</span>`;
  get('s_diagram').innerHTML=diagram(p,o)+
    `<div class="slab-legend"><span>${rule(false)} 실선 <b>상부근 (T)</b> · 중앙부 정모멘트</span><span>${rule(true)} 점선 <b>하부근 (B)</b> · 최소철근</span></div>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>${DIR[planDir]} 방향 설계대</th><th>상부근 (T · 실선)</th><th>하부근 (B · 점선)</th></tr></thead><tbody>${specs}</tbody></table></div>`+
    `<p class="beam-muted">회색 사각형이 독립기초, 파란 사각형이 기둥(표시용), 검은 점선이 기둥 그리드입니다. 파란 띠가 주열대, 녹색 띠가 중간대이며 <b>클릭하면 아래 검토표에서 해당 행이 강조</b>됩니다. 설계대는 패널이 아니라 그리드 선을 중심으로 잡힙니다.</p>`+
    `<p class="beam-muted">시공성을 위해 상하부근을 끊지 않고 전 구간 동일하게 배근하는 실무 관행에 따라 두 층 모두 연속으로 표시합니다. 상부근은 중앙부 정모멘트로 정하고, 하부근은 받침부 부모멘트를 기초가 담당하므로 최소철근이 지배합니다.</p>`+
    `<p class="beam-muted">순경간 ln = ${fmt(d.ln,0)} mm${d.floored?` — 기초면 사이 ${fmt(d.raw,0)} mm가 0.65 l 하한 ${fmt(d.floor,0)} mm보다 작아 하한을 적용했습니다.`:''}</p>`;
}
function renderLoad(p,o){
  const w=o.load;
  get('s_load').innerHTML=`<p class="beam-capacity">${fmt(w.qu,2)} <small>kN/m²</small></p><p>순 상향 계수하중 qu</p>`+
    `<dl class="beam-values"><div><dt>양압력 γw · hw</dt><dd>${fmt(w.uplift,2)} kN/m²</dd></div>`+
    `<div><dt>슬래브 자중</dt><dd>${fmt(w.selfWeight,2)} kN/m²</dd></div>`+
    `<div><dt>고정 상재하중</dt><dd>${fmt(p.qsd,2)} kN/m²</dd></div>`+
    `<div><dt>저항 고정하중 합</dt><dd>${fmt(w.dead,2)} kN/m²</dd></div></dl>`+
    `<p class="beam-muted">qu = 1.6 × ${fmt(w.uplift,2)} − 0.9 × ${fmt(w.dead,2)} = ${fmt(w.qu,2)} kN/m². 사용자가 지정한 하중조합이며 KDS 하중조합식을 그대로 옮긴 것이 아닙니다. 활하중은 저항으로 산입하지 않았습니다.</p>`+
    (o.message?`<p class="warn">${o.message}</p>`:'');
}
function renderGeometry(p,o){
  if(!o.directions.length){get('s_geometry').innerHTML='';return;}
  const rows=o.directions.map(d=>
    `<tr><td>${DIR[d.dir]} 방향</td><td>${fmt(d.span,0)}</td><td>${fmt(d.ln,0)}${d.floored?' <small>(0.65 l 하한)</small>':''}</td><td>${fmt(d.transverse,0)}</td><td>${fmt(d.columnWidth,0)}</td><td>${fmt(d.middleWidth,0)}</td><td class="beam-phi">${fmt(d.Mo,1)}</td></tr>`).join('');
  get('s_geometry').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>방향</th><th>경간 l (mm)</th><th>순경간 ln (mm)</th><th>직교 경간 l2 (mm)</th><th>주열대 폭 (mm)</th><th>중간대 폭 (mm)</th><th>Mo (kN·m)</th></tr></thead><tbody>${rows}</tbody></table></div>`+
    `<p class="beam-muted">Mo = qu · l2 · ln² / 8 (KDS 14 20 70 식 4.1-2). 순경간은 기초면 사이 거리이고 0.65 l 이 하한입니다(4.1.3.2(5)). 주열대 폭 = 2 × min(0.25 l1, 0.25 l2) (4.1.2.1(2)).</p>`+
    (o.limits.notes.length?`<p class="warn">직접설계법 제한사항 이탈: ${o.limits.notes.join(' / ')}</p>`:'');
}
function renderSections(p,o){
  if(!o.directions.length){get('s_sections').innerHTML='';return;}
  const cells=(r,c,s)=>`<td>${face(r.face)}</td><td>${Number.isFinite(r.Mu)&&r.Mu>0?fmt(r.Mu,1):'—'}</td><td>${fmt(c.d,1)}</td><td>${fmt(c.As,0)}</td><td>${fmt(c.phi,3)}</td><td class="beam-phi">${fmt(c.phiMn,1)}</td><td class="${c.ok?'ok':'warn'}">${c.ok?'충족':c.reasons.join('<br>')}</td><td>${s?`${s.bar}@${s.spacing}`:'<span class="warn">없음</span>'}</td>`;
  const rows=o.directions.flatMap(d=>[
    ...d.rows.map(r=>`<tr data-dir="${d.dir}" data-strip="${r.strip}"><td>${DIR[d.dir]}</td><td>상부근 · ${r.label}</td><td>${r.strip==='column'?'주열대':'중간대'} <small>${fmt(100*r.share,0)}%</small></td>${cells(r,r.check,r.suggestion)}</tr>`),
    `<tr><td>${DIR[d.dir]}</td><td>하부근 · 설계 모멘트 없음</td><td>전 구간</td>${cells(d.bottom,d.bottom.check,d.bottom.suggestion)}</tr>`
  ]).join('');
  const support=o.directions.flatMap(d=>d.support.map(r=>
    `<tr><td>${DIR[d.dir]}</td><td>${r.label}</td><td>${r.strip==='column'?'주열대':'중간대'} <small>${fmt(100*r.share,0)}%</small></td><td>${fmt(r.Mu,1)}</td><td>${fmt(r.total,1)}</td></tr>`)).join('');
  get('s_sections').innerHTML=`<p class="slab-note"><b>양압력은 상향이라 중앙부는 슬래브 상부가 인장입니다.</b> 통상 중력하중 슬래브와 반대이므로 배근 위치를 확인하세요. 받침부 부모멘트는 기초가 담당하므로 이 슬래브의 배근을 정하지 않으며, 하부근은 최소철근이 지배합니다.</p>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>방향</th><th>검토 대상</th><th>설계대</th><th>인장면</th><th>Mu (kN·m/m)</th><th>d (mm)</th><th>As (mm²/m)</th><th>φ</th><th>φMn (kN·m/m)</th><th>판정</th><th>제안 배근</th></tr></thead><tbody>${rows}</tbody></table></div>`+
    `<dl class="beam-values"><div><dt>입력 배근</dt><dd>${p.bar} @ ${fmt(p.spacing,0)} mm</dd></div><div><dt>최소철근량 (수축·온도)</dt><dd>${fmt(o.AsMin,0)} mm²/m · ρ ${fmt(100*o.minimumRatio,3)}%</dd></div><div><dt>위험단면 최대 철근간격</dt><dd>${fmt(o.maxSpacing,0)} mm</dd></div></dl>`+
    `<p class="beam-muted">상부근 행을 클릭하면 위 평면도에서 해당 설계대가 강조됩니다. 제안 배근은 입력한 규격으로 φMn ≥ Mu, 최소철근량, 최대간격을 모두 만족하는 가장 넓은 간격입니다. 정착·이음·단부 연장길이는 별도입니다.</p>`+
    `<h3 class="beam-subheading">받침부 부모멘트 — 기초 설계 대상</h3>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>방향</th><th>위험단면</th><th>설계대</th><th>Mu (kN·m/m)</th><th>설계대 전체 (kN·m)</th></tr></thead><tbody>${support}</tbody></table></div>`+
    `<p class="beam-muted">참고값입니다. 이 모멘트는 독립기초로 전달되어 기초에서 저항하므로 위 슬래브 배근에 반영하지 않았습니다. 기초 설계는 이 화면의 범위가 아닙니다.</p>`;
}
function renderBasis(p,o){
  get('s_basis').innerHTML=`<ul class="beam-basis">`+
    `<li>해석: 직접설계법 (KDS 14 20 70, 4.1.3). 보가 없어 α1 = 0, βt = 0이므로 주열대 분배율은 내부 부모멘트 75%, 정모멘트 60%, 외부 부모멘트 100%로 고정됩니다(표 4.1-2·4.1-3·4.1-4).</li>`+
    `<li>경간 분배: ${p.spanType==='interior'?'내부 경간 — 부 0.65 / 정 0.35 (4.1.3.3(2))':`단부 경간 — ${RCSlabUplift.END_CASES[p.endCase].name} (표 4.1-1)`}</li>`+
    `<li>휨: 변형률 적합과 탄소성 철근응력으로 ΣF = 0인 중립축을 구하고 φ를 최외단 인장변형률로 산정합니다. Es = 200,000 MPa (KDS 14 20 20 4.1.1·4.1.2, KDS 14 20 10 4.2.3).</li>`+
    `<li>최소철근: 수축·온도철근비 ${p.fy<=400?'0.0020':'0.0020 × 400/fy'}, 하한 0.0014, 상한 1,800 mm²/m (KDS 14 20 50, 4.6.2).</li>`+
    `<li>철근 간격: 위험단면에서 슬래브 두께의 2배 이하, 300 mm 이하 (KDS 14 20 70, 4.1.5.1(2)).</li>`+
    `<li>하중조합은 사용자가 지정한 qu = 1.6 × 양압력 − 0.9 × 고정하중입니다. KDS 하중조합식을 옮긴 것이 아니므로 적용 책임은 사용자에게 있습니다.</li>`+
    `</ul><details class="beam-settings"><summary>검토하지 않은 항목</summary><ul class="beam-basis">`+
    `<li>전단 — 1방향 전단과 뚫림전단 모두 검토하지 않습니다. 이 화면은 휨 철근만 다룹니다.</li>`+
    `<li>부력에 대한 구조물 전체 부상 안정, 균열폭, 처짐, 정착·이음 상세</li>`+
    `<li>기초판 자체의 설계, 지반 반력 분포, 말뚝 반력</li>`+
    `<li>평면도의 기둥 크기는 표시용이며 계산에 쓰지 않습니다. 지지점은 독립기초입니다.</li>`+
    `<li>직접설계법 제한사항 중 계산으로 확인한 것은 장변/단변 비뿐입니다. 각 방향 3경간 이상 연속, 인접 경간차 1/3 이하, 기둥 어긋남 10% 이하는 사용자가 확인해야 합니다 (4.1.3.1).</li>`+
    `<li>기초 배치가 불규칙하거나 패널이 매우 큰 경우에는 등가골조법이나 유한요소해석이 적합합니다. 직접설계법은 설계대 평균 모멘트만 제공합니다.</li>`+
    `</ul></details>`;
}
function highlight(){
  for(const tr of get('s_sections').querySelectorAll('tbody tr'))
    tr.classList.toggle('selected',!!planStrip&&tr.dataset.dir===planDir&&tr.dataset.strip===planStrip);
}
function select(dir,strip){
  planStrip=(planDir===dir&&planStrip===strip)?null:strip;
  planDir=dir;
  if(current){renderPlan(current.p,current.o);highlight();}
}
function update(){
  get('s_error').hidden=true;
  get('s_end_field').hidden=get('s_span_type').value!=='end';
  try{
    const p=read(),o=RCSlabUplift.calculate(p);
    current={p,o};
    get('s_results').hidden=false;
    renderPlan(p,o);renderLoad(p,o);renderGeometry(p,o);renderSections(p,o);renderBasis(p,o);
    highlight();
  }catch(e){
    current=null;get('s_results').hidden=true;get('s_error').hidden=false;get('s_error').textContent=e.message;
    for(const id of ['s_diagram','s_plan_controls','s_load','s_geometry','s_sections','s_basis'])get(id).innerHTML='';
  }
}
get('s_plan_controls').addEventListener('click',e=>{
  const b=e.target.closest('button[data-plan-dir]');
  if(b&&current){planDir=b.dataset.planDir;planStrip=null;renderPlan(current.p,current.o);highlight();}
});
get('s_diagram').addEventListener('click',e=>{
  const g=e.target.closest('.slab-strip');
  if(g)select(g.dataset.dir,g.dataset.strip);
});
get('s_sections').addEventListener('click',e=>{
  const tr=e.target.closest('tr[data-dir]');
  if(tr)select(tr.dataset.dir,tr.dataset.strip);
});
get('s_print').addEventListener('click',()=>{
  const closed=[...document.querySelectorAll('#t5 details')].filter(d=>!d.open);
  closed.forEach(d=>{d.open=true;});
  const restore=()=>{closed.forEach(d=>{d.open=false;});window.removeEventListener('afterprint',restore);};
  window.addEventListener('afterprint',restore);
  window.print();
});
get('t5').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
update();
})();
