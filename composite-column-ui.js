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
function update(){
 const type=get('type').value;
 get('src_fields').hidden=type!=='src';get('H_field').hidden=type==='circle';get('t_field').hidden=type==='src';
 try{
  const p={type,bar:get('bar').value,tie:get('tie').value};
  for(const id of ['B','H','t','fck','Fy','Ec','sh','sb','tw','tf','fy','nb','nh','cover','tieSpacing','klx','kly','Pu','Mux','Muy'])p[id]=num(id);
  if(type==='circle')p.H=p.B;
  const o=CompositeColumn.calculate(p),a=o.props;
  get('error').hidden=true;get('results').hidden=false;
  get('summary').innerHTML=`<p class="beam-layout">${type==='src'?'SRC · H형강 매입':type==='rect'?'CFT · 각형강관':'CFT · 원형강관'}</p><p class="beam-capacity">${f(o.Pr)} <small>kN · φcPn</small></p><p class="${!o.supported?'warn':o.ok?'ok':'ng'}">${!o.supported?'검토 범위 또는 상세 조건 확인 필요':o.ok?'입력 축력·모멘트 검토 충족':'입력 축력·모멘트 검토 미달'}</p><p class="beam-muted">${o.combined?'조합 강도비 '+f(o.combined.value,3)+' / 1.000':'비조밀·세장 CFT의 휨 및 조합 판정은 보류합니다.'} · 2차 효과 반영 설계력 입력 조건</p>`;
  get('diagram').innerHTML=diagram(o);
  get('axial').innerHTML=table(['축','KL (mm)','EIeff (×10¹² N·mm²)','Pe (kN)','Pno / Pe','φcPn (kN)'],o.axes.map(v=>[v.name,f(v.KL),f(v.EI/1e12,3),f(v.Pe),f(v.ratio,3),f(v.phiPn)]))+values([['길이효과 전 Pno',f(o.Pno)+' kN'],['유효강성 계수 '+(type==='src'?'C1':'C3'),f(o.C,3)],['축압축 콘크리트 계수',f(o.C2,3)],['순강재 하한 φPn',o.steelPr===null?'총단면 항복 상한과 비교 · 상세 조건 참조':f(o.steelPr)+' kN'],['지배 설계압축강도',f(o.Pr)+' kN'],['Pu / φcPn',f(p.Pu/o.Pr,3)]])+'<p class="beam-muted">Pno/Pe ≤ 2.25: Pn=Pno×0.658^(Pno/Pe), 초과: Pn=0.877Pe. 표의 축별 값은 합성단면 휨좌굴 강도이며 최종 강도에는 확인된 순강재 하한을 반영합니다.</p>';
  get('moments').innerHTML=table(['축','|Mu| (kN·m)','φbMn (kN·m)','강도비'],[['X',f(Math.abs(p.Mux)),f(o.mx?.phiMn),f(o.mx?Math.abs(p.Mux)/o.mx.phiMn:NaN,3)],['Y',f(Math.abs(p.Muy)),f(o.my?.phiMn),f(o.my?Math.abs(p.Muy)/o.my.phiMn:NaN,3)]]);
  const c=o.combined;
  get('interaction').innerHTML=c?interaction(c)+values([['상호작용식',c.high?'Pu/Pr + (8/9)(|Mux|/Mrx + |Muy|/Mry) ≤ 1':'Pu/(2Pr) + |Mux|/Mrx + |Muy|/Mry ≤ 1'],['조합 강도비',f(c.value,3)],['적용 조항','KDS 14 31 80, 4.7.1 → KDS 14 31 10, '+(c.high?'(4.4-1)':'(4.4-2)')]])+'<p class="beam-muted">음영은 현재 축력에서의 모멘트비 허용 영역입니다. 양축 단독 충족만으로 조합 충족을 뜻하지 않습니다.</p>':'<p class="warn">CFT 휨 단면이 비조밀 또는 세장입니다. 휨강도·조합 판정은 보류하며 강관 두께를 조정하거나 별도 검토하세요.</p>';
  get('checks').innerHTML=values([['축압축 단면 분류',o.axialClass],['휨 단면 분류',o.flexureClass],...(o.lambda===null?[]:[['폭두께비 · 조밀 / 비조밀 한계',f(o.lambda,2)+' · '+f(o.lp,2)+' / '+f(o.lr,2)]])])+table(['확인 항목','입력 / 한계','상태'],o.checks.map(q=>[q.label,q.detail,`<span class="${q.ok?'ok':'ng'}">${q.ok?'충족':'확인 필요'}</span>`]));
  get('properties').innerHTML=table(['구성','A (mm²)','Ix (×10⁶ mm⁴)','Iy (×10⁶ mm⁴)'],[['강재',a.steel],['주철근',a.bars],['콘크리트',a.concrete]].map(([k,v])=>[k,f(v.A),f(v.Ix/1e6,3),f(v.Iy/1e6,3)]))+values([['강재 + 주철근 중량',f(o.mass)+' kg/m'],['강재 + 주철근 물량',f(o.mass/1000,4)+' tonf/m'],['콘크리트 물량',f(o.concreteVolume,4)+' m³/m'],['주철근 총 개수',String(o.bars.length)]])+'<p class="beam-muted">띠철근·접합부·이음·용접·할증 제외. 중량은 7,850 kg/m³를 사용하며, tonf 표시는 현장 물량용 환산입니다.</p>';
 }catch(e){get('error').textContent=e.message;get('error').hidden=false;get('results').hidden=true;for(const id of ['summary','diagram','axial','moments','interaction','checks','properties'])get(id).innerHTML='';}
}
document.getElementById('t9').addEventListener('input',update);update();
})();
