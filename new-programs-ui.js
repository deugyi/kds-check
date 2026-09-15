(function(){'use strict';
const E=NewPrograms,F=(v,n=2)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:n}):'—',status=ok=>`<span style="color:${ok?'#18704c':'#b23c31'}">${ok?'충족':'미충족'}</span>`;
const dl=rows=>'<dl class="beam-values">'+rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')+'</dl>';
const table=(heads,rows)=>'<table class="beam-table"><thead><tr>'+heads.map(v=>'<th>'+v+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const svg=body=>'<svg viewBox="0 0 760 380" style="width:100%;max-height:430px" role="img">'+body+'</svg>';
const source=code=>`<a href="https://www.kcsc.re.kr/standardCode/viewer/${encodeURIComponent(code)}" target="_blank" rel="noopener">${code} 공식 기준</a>`;
const fields={ld:['area','h1','gamma1','h2','gamma2','h3','gamma3','h4','gamma4','fixed','live'],bc:['grade','boltGrade','diameter','thickness','rows','cols','pitch','gauge','end','side','Vu'],wcj:['Fexx','thickness','size','length','width','Vu']};
for(const pre of Object.keys(fields)){
 const el=k=>document.getElementById(pre+'_'+k);let active='bX',last=null;
 function render(){try{
  const p={};for(const k of fields[pre])p[k]=(k==='grade'||k==='boltGrade'||k.startsWith('bar'))?el(k).value:el(k).value===''?NaN:Number(el(k).value);
  const r=E[{ld:'load',ts:'slab',bc:'bolt',wcj:'weld'}[pre]](p);last={r,p};el('error').hidden=true;el('results').hidden=false;
  if(pre==='ld'){
   el('summary').innerHTML=dl([['고정하중 D',F(r.D)+' kN/m²'],['활하중 L',F(r.live)+' kN/m²'],['사용하중 D+L',F(r.service)+' kN/m²'],['지배 중력하중 조합',r.governing.name],['계수하중',F(r.governing.q)+' kN/m²'],['검토 면적 전체 계수하중',F(r.total)+' kN']]);
   el('table').innerHTML=table(['고정하중 구성','두께 (mm)','단위중량 (kN/m³)','하중 (kN/m²)'],r.rows.map(v=>[v.name,v.h,v.gamma,F(v.q)]).concat([['추가 고정하중','—','—',F(r.fixed)]]))+table(['하중조합','면적당 (kN/m²)','전체 (kN)'],r.combos.map(v=>[v.name,F(v.q),F(v.q*p.area)]));
   const max=Math.max(1,r.governing.q,r.service),bars=[['고정 D',r.D,'#27679b'],['활 L',r.live,'#168777'],['지배 계수하중',r.governing.q,'#704ba0']];
   el('plot').innerHTML=svg(bars.map(([name,v,c],i)=>`<text x="30" y="${80+i*95}">${name}</text><rect x="180" y="${52+i*95}" width="${v/max*430}" height="40" fill="${c}"><title>${name} ${F(v)} kN/m²</title></rect><text x="${195+v/max*430}" y="${80+i*95}">${F(v)}</text>`).join(''));
   el('basis').innerHTML=source('KDS 41 12 00')+'<p>층 하중 = 두께(mm)/1000 × 단위중량. D는 층 하중과 추가 고정하중의 합입니다. 강도설계 중력하중 조합 1.4D 및 1.2D+1.6L을 비교합니다. 입력된 단위중량과 활하중은 사용자가 확인하는 설계값입니다.</p>';
   el('selection').textContent='면적은 전체 하중 환산에만 사용합니다. 단위는 kN/m²와 kN을 구분합니다.';
  }else if(pre==='bc'){
   el('summary').innerHTML=dl([['볼트·지압·배치 검토',status(r.ok)],['볼트 수',r.n+'개 · '+p.boltGrade+' M'+p.diameter],['볼트 전단 φRn',F(r.phiShear)+' kN'],['구멍 지압 φRn',F(r.phiBearing)+' kN'],['계수전단력 Vu',F(p.Vu)+' kN'],['검토 요구 · 최소강도 45kN 반영',F(r.designDemand)+' kN']]);
   el('table').innerHTML=table(['항목','적용값','판정'],[['표준구멍 직경',r.dh+' mm','—'],['최소 연단거리',r.minEdge+' mm',status(r.edgeOK)],['중심 간격 범위',r.minPitch+'~'+r.maxPitch+' mm',status(r.spacingOK)],['최대 연단거리',r.maxEdge+' mm',status(r.edgeOK)],['볼트 전단',F(r.phiShear)+' kN',status(r.designDemand<=r.phiShear)],['구멍 지압',F(r.phiBearing)+' kN',status(r.designDemand<=r.phiBearing)]]);
   const sc=250/Math.max(r.width,r.length),ox=130,oy=50;let g=`<rect x="${ox}" y="${oy}" width="${r.width*sc}" height="${r.length*sc}" fill="#eef3f7" stroke="#27679b"/>`;
   for(let i=0;i<p.rows;i++)for(let j=0;j<p.cols;j++){const id=i*p.cols+j+1,x=ox+(p.side+j*p.gauge)*sc,y=oy+(p.end+i*p.pitch)*sc;g+=`<circle data-bolt="${id}" role="button" tabindex="0" aria-label="볼트 ${id} 선택" cx="${x}" cy="${y}" r="${Math.max(7,p.diameter*sc/2)}" fill="#b8d3e7" stroke="#27679b"><title>볼트 ${id} · 전단분담 ${F(p.Vu/r.n)} kN</title></circle>`;}
   el('plot').innerHTML=svg(g+`<text x="430" y="95">하중 방향: ↓</text><text x="430" y="145">${p.rows} × ${p.cols} = ${r.n}개</text><text x="430" y="195">접합판 ${r.width} × ${r.length} mm</text><text x="430" y="245">두께 ${p.thickness} mm</text>`);
   el('selection').textContent='볼트를 클릭하면 1개당 전단분담을 표시합니다. 모든 볼트에 균등 분배하는 동심하중 모델입니다.';
   el('basis').innerHTML=source('KDS 14 31 25')+'<p>표 4.1-9 나사부 포함 공칭전단강도(F8T 320, F10T 400 MPa), φ=0.75. 하중방향 접합 길이 800mm 초과 시 공칭전단강도 0.85배. 구멍 지압은 식 4.1-9: Rn=min(1.2Lc·t·Fu,2.4d·t·Fu). 표준구멍·절단연단 최소거리, 최소 중심간격 2.5d 및 비부식 조건 최대간격을 확인합니다.</p>';
  }else{
   el('summary').innerHTML=dl([['용접재·치수 검토',status(r.ok)],['설계용접강도 φRn',F(r.capacity)+' kN'],['계수하중 Vu',F(p.Vu)+' kN'],['검토 요구 · 최소강도 45kN 반영',F(r.designDemand)+' kN'],['유효목두께 a',F(r.a)+' mm'],['한 줄 유효길이',F(r.Le)+' mm']]);
   el('table').innerHTML=table(['항목','계산값','판정'],[['필릿 치수 허용 범위',`${r.minSize}~${r.maxSize} mm`,status(p.size>=r.minSize&&p.size<=r.maxSize)],['장용접 저감계수 β',F(r.beta,4),'—'],['총 유효목면적',F(r.Aw)+' mm²','—'],['소요 유효길이 · 1줄',F(r.requiredLength)+' mm',status(r.Le>=r.requiredLength)],['길이·치수 조건','L ≥ max(10s,30mm,용접선 간격)',status(r.detailOK)]]);
   el('plot').innerHTML=svg(`<rect x="130" y="45" width="200" height="270" fill="#eef3f7" stroke="#849cb0"/><path d="M140 55V305M320 55V305" stroke="#c0782b" stroke-width="${Math.min(16,p.size+2)}"><title>평행 필릿용접 2줄 · s ${p.size} mm / L ${p.length} mm</title></path><text x="430" y="90">용접선 평행 하중: ↓</text><text x="430" y="140">2줄 × ${p.length} mm</text><text x="430" y="190">필릿 s = ${p.size} mm</text><text x="430" y="240">간격 ${p.width} mm</text><text x="230" y="350" text-anchor="middle">용접 배치 개념도</text>`);
   el('selection').textContent='평행 용접 2줄이 하중을 균등하게 분담합니다. 필요한 길이는 유효길이이므로 장용접 저감 후 길이와 비교합니다.';
   el('basis').innerHTML=source('KDS 14 31 25')+'<p>φRn=0.75×0.60FEXX×Aw, Aw=2×(s/√2)×Le. L≤100s이면 Le=L, 100s&lt;L≤300s이면 β=min(1,1.2−0.002L/s), L&gt;300s이면 Le=180s. 표 4.1-6(a)의 얇은 판 두께에 따른 최소 필릿 치수와 겹침이음의 최대 치수를 확인합니다. 길이는 공통규정 10s·30mm와 평행 용접선 간격을 함께 만족시킵니다.</p>';
  }
 }catch(e){last=null;el('error').hidden=false;el('error').textContent=e.message;el('results').hidden=true;for(const k of ['summary','plot','table','basis'])el(k).innerHTML='';el('selection').textContent='';}}
 for(const k of fields[pre])el(k).addEventListener('input',render);
 el('plot').addEventListener('click',e=>{const a=e.target.closest('[data-slab]'),b=e.target.closest('[data-bolt]');if(a){active=a.getAttribute('data-slab');render();}if(b&&last)el('selection').textContent=`볼트 ${b.getAttribute('data-bolt')} · 전단분담 ${F(last.p.Vu/last.r.n)} kN/개`;});
 el('plot').addEventListener('keydown',e=>{const b=e.target.closest('[data-bolt]');if(b&&last&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el('selection').textContent=`볼트 ${b.getAttribute('data-bolt')} · 전단분담 ${F(last.p.Vu/last.r.n)} kN/개`;}});
 render();
}
})();
