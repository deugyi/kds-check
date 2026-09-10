(function(){
'use strict';
const get=id=>document.getElementById('br_'+id);
const f=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
const num=id=>get(id).value.trim()===''?NaN:Number(get(id).value);
let current=null,selected=null;
function diagram(a,b){
  const scale=Math.min(240/Math.max(a.H,b?.H||0),250/Math.max(a.B,b?.B||0));
  const shape=(p,c,label,color)=>{
    const x=c-p.B*scale/2,y=285-p.H*scale,tf=p.tf*scale,tw=p.tw*scale;
    return `<g fill="${color}" fill-opacity=".2" stroke="${color}"><rect x="${x}" y="${y}" width="${p.B*scale}" height="${tf}"/><rect x="${x}" y="${285-tf}" width="${p.B*scale}" height="${tf}"/><rect x="${c-tw/2}" y="${y+tf}" width="${tw}" height="${(p.H-2*p.tf)*scale}"/></g><g fill="var(--ink)" text-anchor="middle" font-size="14"><text x="${c}" y="22">${label}</text><text x="${c}" y="311">${p.H} × ${p.B} × ${p.tw} × ${p.tf} mm</text></g>`;
  };
  return `<svg viewBox="0 0 660 330" style="width:100%;max-height:380px" role="img" aria-label="기존 BH와 선택 RH의 동일 축척 비교">${shape(a,165,'기존 BH','#64748b')}${b?shape(b,495,'선택 RH','#1764b5'):'<text x="495" y="165" text-anchor="middle" fill="var(--muted)">RH 후보 없음</text>'}</svg>`;
}
function comparison(row){
  const o=current,b=o.base;
  get('diagram').innerHTML=diagram(o.bh,row?.p);
  const cells=[['강종',get('bhGrade').value,get('rhGrade').value],['Fy (MPa)',f(o.bh.Fy),f(row?.p.Fy)],['중량 (kg/m)',f(o.bhMass),f(row?.mass)],['φMn (kN·m)',f(b.supported?b.flexure.phiMn:null),f(row?.out.flexure?.phiMn)],['φVn (kN)',f(b.supported?b.shear.phiVn:null),f(row?.out.shear?.phiVn)],['Ix (×10⁶ mm⁴)',f(b.props.Ix/1e6),f(row?.out.props.Ix/1e6)],['높이 H (mm)',f(o.bh.H),f(row?.p.H)]];
  const ratio=(a,c)=>c>0?`${f(a/c,3)}`:'—';
  get('compare').innerHTML=`<table><thead><tr><th>비교 항목</th><th>기존 BH</th><th>선택 RH</th></tr></thead><tbody>${cells.map(c=>`<tr>${c.map((v,i)=>`<${i?'td':'th'}>${v}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table>`+
    (row?`<p><b>${row.section.name}</b> · ${row.eligible?'선정 조건 충족':row.reasons.join(' · ')}</p><p class="beam-muted">BH 대비 중량 ${f(Math.abs(row.mass/o.bhMass-1)*100)}% ${row.mass<=o.bhMass?'감소':'증가'} · Ix ${ratio(row.out.props.Ix,b.props.Ix)}배. ${row.out.shear?.needsStiffener?'전단 스티프너 상세를 별도로 확인하세요.':''}</p>`:'')+
    (!b.supported?`<p class="beam-muted">기존 BH: ${b.message} 하중 기준으로 RH 후보 검색은 가능합니다.</p>`:'');
}
function table(){
  const o=current,rows=get('filter').value==='all'?o.rows:o.rows.filter(r=>r.eligible);
  get('rows').innerHTML=rows.map(r=>`<tr class="${r===o.recommended?'economical ':''}${r.section.name===selected?'selected':''}"><td>${r===o.recommended?'✓ ':''}${r.section.name}</td><td>${f(r.p.Fy)}</td><td>${f(r.mass)}</td><td>${f(r.out.flexure?.phiMn)}</td><td>${f(r.out.shear?.phiVn)}</td><td>${f(r.out.props.Ix/o.base.props.Ix,2)}</td><td>${r.eligible?'조건 충족':r.reasons.join(' · ')}</td><td><button type="button" class="beam-view" data-br-section="${r.section.name}" aria-label="${r.section.name} 비교">보기</button></td></tr>`).join('')||'<tr><td colspan="8">조건을 만족하는 RH가 없습니다. 전체 규격에서 제외 사유를 확인하세요.</td></tr>';
  comparison(rows.find(r=>r.section.name===selected)||rows[0]||null);
}
function update(){
  const load=get('mode').value==='load';get('loads').hidden=!load;
  get('mode_note').textContent=load?'입력한 계수하중 Mu·Vu를 RH의 설계강도와 비교합니다.':'BH의 φMn·φVn 각각을 RH가 모두 만족해야 합니다.';
  try{
    const p={mode:get('mode').value,bhGrade:get('bhGrade').value,rhGrade:get('rhGrade').value,keepStiffness:get('stiffness').value==='keep'};
    for(const k of ['H','B','tw','tf','Lb','Cb','Mu','Vu'])p[k]=num(k);
    for(const k of ['maxH','maxB'])p[k]=get(k).value.trim()===''?null:num(k);
    const o=SteelReplacement.calculate(p);current=o;selected=o.recommended?.section.name||null;
    get('material').textContent=`BH 적용 Fy = ${f(o.bh.Fy)} MPa · RH는 각 후보의 판두께에 따라 Fy를 적용합니다.`;
    get('summary').innerHTML=`<p class="beam-economy-title">${o.recommended?'최경량 충족 후보 · '+o.recommended.section.name:'조건 충족 후보 없음'}</p><p>${o.rows.filter(r=>r.eligible).length} / ${o.rows.length}개 규격 · ${load?'입력 설계하중 기준':'기존 BH 내력 기준'}</p>`+
      (o.target?`<p>휨 비교 기준 <b>${f(o.target.M)} kN·m</b> · 전단 비교 기준 <b>${f(o.target.V)} kN</b></p>`:`<p>${o.base.message} BH 내력 기준의 후보 선정을 보류합니다.</p>`)+
      (o.recommended?`<p>BH ${f(o.bhMass)} → RH <b>${f(o.recommended.mass)} kg/m</b></p>`:'')+
      (load&&o.base.supported?`<p class="beam-muted">기존 BH의 입력 하중 검토: ${o.base.ok?'휨·전단 충족':'휨 또는 전단 부족'}</p>`:'');
    table();
  }catch(e){current=null;get('summary').textContent=e.message;get('material').textContent='입력값을 확인하세요.';for(const id of ['diagram','compare','rows'])get(id).innerHTML='';}
}
for(const id of ['bhGrade','rhGrade']){
  get(id).innerHTML=Object.keys(SteelSection.STEEL).map(g=>`<option>${g}</option>`).join('');
  get(id).value=id==='bhGrade'?'SM355':'SHN355';
}
document.getElementById('t8').addEventListener('input',update);
get('rows').addEventListener('click',e=>{const b=e.target.closest('[data-br-section]');if(!b||!current)return;selected=b.dataset.brSection;table();});
update();
})();
