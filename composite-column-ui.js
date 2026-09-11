(function(){
'use strict';
const get=id=>document.getElementById('cc_'+id),num=id=>get(id).value.trim()===''?NaN:Number(get(id).value);
const f=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
const values=rows=>'<dl class="beam-values">'+rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')+'</dl>';
const table=(head,rows)=>'<div class="beam-table-wrap"><table class="beam-table"><thead><tr>'+head.map(v=>'<th>'+v+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
function diagram(o){
 const p=o.p,s=Math.min(240/p.B,240/p.H),X=x=>210+x*s,Y=y=>150-y*s,outer=p.type==='circle';
 const box=(b,h,x,y,fill,extra='')=>`<rect x="${X(x-b/2)}" y="${Y(y+h/2)}" width="${b*s}" height="${h*s}" fill="${fill}" stroke="var(--accent)" ${extra}/>`;
 let shapes=outer?`<circle cx="210" cy="150" r="${p.B*s/2}" fill="#1764b5"><title>원형 강관 · t ${p.t} mm</title></circle><circle cx="210" cy="150" r="${(p.B/2-p.t)*s}" fill="#e5e7eb"/>`:box(p.B,p.H,0,0,'#e5e7eb');
 if(p.type==='rect')shapes=box(p.B,p.H,0,0,'#1764b5')+box(p.B-2*p.t,p.H-2*p.t,0,0,'#e5e7eb');
 if(p.type==='src'){
  shapes+=o.steel.map(q=>box(q.b,q.h,q.x,q.y,'#1764b5')).join('');
  const d=p.cover+RCBeam.BARS[p.tie].diameter/2;
  shapes+=box(p.B-2*d,p.H-2*d,0,0,'none','stroke-dasharray="4 3"');
  shapes+=o.bars.map((q,i)=>`<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="${q.r*s}" fill="#d47d20" stroke="#9a5010"><title>주철근 ${i+1} · ${p.bar} · (${f(q.x)}, ${f(q.y)}) mm</title></circle>`).join('');
 }
 return `<svg viewBox="0 0 420 325" role="img" aria-label="${p.type==='src'?'SRC':outer?'원형 CFT':'각형 CFT'} 단면, 강재 파란색 콘크리트 회색 철근 주황색">${shapes}<path d="M45 150H375 M210 15V285" stroke="var(--dim)" stroke-dasharray="5 5" fill="none"/><g fill="var(--ink)" font-size="12"><text x="375" y="141">X</text><text x="219" y="20">Y</text><text x="210" y="308" text-anchor="middle">${outer?'D':'B'} ${f(p.B)} mm${outer?'':' · H '+f(p.H)+' mm'}</text></g></svg><p class="beam-muted">파란색 강재 · 회색 콘크리트${p.type==='src'?' · 주황색 주철근 (철근에 마우스를 올리면 위치 표시)':''}. X축은 수평축, Y축은 수직축입니다.</p>`;
}
function interaction(c){
 const max=Math.max(1.1,c.x*1.15,c.y*1.15),X=v=>50+v/max*340,Y=v=>245-v/max*200,l=c.limit;
 return `<svg viewBox="0 0 420 290" role="img" aria-label="현재 축력에서 양축 모멘트비 조합 영역"><path d="M50 45V245H390" fill="none" stroke="var(--dim)"/><path d="M50 245L${X(l)} 245L50 ${Y(l)}Z" fill="var(--accent)" fill-opacity=".12" stroke="var(--accent)"/><circle cx="${X(c.x)}" cy="${Y(c.y)}" r="5" fill="var(${c.ok?'--ok':'--ng'})"><title>입력점 · X ${f(c.x,3)}, Y ${f(c.y,3)}</title></circle><g fill="var(--ink)" font-size="12"><text x="220" y="279" text-anchor="middle">|Mux| / φbMnx</text><text transform="translate(16 150) rotate(-90)" text-anchor="middle">|Muy| / φbMny</text><text x="50" y="263">0</text></g></svg>`;
}

let lastStud=null,selectedStud=0;
function studDiagram(o,t){
 const p=o.p,scale=Math.min(260/p.B,260/p.H),X=x=>180+x*scale,Y=y=>220-y*scale;
 const rect=(b,h,x=0,y=0,color='#e5e7eb')=>`<rect x="${X(x-b/2)}" y="${Y(y+h/2)}" width="${b*scale}" height="${h*scale}" fill="${color}" stroke="#64748b"/>`;
 let shape=p.type==='circle'?`<circle cx="180" cy="220" r="${p.B*scale/2}" fill="#1764b5"/><circle cx="180" cy="220" r="${(p.B/2-p.t)*scale}" fill="#e5e7eb"/>`:rect(p.B,p.H);
 if(p.type==='rect')shape=rect(p.B,p.H,0,0,'#1764b5')+rect(p.B-2*p.t,p.H-2*p.t);
 if(p.type==='src')shape+=o.steel.map(q=>rect(q.b,q.h,q.x,q.y,'#1764b5')).join('')+o.bars.map(b=>`<circle cx="${X(b.x)}" cy="${Y(b.y)}" r="${b.r*scale}" fill="#d47d20"/>`).join('');
 selectedStud=Math.max(0,Math.min(selectedStud,Math.max(0,t.count-1)));
 const layer=Math.floor(selectedStud/t.p.perLevel),selLine=selectedStud%t.p.perLevel;
 const color=i=>i===selectedStud?'#d84522':'#248466';
 const title=i=>`${i+1}번 · ${Math.floor(i/t.p.perLevel)+1}단 · z ${f(t.z[Math.floor(i/t.p.perLevel)])} mm`;
 const plan=t.plan.map((q,j)=>{const i=layer*t.p.perLevel+j;return `<g data-stud="${i}" role="button" tabindex="0" aria-label="${title(i)}" stroke="${color(i)}" stroke-width="3"><title>${title(i)} · d ${t.p.diameter}, h ${t.p.height} mm</title><line x1="${X(q.x)}" y1="${Y(q.y)}" x2="${X(q.hx)}" y2="${Y(q.hy)}"/><circle cx="${X(q.hx)}" cy="${Y(q.hy)}" r="5" fill="${color(i)}"/></g>`;}).join('');
 const ex=i=>440+(i+.5)*300/t.p.perLevel,ey=z=>65+340*z/t.Lin;
 const elevation=t.z.flatMap((z,k)=>t.plan.map((q,j)=>{const i=k*t.p.perLevel+j;return `<circle data-stud="${i}" role="button" tabindex="0" aria-label="${title(i)}" cx="${ex(j)}" cy="${ey(z)}" r="${i===selectedStud?5:3.5}" fill="${color(i)}"><title>${title(i)} · ${j+1}번째 열</title></circle>`;})).join('');
 get('stud_graph').innerHTML=`<svg viewBox="0 0 800 460" role="img" aria-label="스터드 단면 배치와 하중도입부 길이방향 전개도"><g fill="var(--ink)" font-size="14" text-anchor="middle"><text x="180" y="28">단면 배치 · ${layer+1}단</text><text x="590" y="28">길이방향 전개 · 전체 ${t.count}개</text></g>${shape}${t.count?plan:''}<rect x="430" y="65" width="320" height="340" fill="#e5f1ff" stroke="#64748b"/>${t.plan.map((q,j)=>`<line x1="${ex(j)}" x2="${ex(j)}" y1="65" y2="405" stroke="#b9c6d6"/>`).join('')}${elevation}<g fill="var(--ink)" font-size="12"><text x="180" y="413" text-anchor="middle">${p.type==='circle'?'내주 등간격':'대칭 2면 배치'} · 1단 ${t.p.perLevel}개</text><text x="420" y="68" text-anchor="end">z=0</text><text x="420" y="405" text-anchor="end">${f(t.Lin)}</text><text x="590" y="432" text-anchor="middle">하중도입부 Lin ${f(t.Lin)} mm · s ${t.p.spacing} mm</text></g></svg>`;
 const q=t.plan[selLine];
 get('stud_info').textContent=t.count?`선택: ${selectedStud+1}번 · ${layer+1}단 / ${selLine+1}열 · 용접 위치 (${f(q.x)}, ${f(q.y)}, ${f(t.z[layer])}) mm · d ${t.p.diameter} × h ${t.p.height} mm · 1개 검토강도 ${f(t.phiQ)} kN. 클릭 또는 키보드 Enter로 선택합니다. 스터드 표식은 가독성을 위해 확대했으며 길이방향은 도입부만 표시합니다.`:'하중도입부에 배치 가능한 스터드가 없습니다.';
}
function renderStuds(o,t){
 lastStud={o,t};
 get('stud_results').innerHTML=`<p class="beam-layout">${t.count}개 배치 <span>· 소요 ${t.required}개 · ${t.levels}단 × ${t.p.perLevel}개</span></p><p class="${t.ok?'ok':'ng'}">도입부 스터드 강재전단·배치 ${t.ok?'충족':'미달 / 상세 확인 필요'}</p>`+values([['실제 기둥 길이 / 도입부 길이',f(t.p.length)+' / '+f(t.Lin)+' mm'],['검토 도입 축력 Pr',f(t.Pr)+' kN'],['FyAs / Pno',f(t.ratio,3)],['전달 소요력 |Vr′|',f(t.demand)+' kN'],['스터드 1개 검토강도',f(t.phiQ)+' kN'],['도입부 스터드 강도 합',f(t.capacity)+' kN'],['도입부 외 검토',t.outside?(t.outside.ok?'입력 전단흐름 충족':'입력 전단흐름 미달')+' · '+f(t.outside.demand)+' / '+f(t.outside.capacity)+' kN/m':'해석 전단흐름 미입력 · 판정 보류']])+table(['배치·강도 항목','입력 / 한계','상태'],t.checks.map(c=>[c.label,c.detail,`<span class="${c.ok?'ok':'ng'}">${c.ok?'충족':'확인 필요'}</span>`]))+`<p class="beam-muted">KDS 14 31 80, 4.4.3.2의 축력 분배, Lin=min(2×단면 최소폭, L/3). 1개 단부의 도입부 안에 있는 스터드만 합산합니다. 부착·지압 저항은 중첩하지 않습니다.</p><p class="beam-muted">1개 검토강도는 4.8.3.1의 강재 전단 φQn=0.65FuAsc와 4.8.2.1의 추가 상한 min(0.5Asc√(fckEc), 0.75AscFu) 중 작은 값입니다. 콘크리트 파괴가 지배하지 않는 전단 전용 검토이며, 콘크리트 파괴·인장·용접부 강도는 별도 확인해야 합니다. 도입부 외에는 입력한 전단흐름에 대해 같은 배치 간격을 가정합니다.</p>`;
 studDiagram(o,t);
}
function update(){
 const type=get('type').value,rh=get('shapeMode').value==='rh';
 get('section_field').hidden=!rh;get('steelShare_field').hidden=get('loadPath').value!=='both';
 if(type==='src'&&rh){const sec=SteelSection.findSection(get('section').value);if(sec)for(const [id,k] of [['sh','H'],['sb','B'],['tw','tw'],['tf','tf']])get(id).value=String(sec[k]);}
 for(const id of ['sh','sb','tw','tf'])get(id).readOnly=rh;
 get('src_fields').hidden=type!=='src';get('H_field').hidden=type==='circle';get('t_field').hidden=type==='src';
 try{
  let p={type,bar:get('bar').value,tie:get('tie').value,shapeMode:get('shapeMode').value,section:get('section').value};
  for(const id of ['B','H','t','fck','Fy','sh','sb','tw','tf','fy','nb','nh','cover','tieSpacing','klx','kly','Pu','Mux','Muy'])p[id]=num(id);
  if(type==='circle')p.H=p.B;
  const o=CompositeColumn.calculate(p),a=o.props;p=o.p;
  const optional=id=>get(id).value.trim()===''?null:num(id);
  const stud=CompositeColumnStuds.calculate(o,{length:num('memberLength'),diameter:num('studD'),head:num('studHead'),height:num('studH'),Fu:num('studFu'),perLevel:num('studN'),spacing:num('studS'),edge:num('studEdge'),loadPath:get('loadPath').value,steelShare:num('steelShare'),introLoad:optional('introLoad'),outsideFlow:optional('outsideFlow')});
  get('error').hidden=true;get('results').hidden=false;
  get('summary').innerHTML=`<p class="beam-layout">${type==='src'?'SRC · H형강 매입':type==='rect'?'CFT · 각형강관':'CFT · 원형강관'}</p><p class="beam-capacity">${f(o.Pr)} <small>kN · φcPn</small></p><p class="${!o.supported?'warn':o.ok?'ok':'ng'}">${!o.supported?'검토 범위 또는 상세 조건 확인 필요':o.ok?'부재 축력·모멘트 검토 충족':'부재 축력·모멘트 검토 미달'}</p><p class="beam-muted">${o.combined?'조합 강도비 '+f(o.combined.value,3)+' / 1.000':'비조밀·세장 CFT의 휨 및 조합 판정은 보류합니다.'} · 2차 효과 반영 설계력 입력 조건</p>`;
  get('diagram').innerHTML=diagram(o);renderStuds(o,stud);
  get('axial').innerHTML=table(['축','KL (mm)','EIeff (×10¹² N·mm²)','Pe (kN)','Pno / Pe','φcPn (kN)'],o.axes.map(v=>[v.name,f(v.KL),f(v.EI/1e12,3),f(v.Pe),f(v.ratio,3),f(v.phiPn)]))+values([['자동 산정 Ec',f(p.Ec)+' MPa · KDS 14 20 10 (4.3-2)'],['길이효과 전 Pno',f(o.Pno)+' kN'],['유효강성 계수 '+(type==='src'?'C1':'C3'),f(o.C,3)],['축압축 콘크리트 계수',f(o.C2,3)],['순강재 하한 φPn',o.steelPr===null?'총단면 항복 상한과 비교 · 상세 조건 참조':f(o.steelPr)+' kN'],['지배 설계압축강도',f(o.Pr)+' kN'],['Pu / φcPn',f(p.Pu/o.Pr,3)]])+'<p class="beam-muted">Pno/Pe ≤ 2.25: Pn=Pno×0.658^(Pno/Pe), 초과: Pn=0.877Pe. 표의 축별 값은 합성단면 휨좌굴 강도이며 최종 강도에는 확인된 순강재 하한을 반영합니다.</p>';
  get('moments').innerHTML=table(['축','|Mu| (kN·m)','φbMn (kN·m)','강도비'],[['X',f(Math.abs(p.Mux)),f(o.mx?.phiMn),f(o.mx?Math.abs(p.Mux)/o.mx.phiMn:NaN,3)],['Y',f(Math.abs(p.Muy)),f(o.my?.phiMn),f(o.my?Math.abs(p.Muy)/o.my.phiMn:NaN,3)]]);
  const c=o.combined;
  get('interaction').innerHTML=c?interaction(c)+values([['상호작용식',c.high?'Pu/Pr + (8/9)(|Mux|/Mrx + |Muy|/Mry) ≤ 1':'Pu/(2Pr) + |Mux|/Mrx + |Muy|/Mry ≤ 1'],['조합 강도비',f(c.value,3)],['적용 조항','KDS 14 31 80, 4.7.1 → KDS 14 31 10, '+(c.high?'(4.4-1)':'(4.4-2)')]])+'<p class="beam-muted">음영은 현재 축력에서의 모멘트비 허용 영역입니다. 양축 단독 충족만으로 조합 충족을 뜻하지 않습니다.</p>':'<p class="warn">CFT 휨 단면이 비조밀 또는 세장입니다. 휨강도·조합 판정은 보류하며 강관 두께를 조정하거나 별도 검토하세요.</p>';
  get('checks').innerHTML=values([['축압축 단면 분류',o.axialClass],['휨 단면 분류',o.flexureClass],...(o.lambda===null?[]:[['폭두께비 · 조밀 / 비조밀 한계',f(o.lambda,2)+' · '+f(o.lp,2)+' / '+f(o.lr,2)]])])+table(['확인 항목','입력 / 한계','상태'],o.checks.map(q=>[q.label,q.detail,`<span class="${q.ok?'ok':'ng'}">${q.ok?'충족':'확인 필요'}</span>`]));
  get('properties').innerHTML=table(['구성','A (mm²)','Ix (×10⁶ mm⁴)','Iy (×10⁶ mm⁴)'],[['강재',a.steel],['주철근',a.bars],['콘크리트',a.concrete]].map(([k,v])=>[k,f(v.A),f(v.Ix/1e6,3),f(v.Iy/1e6,3)]))+values([['강재 + 주철근 중량',f(o.mass)+' kg/m'],['강재 + 주철근 물량',f(o.mass/1000,4)+' tonf/m'],['콘크리트 물량',f(o.concreteVolume,4)+' m³/m'],['주철근 총 개수',String(o.bars.length)]])+'<p class="beam-muted">띠철근·접합부·이음·용접·할증 제외. 중량은 7,850 kg/m³를 사용하며, tonf 표시는 현장 물량용 환산입니다.</p>';
 }catch(e){lastStud=null;get('error').textContent=e.message;get('error').hidden=false;get('results').hidden=true;for(const id of ['summary','diagram','axial','moments','interaction','checks','properties','stud_results','stud_graph','stud_info'])get(id).innerHTML='';}
}

const wide=SteelSection.SECTIONS.filter(q=>q.listed&&q.H/q.B>=.8&&q.H/q.B<=1.25),other=SteelSection.SECTIONS.filter(q=>q.listed&&!wide.includes(q));
get('section').innerHTML='<optgroup label="기둥용 광폭 RH">'+wide.map(q=>`<option>${q.name}</option>`).join('')+'</optgroup><optgroup label="그 외 RH">'+other.map(q=>`<option>${q.name}</option>`).join('')+'</optgroup>';
get('section').value='H-400×400×13×21';
function selectStud(e){if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;const node=e.target.closest('[data-stud]');if(!node||!lastStud)return;e.preventDefault();selectedStud=Number(node.dataset.stud);studDiagram(lastStud.o,lastStud.t);}
get('stud_graph').addEventListener('click',selectStud);get('stud_graph').addEventListener('keydown',selectStud);
document.getElementById('t9').addEventListener('input',update);update();
})();
