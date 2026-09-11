(function(){
'use strict';
const get=id=>document.getElementById('br_'+id);
const f=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
const num=id=>get(id).value.trim()===''?NaN:Number(get(id).value);
let current=null,selected=null,diagramView='model';
function diagram(a,b){
  const scale=Math.min(240/Math.max(a.H,b?.H||0),250/Math.max(a.B,b?.B||0));
  const shape=(p,c,label,color)=>{
    const x=c-p.B*scale/2,y=285-p.H*scale,tf=p.tf*scale,tw=p.tw*scale;
    return `<g fill="${color}" fill-opacity=".2" stroke="${color}"><rect x="${x}" y="${y}" width="${p.B*scale}" height="${tf}"/><rect x="${x}" y="${285-tf}" width="${p.B*scale}" height="${tf}"/><rect x="${c-tw/2}" y="${y+tf}" width="${tw}" height="${(p.H-2*p.tf)*scale}"/></g><g fill="var(--ink)" text-anchor="middle" font-size="14"><text x="${c}" y="22">${label}</text><text x="${c}" y="311">${p.H} × ${p.B} × ${p.tw} × ${p.tf} mm</text></g>`;
  };
  return `<svg viewBox="0 0 660 330" style="width:100%;max-height:380px" role="img" aria-label="기존 BH와 선택 RH의 동일 축척 비교">${shape(a,165,'기존 BH','#64748b')}${b?shape(b,495,'선택 RH','#1764b5'):'<text x="495" y="165" text-anchor="middle" fill="var(--muted)">RH 후보 없음</text>'}</svg>`;
}
function teeDiagram(a,row){
  const t=row.assembly,top=t.top,tee=t.tee,e=t.effective,H=e.H,actual=diagramView==='actual';
  const scale=Math.min(260/Math.max(a.H,H),210/Math.max(a.B,top.B,tee.B)),bottom=310,yTop=bottom-H*scale;
  const plate=(cx,y,b,h,color)=>`<rect x="${cx-b*scale/2}" y="${yTop+y*scale}" width="${b*scale}" height="${h*scale}" fill="${color}" fill-opacity=".3" stroke="${color}"/>`;
  const cy=bottom-a.H*scale;
  const bh=`<g fill="#64748b" fill-opacity=".25" stroke="#64748b"><rect x="${155-a.B*scale/2}" y="${cy}" width="${a.B*scale}" height="${a.tf*scale}"/><rect x="${155-a.tw*scale/2}" y="${cy+a.tf*scale}" width="${a.tw*scale}" height="${(a.H-2*a.tf)*scale}"/><rect x="${155-a.B*scale/2}" y="${bottom-a.tf*scale}" width="${a.B*scale}" height="${a.tf*scale}"/></g>`;
  const alternative=actual?
    plate(465,0,top.B,top.tf,'#1764b5')+plate(465,top.tf,top.tw,top.H-2*top.tf,'#1764b5')+plate(465,top.H-top.tf,top.B,top.tf,'#1764b5')+plate(465,top.H,tee.tw,t.cut-tee.tf,'#248466')+plate(465,H-tee.tf,tee.B,tee.tf,'#248466'):
    plate(465,0,e.bt,e.tt,'#1764b5')+plate(465,e.tt,e.tw,H-e.tt-e.tb,'#1764b5')+plate(465,H-e.tb,e.bb,e.tb,'#1764b5');
  const dimension=(x,y1,y2,label)=>`<g stroke="var(--dim)" stroke-width=".8"><line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"/><line x1="${x-4}" x2="${x+4}" y1="${y1}" y2="${y1}"/><line x1="${x-4}" x2="${x+4}" y1="${y2}" y2="${y2}"/></g><text fill="var(--dim)" font-size="12" text-anchor="middle" transform="translate(${x+14} ${(y1+y2)/2}) rotate(-90)">${label}</text>`;
  const NA=actual?'':`<line x1="${465-Math.max(top.B,tee.B)*scale/2-7}" x2="${465+Math.max(top.B,tee.B)*scale/2+7}" y1="${yTop+t.out.props.y*scale}" y2="${yTop+t.out.props.y*scale}" stroke="#67539b" stroke-dasharray="5 4"/>`;
  get('view_model').setAttribute?.('aria-pressed',String(!actual));get('view_actual').setAttribute?.('aria-pressed',String(actual));
  return `<svg viewBox="0 0 660 352" style="width:100%;max-height:430px;display:block" role="img" aria-label="${actual?'실제 조립 단면: 가운데 플랜지 포함':'검토 단면: 가운데 플랜지 제외, 외곽 두 플랜지와 연속 웨브'}">${bh}${alternative}${NA}${dimension(290,cy,bottom,`H ${a.H} mm`)}${dimension(600,yTop,bottom,`H ${f(H)} mm`)}<g fill="var(--ink)" font-size="14" text-anchor="middle"><text x="155" y="23">기존 BH</text><text x="465" y="23">${actual?'대안 · 실제 조립 단면':'대안 · 검토 I형 단면'}</text><text x="155" y="337" font-size="12">${a.H} × ${a.B} × ${a.tw} × ${a.tf} mm</text><text x="465" y="337" font-size="12">상부 폭 ${top.B} / 하부 폭 ${tee.B} mm</text></g></svg><p class="br-diagram-caption">${actual?'청색은 RH 전체, 녹색은 절단 역T입니다. 가운데 RH 하부 플랜지는 실제로 남아 있어 중량에 포함됩니다.':'검토 단면은 가운데 플랜지 돌출부를 제외하고, 외곽 두 플랜지와 일정 두께의 웨브로 표시합니다. 보라색 점선은 검토 중립축입니다.'}<br>상부 RH: ${top.name} · 역T 원본: ${tee.name} · 역T 높이 ${f(t.cut)} mm · 검토 웨브 두께 ${f(e.tw)} mm</p>`;
}
function assemblyDetails(row){
  const a=row?.assembly;get('assembly_details').hidden=!a;
  if(!a){get('assembly_results').innerHTML='';return;}
  const o=a.out,p=a.effective;
  const line=(label,fn)=>`<tr><th>${label}</th>${[o.positive,o.negative].map(d=>`<td>${fn(d)}</td>`).join('')}</tr>`;
  get('assembly_results').innerHTML=`<p><b>상부 ${a.top.name}</b> + <b>${a.tee.name}</b>에서 절단한 역T (높이 ${f(a.cut)} mm)</p><p class="beam-muted">검토 I형: H ${f(p.H)} · 상부 ${f(p.bt)}×${f(p.tt)} · 하부 ${f(p.bb)}×${f(p.tb)} · tw ${f(p.tw)} mm. 적용 Fy ${f(p.Fy)} MPa (RH ${f(a.topFy)}, 역T ${f(a.teeFy)}). 중간 플랜지는 제외합니다.</p>
  <table><thead><tr><th>휨 검토 항목</th><th>정모멘트 · 상부 압축</th><th>부모멘트 · 하부 압축</th></tr></thead><tbody>${line('φMn (kN·m)',d=>d.supported?f(d.phiMn):'범위 초과')}${line('지배 한계상태',d=>d.governing||d.message)}${line('적용 조항',d=>d.clause||'—')}${line('압축 플랜지 / 웨브',d=>d.flange+' / '+d.web)}${line('Lp / Lr (mm)',d=>f(d.Lp)+' / '+f(d.Lr))}${line('hc/tw · λp / λr',d=>f(d.lambda)+' · '+f(d.lpw)+' / '+f(d.lrw))}</tbody></table>
  <p>검토 단면적 ${f(o.props.A)} mm² · 상면 기준 중립축 ${f(o.props.y)} mm · S상 ${f(o.props.St/1e3)} / S하 ${f(o.props.Sb/1e3)} (×10³ mm³)</p>
  <p>실제 개산 중량: RH ${f(a.topMass)} + 역T ${f(a.teeMass)} = <b>${f(a.mass)} kg/m</b>. 가운데 플랜지와 필릿 포함, 용접금속·절단 손실·미사용 잔재 제외.</p>
  <p><b>접합선 전단흐름 q = ${f(row.flow)} kN/m</b> · 양측 용접선에 균등 분담 시 각각 ${f(row.flow===null?null:row.flow/2)} kN/m</p><p class="beam-muted">q = VQ/I, Q = ${f(a.Q/1e3)}×10³ mm³. 검토 기준 모멘트에서 역T 전달축력 |N| = ${f(row.force)} kN. 입력 하중 또는 BH 비교내력을 사용한 탄성 전달력이며 각 최댓값의 동시 발생을 의미하지 않습니다. 용접 크기·길이·모재 강도와 역T 단부의 정착·힘 전달, 잔류응력 및 시공 순서는 별도 검토해야 합니다. 접합부의 ‘적합’ 판정은 하지 않습니다.</p>`;
}
function comparison(row){
  const o=current,b=o.base;
  get('diagram_controls').hidden=!row?.assembly;get('diagram').innerHTML=row?.assembly?teeDiagram(o.bh,row):diagram(o.bh,row?.p);assemblyDetails(row);
  const cells=[['강종',get('bhGrade').value,get('bhGrade').value],['Fy (MPa)',f(o.bh.Fy),f(row?.p.Fy)],['중량 (kg/m)',f(o.bhMass),f(row?.mass)],['φMn (kN·m)',f(b.supported?b.flexure.phiMn:null),f(row?.out.flexure?.phiMn)],['φVn (kN)',f(b.supported?b.shear.phiVn:null),f(row?.out.shear?.phiVn)],['Ix (×10⁶ mm⁴)',f(b.props.Ix/1e6),f(row?.out.props.Ix/1e6)],['높이 H (mm)',f(o.bh.H),f(row?.p.H)]];
  const ratio=(a,c)=>c>0?`${f(a/c,3)}`:'—';
  get('compare').innerHTML=`<table><thead><tr><th>비교 항목</th><th>기존 BH</th><th>${row?.assembly?'선택 RH + 역T':'선택 RH'}</th></tr></thead><tbody>${cells.map(c=>`<tr>${c.map((v,i)=>`<${i?'td':'th'}>${v}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table>`+
    (row?`<p><b>${row.section.name}</b> · ${row.eligible?'선정 조건 충족':row.reasons.join(' · ')}</p><p class="beam-muted">BH 대비 중량 ${f(Math.abs(row.mass/o.bhMass-1)*100)}% ${row.mass<=o.bhMass?'감소':'증가'} · Ix ${ratio(row.out.props.Ix,b.props.Ix)}배. ${row.out.shear?.needsStiffener?'전단 스티프너 상세를 별도로 확인하세요.':''}</p>`:'')+
    (!b.supported?`<p class="beam-muted">기존 BH: ${b.message} 하중 기준으로 RH 후보 검색은 가능합니다.</p>`:'');
}
function table(){
  const o=current,rows=get('filter').value==='all'?o.rows:o.rows.filter(r=>r.eligible);get('section_heading').textContent=o.scheme==='tee'?'역T 원본 RH 규격':'RH 규격';
  get('rows').innerHTML=rows.map(r=>`<tr class="${r===o.recommended?'economical ':''}${r.section.name===selected?'selected':''}"><td>${r===o.recommended?'✓ ':''}${r.section.name}${r.assembly?`<br><span class="beam-muted">hT ${f(r.assembly.cut)} · 전체 H ${f(r.p.H)} mm</span>`:''}</td><td>${f(r.p.Fy)}</td><td>${f(r.mass)}</td><td>${f(r.out.flexure?.phiMn)}</td><td>${f(r.out.shear?.phiVn)}</td><td>${f(r.out.props.Ix/o.base.props.Ix,2)}</td><td>${r.eligible?(r.assembly?'모델 내력 충족':'조건 충족'):r.reasons.join(' · ')}</td><td><button type="button" class="beam-view" data-br-section="${r.section.name}" aria-label="${r.section.name} 비교">보기</button></td></tr>`).join('')||`<tr><td colspan="8">${o.scheme==='tee'&&o.rows.length===0?'입력 높이로 절단 가능한 원본 RH가 없습니다. 절단 높이를 변경하거나 1/2 절단을 선택하세요.':'조건을 만족하는 후보가 없습니다. 전체 규격에서 제외 사유를 확인하세요.'}</td></tr>`;
  comparison(rows.find(r=>r.section.name===selected)||rows[0]||null);
}
function update(){
  const load=get('mode').value==='load',tee=get('scheme').value==='tee';get('loads').hidden=!load;get('tee_fields').hidden=!tee;get('cut_field').hidden=get('cutMode').value!=='custom';
  get('support_heading').textContent=(tee?'4':'3')+'. 지지조건 · 설계하중';get('conditions_heading').textContent=(tee?'5':'4')+'. 후보 조건';
  get('mode_note').textContent=load?'입력한 계수하중 Mu·Vu를 RH의 설계강도와 비교합니다.':'BH의 φMn·φVn 각각을 RH가 모두 만족해야 합니다.';
  try{
    const p={scheme:get('scheme').value,teeGrade:get('bhGrade').value,topSection:get('topSection').value,cutMode:get('cutMode').value,cutHeight:num('cutHeight'),bending:get('bending').value,mode:get('mode').value,bhGrade:get('bhGrade').value,rhGrade:get('bhGrade').value,keepStiffness:get('stiffness').value==='keep'};
    for(const k of ['H','B','tw','tf','Lb','Cb','Mu','Vu'])p[k]=num(k);
    for(const k of ['maxH','maxB'])p[k]=get(k).value.trim()===''?null:num(k);
    const o=SteelReplacement.calculate(p);current=o;selected=o.recommended?.section.name||null;
    get('material').textContent=`BH·RH·역T 모두 ${p.bhGrade} 적용. BH Fy = ${f(o.bh.Fy)} MPa. 같은 강종이라도 판두께에 따라 Fy가 달라질 수 있습니다.`;
    get('summary').innerHTML=`<p class="beam-economy-title">${o.recommended?'최경량 충족 후보 · '+(tee?'역T 원본 ':'')+o.recommended.section.name:'조건 충족 후보 없음'}</p><p>${o.rows.filter(r=>r.eligible).length} / ${o.rows.length}개 ${tee?'절단 가능한 역T 원본':'RH'} 규격 · ${load?'입력 설계하중 기준':'기존 BH 내력 기준'}</p>`+
      (o.target?`<p>휨 비교 기준 <b>${f(o.target.M)} kN·m</b> · 전단 비교 기준 <b>${f(o.target.V)} kN</b></p>`:`<p>${o.base.message} BH 내력 기준의 후보 선정을 보류합니다.</p>`)+
      (o.recommended?`<p>BH ${f(o.bhMass)} → ${tee?'RH + 역T':'RH'} <b>${f(o.recommended.mass)} kg/m</b></p>`:'')+
      (load&&o.base.supported?`<p class="beam-muted">기존 BH의 입력 하중 검토: ${o.base.ok?'휨·전단 충족':'휨 또는 전단 부족'}</p>`:'');
    if(tee)get('summary').innerHTML+='<p><b>'+({positive:'정모멘트 · 상부 압축 기준',negative:'부모멘트 · 하부 압축 기준',both:'정·부모멘트 각각 충족 기준'}[p.bending])+'</b></p>';
    if(tee)get('summary').innerHTML+='<p class="beam-muted">중간 플랜지를 제외한 모델의 부재 내력 비교입니다. 전체 길이에 걸친 일체 접합 및 별도 접합부 검증이 필요합니다.</p>';
    table();
  }catch(e){current=null;get('assembly_details').hidden=true;get('summary').textContent=e.message;get('material').textContent='입력값을 확인하세요.';for(const id of ['diagram','compare','rows','assembly_results'])get(id).innerHTML='';}
}
for(const id of ['bhGrade']){
  get(id).innerHTML=Object.keys(SteelSection.STEEL).map(g=>`<option>${g}</option>`).join('');
  get(id).value='SM355';
}
get('topSection').innerHTML=SteelSection.SECTIONS.filter(s=>s.listed).map(s=>`<option>${s.name}</option>`).join('');
get('topSection').value='H-350×350×12×19';
for(const [id,view] of [['view_model','model'],['view_actual','actual']])get(id).addEventListener('click',()=>{diagramView=view;if(current)table();});
document.getElementById('t8').addEventListener('input',update);
get('rows').addEventListener('click',e=>{const b=e.target.closest('[data-br-section]');if(!b||!current)return;selected=b.dataset.brSection;table();});
update();
})();
