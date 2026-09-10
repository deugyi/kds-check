(function(){
'use strict';
const get=id=>document.getElementById(id);
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const num=id=>{const v=get(id).value.trim();return v===''?NaN:Number(v);};
const UNIT_WEIGHT={water:9.81,concrete:24,plain:23};
const FACE={top:{label:'상부',cls:'top'},bottom:{label:'하부',cls:'bottom'}};
const DIR={l1:'X',l2:'Y'};
const COMBO={uplift:'양압력',gravity:'중력하중'};
let current=null,planDir='l1',planStrip=null;
function read(){
  const plainHeight=num('s_plain_height');
  if(!Number.isFinite(plainHeight)||plainHeight<0)throw new Error('무근 콘크리트 높이는 0 이상의 숫자로 입력하세요.');
  return {l1:num('s_l1'),l2:num('s_l2'),footing:num('s_footing'),h:num('s_h'),
    hw:num('s_hw'),liveLoad:num('s_live'),loadCase:get('s_load_case').value,plainHeight,qsd:plainHeight/1000*UNIT_WEIGHT.plain,gammaW:UNIT_WEIGHT.water,gammaC:UNIT_WEIGHT.concrete,
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
  const spec=(strip,f)=>{
    const r=d.rows.find(x=>x.strip===strip&&x.face===f);
    return r&&r.suggestion?`${r.suggestion.bar}@${r.suggestion.spacing}`:'배근 불가';
  };
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
  function rebar(bc,thickness,strip){
    const line=(cls,off)=>{
      const [x1,y1]=px(0,bc),[x2,y2]=px(extent,bc);
      return along?`<line class="bar ${cls}" x1="${x1}" x2="${x2}" y1="${y1+off}" y2="${y2+off}"/>`
                 :`<line class="bar ${cls}" x1="${x1+off}" x2="${x2+off}" y1="${y1}" y2="${y2}"/>`;
    };
    const out=line('top',-6)+line('bottom',6);
    if(thickness*scale<30)return out;
    const anchor=along?(gx[0]+gx[1])/2:(gy[0]+gy[1])/2;
    const lab=(txt,off)=>{
      const [x,y]=px(anchor,bc);
      return along?`<text class="bar-label" x="${x}" y="${y+off}" text-anchor="middle">${txt}</text>`
                 :`<text class="bar-label" x="${x+off}" y="${y}" text-anchor="middle" transform="rotate(-90 ${x+off} ${y})">${txt}</text>`;
    };
    return out+lab(`${spec(strip,'top')}(T)`,-11)+lab(`${spec(strip,'bottom')}(B)`,19);
  }
  // The middle strip lies either side of the column strip but is one design
  // strip with one result, so it is drawn once rather than mirrored.
  const bars=[rebar(centre,cw,'column'),
    rebar((centre-total/2+centre-cw/2)/2,total/2-cw/2,'middle')].join('');
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
  const cell=(strip,f)=>{
    const r=d.rows.find(x=>x.strip===strip&&x.face===f);
    if(!r)return '—';
    const s=r.suggestion?`${r.suggestion.bar}@${r.suggestion.spacing}`:'<span class="warn">배근 불가</span>';
    return `${s} <small>Mu ${fmt(r.Mu,1)} · ${COMBO[r.combo]} · ${r.label}</small>`;
  };
  const specs=['column','middle'].map(s=>
    `<tr><td>${s==='column'?'주열대':'중간대'}</td><td>${cell(s,'top')}</td><td>${cell(s,'bottom')}</td></tr>`).join('');
  const rule=dash=>`<svg width="34" height="9" aria-hidden="true"><line x1="1" y1="5" x2="33" y2="5" stroke="var(--bar)" stroke-width="2.4"${dash?' stroke-dasharray="7 5"':''}/></svg>`;
  get('s_plan_controls').innerHTML=['l1','l2'].map(dir=>
    `<button type="button" data-plan-dir="${dir}" aria-pressed="${planDir===dir}">${DIR[dir]} 방향 설계대</button>`).join('')+
    `<span>주열대 ${fmt(d.columnWidth,0)} · 중간대 ${fmt(d.middleWidth,0)} mm</span>`;
  get('s_diagram').innerHTML='<button type="button" class="drawing-zoom" aria-pressed="false">도면 확대</button><div class="diagram-scroll">'+diagram(p,o)+'</div>'+
    `<div class="slab-legend"><span>${rule(false)} 실선 <b>상부근 (T)</b></span><span>${rule(true)} 점선 <b>하부근 (B)</b></span></div>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>${DIR[planDir]} 방향 설계대</th><th>상부근 (T · 실선)</th><th>하부근 (B · 점선)</th></tr></thead><tbody>${specs}</tbody></table></div>`+
    `<p class="beam-muted">회색 사각형이 독립기초, 파란 사각형이 기둥(표시용), 검은 점선이 기둥 그리드입니다. 파란 띠가 주열대, 녹색 띠가 중간대이며 <b>클릭하면 아래 검토표에서 해당 행이 강조</b>됩니다. 설계대는 패널이 아니라 그리드 선을 중심으로 잡힙니다.</p>`+
    `<p class="beam-muted">시공성을 위해 상하부근을 끊지 않고 전 구간 동일하게 배근하는 실무 관행에 따라 두 층 모두 연속으로 표시합니다. 양압력과 중력하중은 인장면이 반대입니다. 선택한 조합에서 상·하부 각각의 지배 모멘트로 배근을 정하고 둘을 합쳐 단면 최소철근을 확인합니다. 중간대는 주열대 양쪽에 놓이지만 하나의 설계대이므로 철근을 한 번만 그립니다.</p>`+
    `<p class="beam-muted">순경간 ln = ${fmt(d.ln,0)} mm${d.floored?` — 기초면 사이 ${fmt(d.raw,0)} mm가 0.65 l 하한 ${fmt(d.floor,0)} mm보다 작아 하한을 적용했습니다.`:''}</p>`;
}
function renderLoad(p,o){
  const w=o.load;
  get('s_load').innerHTML=`<dl class="beam-values"><div><dt>단위중량 (고정)</dt><dd>물 ${UNIT_WEIGHT.water} · 철근콘크리트 ${UNIT_WEIGHT.concrete} · 무근 콘크리트 ${UNIT_WEIGHT.plain} kN/m³</dd></div><div><dt>무근 콘크리트 하중</dt><dd>${fmt(p.plainHeight,0)} / 1,000 × ${UNIT_WEIGHT.plain} = ${fmt(p.qsd,2)} kN/m²</dd></div><div><dt>양압력 H</dt><dd>${fmt(w.uplift,2)} kN/m²</dd></div><div><dt>자중 + 무근 콘크리트 하중 D</dt><dd>${fmt(w.selfWeight,2)} + ${fmt(p.qsd,2)} = ${fmt(w.dead,2)} kN/m²</dd></div><div><dt>활하중 L</dt><dd>${fmt(w.live,2)} kN/m²</dd></div></dl>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>하중조합</th><th>방향</th><th>계수하중 (kN/m²)</th><th>검토</th></tr></thead><tbody>`+
    `<tr><td>0.9D + 1.6H → 1.6H − 0.9D</td><td>상향</td><td>${fmt(w.qu,2)}</td><td>${p.loadCase==='gravity'?'선택 제외':w.qu>0?'반영':'순 상향하중 없음'}</td></tr>`+
    `<tr><td>1.2D + 1.6L</td><td>하향</td><td>${fmt(w.gravity,2)}</td><td>${p.loadCase==='uplift'?'선택 제외':'반영'}</td></tr></tbody></table></div>`+
    `<p class="beam-muted">D·L은 하향, H는 상향입니다. 양압력 조합의 0.9D는 저항으로 공제하며 L은 저항으로 넣지 않습니다. 요청한 두 조합만 비교하며 전체 설계하중 조합을 자동 생성하지 않습니다.</p>`+
    (w.live===0&&p.loadCase!=='uplift'?'<p class="warn">활하중 L = 0입니다. 실제 설계 활하중을 입력했는지 확인하세요.</p>':'')+
    (o.message?`<p class="warn">${o.message}</p>`:'');
}
/* The 0.65l floor caps how far a bigger footing can shorten the design span,
 * so past that point enlarging it stops reducing the moments. */
function floorNote(o){
  const hit=o.directions.filter(d=>d.floored);
  if(!hit.length)return '';
  const each=hit.map(d=>`${DIR[d.dir]} 방향은 기초면 사이 ${fmt(d.raw,0)} mm가 하한 ${fmt(d.floor,0)} mm보다 작아 ln = ${fmt(d.floor,0)} mm를 씁니다`).join('. ');
  return `<p class="slab-note"><b>순경간 하한이 지배하고 있습니다.</b> ${each}. 이 상태에서는 <b>기초를 더 키워도 Mo와 각 설계대의 Mu가 줄지 않습니다.</b> 모멘트를 낮추려면 경간이나 하중을 조정해야 합니다 (KDS 14 20 70, 4.1.3.2(5)).</p>`;
}
function renderGeometry(p,o){
  if(!o.directions.length){get('s_geometry').innerHTML='';return;}
  const rows=o.combinations.flatMap(c=>c.directions.map(d=>
    `<tr><td>${COMBO[d.combo]}</td><td>${DIR[d.dir]} 방향</td><td>${fmt(d.span,0)}</td><td>${fmt(d.ln,0)}${d.floored?' <small>(0.65 l 하한)</small>':''}</td><td>${fmt(d.transverse,0)}</td><td>${fmt(d.columnWidth,0)}</td><td>${fmt(d.middleWidth,0)}</td><td class="beam-phi">${fmt(d.Mo,1)}</td></tr>`)).join('');
  get('s_geometry').innerHTML=`<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>조합</th><th>방향</th><th>경간 l (mm)</th><th>순경간 ln (mm)</th><th>직교 경간 l2 (mm)</th><th>주열대 폭 (mm)</th><th>중간대 폭 (mm)</th><th>Mo (kN·m)</th></tr></thead><tbody>${rows}</tbody></table></div>`+
    `<p class="beam-muted">Mo = qu · l2 · ln² / 8 (KDS 14 20 70 식 4.1-2). 순경간은 기초면 사이 거리이고 0.65 l 이 하한입니다(4.1.3.2(5)). 주열대 폭 = 2 × min(0.25 l1, 0.25 l2) (4.1.2.1(2)).</p>`+
    floorNote(o)+
    (o.limits.notes.length?`<p class="warn">직접설계법 제한사항 이탈: ${o.limits.notes.join(' / ')}</p>`:'');
}
function renderSections(p,o){
  if(!o.directions.length){get('s_sections').innerHTML='';return;}
  const rows=o.directions.flatMap(d=>d.rows.map(r=>{
    const c=r.check,s=r.suggestion;
    return `<tr data-dir="${d.dir}" data-strip="${r.strip}"><td>${DIR[d.dir]}</td><td>${COMBO[r.combo]} · ${r.face==='top'?'상부근':'하부근'} · ${r.label}</td><td>${r.strip==='column'?'주열대':'중간대'} <small>${fmt(100*r.share,0)}%</small></td><td>${face(r.face)}</td><td>${fmt(r.Mu,1)}</td><td>${fmt(c.d,1)}</td><td>${fmt(c.As,0)}</td><td>${fmt(c.phi,3)}</td><td class="beam-phi">${fmt(c.phiMn,1)}</td><td class="${c.ok?'ok':'warn'}">${c.ok?'충족':c.reasons.join('<br>')}</td><td>${s?`${s.bar}@${s.spacing}`:'<span class="warn">없음</span>'}</td></tr>`;
  })).join('');
  const mins=o.directions[0].minimums.map(m=>
    `<tr><td>${m.strip==='column'?'주열대':'중간대'}</td><td>${fmt(m.AsTop,0)}</td><td>${fmt(m.AsBottom,0)}</td><td>${fmt(m.total,0)}</td><td>${fmt(100*m.ratio,3)}%</td><td class="${m.ok?'ok':'warn'}">${m.ok?'충족':'미달'}</td></tr>`).join('');
  get('s_sections').innerHTML=`<p class="slab-note"><b>조합별 인장면을 구분합니다.</b> 양압력은 중앙부 상부·기초면 하부가, 중력하중은 중앙부 하부·기초면 상부가 인장입니다. 표는 각 설계대·면의 최대 Mu와 지배 조합을 표시합니다. 직접설계법 적용 제한을 벗어나면 제안 배근을 제공하지 않습니다.</p>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>방향</th><th>검토 대상</th><th>설계대</th><th>인장면</th><th>Mu (kN·m/m)</th><th>d (mm)</th><th>As (mm²/m)</th><th>φ</th><th>φMn (kN·m/m)</th><th>판정</th><th>제안 배근</th></tr></thead><tbody>${rows}</tbody></table></div>`+
    `<dl class="beam-values"><div><dt>입력 배근</dt><dd>${p.bar} @ ${fmt(p.spacing,0)} mm</dd></div>`+
    `<div><dt>단면 최소철근량 (수축·온도)</dt><dd>${fmt(o.AsMin,0)} mm²/m · ρ ${fmt(100*o.minimumRatio,3)}%</dd></div>`+
    `<div><dt>위험단면 최대 철근간격</dt><dd>${fmt(o.maxSpacing,0)} mm</dd></div></dl>`+
    `<p class="beam-muted">행을 클릭하면 위 평면도에서 해당 설계대가 강조됩니다. 제안 배근은 시공성을 위해 <b>같은 설계대의 상·하부 간격을 통일</b>했습니다. 두 면 중 무거운 쪽이 간격을 정하며, 그 간격에서 양쪽 모두 φMn ≥ Mu와 최대간격을 만족하고 합계가 단면 최소철근도 넘습니다. 단부 경간처럼 지지부 단면이 둘이면 각 인장면에서 Mu가 큰 쪽을 적용합니다. 정착·이음·단부 연장길이는 별도입니다.</p>`+
    `<h3 class="beam-subheading">단면 최소철근 — 상부근 + 하부근 (입력 배근 기준)</h3>`+
    `<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>설계대</th><th>상부 As (mm²/m)</th><th>하부 As (mm²/m)</th><th>합계</th><th>ρ</th><th>판정</th></tr></thead><tbody>${mins}</tbody></table></div>`+
    `<p class="beam-muted">수축·온도철근량은 KDS 14 20 50 4.6.2에 따라 콘크리트 <b>전체 단면적</b>에 대한 비이므로 상부근과 하부근을 더해 검사합니다. 각 면이 개별로 만족할 필요는 없습니다.</p>`;
}
function renderBasis(p,o){
  get('s_basis').innerHTML=`<ul class="beam-basis">`+
    `<li>해석: 직접설계법 (KDS 14 20 70, 4.1.3). 보가 없어 α1 = 0, βt = 0이므로 주열대 분배율은 내부 부모멘트 75%, 정모멘트 60%, 외부 부모멘트 100%로 고정됩니다(표 4.1-2·4.1-3·4.1-4).</li>`+
    `<li>경간 분배: ${p.spanType==='interior'?'내부 경간 — 부 0.65 / 정 0.35 (4.1.3.3(2))':`단부 경간 — ${RCSlabUplift.END_CASES[p.endCase].name} (표 4.1-1)`}</li>`+
    `<li>휨: 변형률 적합과 탄소성 철근응력으로 ΣF = 0인 중립축을 구하고 φ를 최외단 인장변형률로 산정합니다. Es = 200,000 MPa (KDS 14 20 20 4.1.1·4.1.2, KDS 14 20 10 4.2.3).</li>`+
    `<li>최소철근: 수축·온도철근비 ${p.fy<=400?'0.0020':'0.0020 × 400/fy'}, 하한 0.0014, 상한 1,800 mm²/m (KDS 14 20 50, 4.6.2).</li>`+
    `<li>철근 간격: 위험단면에서 슬래브 두께의 2배 이하, 300 mm 이하 (KDS 14 20 70, 4.1.5.1(2)).</li>`+
    `<li>요청한 양압력 1.6H−0.9D 및 중력하중 1.2D+1.6L을 선택 검토합니다. 두 조합 비교에서는 각 면의 최대 소요강도로 배근을 제안합니다. 전체 하중조합 검토는 별도입니다.</li>`+
    `</ul><details class="beam-settings"><summary>검토하지 않은 항목</summary><ul class="beam-basis">`+
    `<li>전단 — 1방향 전단과 뚫림전단 모두 검토하지 않습니다. 이 화면은 휨 철근만 다룹니다.</li>`+
    `<li>부력에 대한 구조물 전체 부상 안정, 균열폭, 처짐, 정착·이음 상세</li>`+
    `<li>기초판 자체의 설계, 지반 반력 분포, 말뚝 반력</li>`+
    `<li>평면도의 기둥 크기는 표시용이며 계산에 쓰지 않습니다. 지지점은 독립기초입니다.</li>`+
    `<li>직접설계법 제한사항 중 장변/단변 비와 중력하중 검토 시 L≤2D를 확인합니다. 각 방향 3경간 이상 연속, 인접 경간차 1/3 이하, 기둥 어긋남 10% 이하는 사용자가 확인해야 합니다 (4.1.3.1).</li>`+
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
  const zoom=e.target.closest('.drawing-zoom');if(zoom){const panel=get('s_diagram').querySelector('.diagram-scroll');const on=panel.classList.toggle('zoomed');zoom.setAttribute('aria-pressed',on);zoom.textContent=on?'도면 축소':'도면 확대';return;}
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
