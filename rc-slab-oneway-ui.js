(function(root){
'use strict';
const C=root.RCSlabOneWay,$=k=>document.getElementById('ow_'+k),f=(v,n=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:n,minimumFractionDigits:n}):'—';
const nums=['fck','fy','h','L','cover','dead','live','point','pointX','Mp','Mn','V','bottomSpacing','topSpacing','tempSpacing'];
const keys=[...nums,'mode','support','environment','bottomBar','topBar','tempBar'];
let selected='bottom',last;
const badge=ok=>`<span class="${ok?'ok':'ng'}">${ok?'충족':'미달'}</span>`;
const values=rows=>'<dl class="beam-values">'+rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')+'</dl>';
function read(){const p={};for(const k of keys)p[k]=nums.includes(k)?($(k).value.trim()===''?NaN:Number($(k).value)):$(k).value;return p;}
function diagram(o){
 const p=o.p,scale=Math.min(.66,180/p.h),w=1000*scale,h=p.h*scale,x=(800-w)/2,y=55,colors={bottom:'#2069a3',top:'#ad5945'};
 let s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--code)" stroke="var(--dim)"/><text x="400" y="28" text-anchor="middle">1 m 설계대 · 경간에 직각인 단면</text>`;
 for(const face of ['top','bottom']){
  const bar=root.RCBeam.BARS[p[face+'Bar']],spacing=p[face+'Spacing'],count=Math.max(1,Math.min(60,Math.ceil((1000-2*p.cover-bar.diameter)/spacing))),span=(count-1)*spacing,xx=(800-span*scale)/2,yy=face==='top'?y+(p.cover+bar.diameter/2)*scale:y+h-(p.cover+bar.diameter/2)*scale;
  s+=`<g role="button" tabindex="0" data-face="${face}" aria-label="${face==='top'?'상부':'하부'} 주철근 선택" style="cursor:pointer"><title>${face==='top'?'상부':'하부'} ${p[face+'Bar']} @ ${spacing} mm</title><rect x="${x}" y="${yy-12}" width="${w}" height="24" fill="transparent"/>`;
  for(let i=0;i<count;i++)s+=`<circle cx="${xx+i*spacing*scale}" cy="${yy}" r="${Math.max(3,bar.diameter*scale/2)}" fill="${colors[face]}" stroke="${selected===face?'#152e45':colors[face]}" stroke-width="${selected===face?2:1}"/>`;
  s+='</g>';
  const ds=root.RCBeam.BARS[p.tempBar].diameter,ty=face==='top'?yy+(bar.diameter+ds)*scale/2:yy-(bar.diameter+ds)*scale/2;
  s+=`<g role="button" tabindex="0" data-face="temp" aria-label="${face==='top'?'상부':'하부'} 배력근 선택" style="cursor:pointer"><rect x="${x+p.cover*scale}" y="${ty-4}" width="${w-2*p.cover*scale}" height="8" fill="transparent"/><line x1="${x+p.cover*scale}" x2="${x+w-p.cover*scale}" y1="${ty}" y2="${ty}" stroke="#329080" stroke-width="${Math.max(2,ds*scale)}"><title>직각방향 수축·온도철근 ${p.tempBar} @ ${p.tempSpacing} mm · 각 면</title></line></g>`;
 }
 s+=`<text x="400" y="${y+h+28}" text-anchor="middle">폭 1,000 mm × 두께 ${f(p.h,0)} mm</text>`;
 $('diagram').innerHTML=`<svg viewBox="0 0 800 ${y+h+55}" role="img" aria-label="1방향 슬래브 상하부 배근 단면" style="width:100%;min-height:190px">${s}</svg>`;
 if(selected==='temp'){ $('selected').innerHTML=values([['선택 철근',`배력근 · 상·하부 각 ${p.tempBar} @ ${f(p.tempSpacing,0)} mm`],['각 면 철근량',`${f(o.temp.AsEach)} mm²/m`],['양면 합 / 최소량',`${f(o.temp.As)} / ${f(o.temp.AsMin)} mm²/m ${badge(o.temp.ok)}`]]);return;}
 const r=o[selected];$('selected').innerHTML=values([['선택 철근',`${selected==='bottom'?'하부 · 정모멘트':'상부 · 부모멘트'} ${r.bar} @ ${f(r.spacing,0)} mm`],['유효깊이 d',`${f(r.d)} mm`],['철근량 As',`${f(r.As)} mm²/m`],['설계휨강도 φMn',`${f(r.phiMn)} kN·m/m`]]);
}
function loadGraph(o){
 const p=o.p;if(p.mode==='direct')return '<p class="beam-muted">직접 입력한 정·부모멘트 및 전단 포락값을 검토합니다. 하중 분포와 지지조건을 역산하지 않습니다.</p>';
 let s='<line x1="65" y1="95" x2="735" y2="95" stroke="#2069a3" stroke-width="7"/>';
 for(let x=65;x<=735;x+=67)s+=`<path d="M${x} 30V80m-4-7 4 7 4-7" fill="none" stroke="#ad5945"/>`;
 if(p.support==='simple'||p.support==='propped')for(const x of p.support==='simple'?[65,735]:[65])s+=`<path d="M${x} 100l-12 20h24z" fill="none" stroke="var(--ink)"/>`;
 if(p.support!=='simple')for(const x of p.support==='fixed'?[65,735]:p.support==='propped'?[735]:[65])s+=`<rect x="${x-5}" y="80" width="10" height="40" fill="var(--dim)"/>`;
 s+=`<text x="400" y="20" text-anchor="middle">D ${f(p.dead)} + L ${f(p.live)} kN/m² · 미계수 하중</text><text x="400" y="140" text-anchor="middle">해석 경간 L = ${f(p.L)} m</text>`;
 if(p.point>0){const xx=65+670*p.pointX/p.L;s+=`<path d="M${xx} 42V90m-7-10 7 10 7-10" fill="none" stroke="#7548a6" stroke-width="3"/><text x="${Math.max(125,Math.min(675,xx))}" y="${p.pointX<p.L/2?58:75}" text-anchor="middle" fill="#7548a6">PL ${f(p.point)} kN · x=${f(p.pointX)} m</text>`;}
 return `<svg viewBox="0 0 800 160" role="img" aria-label="슬래브 등분포하중 및 지지조건" style="width:100%">${s}</svg>`;
}
function comboTable(o){
 if(!o.load.cases.length)return '';
 const rows=o.load.cases.map(c=>`<tr><td>${c.name}</td><td>${f(c.q)}</td><td>${f(c.P)}</td><td>${f(c.Mp)} @ ${f(c.xp)}m</td><td>${f(c.Mn)} @ ${f(c.xn)}m</td><td>${f(c.V)} @ ${f(c.xv)}m</td></tr>`).join('');
 return '<div class="ow-scroll"><table><thead><tr><th>하중조합</th><th>wu (kN/m²)</th><th>Pu (kN)</th><th>Mu+ (kN·m/m)</th><th>|Mu−| (kN·m/m)</th><th>|Vu| (kN/m)</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+values([['정모멘트 지배',o.load.governing.Mp.name],['부모멘트 지배',o.load.governing.Mn.name],['전단 지배',o.load.governing.V.name]])+'<p class="beam-muted">@ 위치는 왼쪽 끝부터의 거리입니다. 집중하중은 입력한 1 m 설계대에 전달되는 하중으로 해석하며 분배폭·뚫림전단은 별도 검토합니다. 연속단은 회전구속으로 이상화합니다.</p>';
}
function run(){
 $('direct').hidden=$('mode').value!=='direct';$('auto').hidden=$('mode').value!=='auto';
 try{
  const o=C.calculate(read());last=o;$('error').hidden=true;$('results').hidden=false;
  $('summary').innerHTML=`<p class="${o.ok?'ok':'ng'}">${o.ok?'휨·전단·배근 검토 항목 충족':'검토 미달 항목 확인'}</p><p class="beam-muted">1 m 설계대 · 일반중량 콘크리트 · 별도 전단철근 없음</p>`+`<div class="ow-metrics"><div class="ow-metric"><b style="color:#2069a3">하부 주철근 · 정모멘트</b><strong>${o.bottom.bar} @ ${f(o.bottom.spacing,0)} mm</strong><span>φMn ${f(o.bottom.phiMn)} kN·m/m</span>${badge(o.bottom.ok)}</div><div class="ow-metric"><b style="color:#ad5945">상부 주철근 · 부모멘트</b><strong>${o.top.bar} @ ${f(o.top.spacing,0)} mm</strong><span>φMn ${f(o.top.phiMn)} kN·m/m</span>${badge(o.top.ok)}</div><div class="ow-metric"><b>전단내력 · φVn = φVc</b><strong>${f(o.shear.phiVc)} kN/m</strong><span>소요 Vu ${f(o.shear.V)} kN/m</span>${badge(o.shear.ok)}</div><div class="ow-metric"><b style="color:#329080">배력근 · 수축·온도철근</b><strong>상·하부 각 ${o.p.tempBar} @ ${f(o.p.tempSpacing,0)} mm</strong><span>양면 As ${f(o.temp.As,1)} / 최소 ${f(o.temp.AsMin,1)} mm²/m</span>${badge(o.temp.ok)}</div></div>`;
  diagram(o);$('load').innerHTML=loadGraph(o)+values([['산정 방식',o.load.formula],['정모멘트 Mu+',`${f(o.load.Mp)} kN·m/m`],['부모멘트 |Mu−|',`${f(o.load.Mn)} kN·m/m`],['전단력 |Vu|',`${f(o.load.V)} kN/m`]]) +comboTable(o)+'<p class="beam-muted">자동 모드는 미계수 D·L·PL에 하중계수를 적용합니다. 등분포 활하중과 집중활하중은 동시 재하합니다. 자중은 자동 가산하지 않습니다. 직접 모드의 Mu·Vu에는 계수를 다시 곱하지 않습니다. 자동 전단은 부재 내 최대값을 사용하며 d 위치로 저감하지 않습니다.</p>';
  $('flexure').innerHTML='<table class="beam-table"><thead><tr><th>위치</th><th>배근</th><th>As (mm²/m)</th><th>Mu (kN·m/m)</th><th>φMn (kN·m/m)</th><th>결과</th></tr></thead><tbody>'+[o.bottom,o.top].map(r=>`<tr><td>${r.which==='bottom'?'하부 · 정':'상부 · 부'}</td><td>${r.bar} @ ${f(r.spacing,0)}</td><td>${f(r.As,1)}</td><td>${f(r.Mu)}</td><td>${f(r.phiMn)}</td><td>${badge(r.ok)}</td></tr>`).join('')+'</tbody></table>'+[o.bottom,o.top].map(r=>`<p class="beam-muted">${r.which==='bottom'?'하부':'상부'}: ${r.reasons.length?r.reasons.join(' · '):'검토 항목 충족'} · φ=${f(r.phi,3)}, εt=${f(r.et,5)}</p>`).join('');
  $('details').innerHTML=values([['최소 휨철근량 · 각 면 적용',`${f(o.bottom.AsMin,1)} mm²/m`],['위험단면 최대간격',`${f(o.bottom.detailMax,0)} mm`],['균열제어 최대간격 · fs=2fy/3',`${f(o.bottom.crackMax,1)} mm`],['수축·온도철근 · 각 면',`${o.p.tempBar} @ ${f(o.p.tempSpacing,0)} mm`],['수축·온도철근량 · 양면 합',`${f(o.temp.As,1)} / 필요 ${f(o.temp.AsMin,1)} mm²/m ${badge(o.temp.ok)}`],['수축·온도철근 최대간격',`${f(o.temp.maxSpacing,0)} mm`],['전단 유효깊이 · 작은 d 적용',`${f(o.shear.d)} mm`],['콘크리트 설계전단강도 φVc',`${f(o.shear.phiVc)} kN/m / Vu ${f(o.shear.V)} kN/m ${badge(o.shear.ok)}`]]);
  $('temp').innerHTML=values([['배력근 방향','경간에 직각 · 상·하부 동일 배근'],['배근',`각 면 ${o.p.tempBar} @ ${f(o.p.tempSpacing,0)} mm`],['각 면 철근량 As',`${f(o.temp.AsEach,1)} mm²/m`],['최소량 · 양면 합',`${f(o.temp.As,1)} / 필요 ${f(o.temp.AsMin,1)} mm²/m ${badge(o.temp.areaOK)}`],['최대 중심간격',`${f(o.p.tempSpacing,0)} / 허용 ${f(o.temp.maxSpacing,0)} mm ${badge(o.temp.spacingOK)}`],['순간격',`${f(o.temp.clear,2)} / 최소 ${f(o.temp.clearMin,2)} mm ${badge(o.temp.clearOK)}`]])+'<p class="beam-muted">KDS 14 20 50 4.6.2: 최소량은 전체 콘크리트 단면 기준이며 양면 합산합니다. 간격은 각 면에서 min(5h, 450 mm) 이하입니다. 온도·수축이 심하게 구속되는 경우의 추가 철근과 정착은 별도 검토입니다.</p>';
  $('suggestions').innerHTML=['bottom','top'].map(k=>{const r=o.suggestions[k];return `<p>${k==='bottom'?'하부':'상부'}: ${r?`${r.bar} @ ${r.spacing} mm <button type="button" class="beam-view" data-apply="${k}">간격 적용</button>`:'현재 철근 규격의 후보 없음 · 두께 또는 규격 조정 필요'}</p>`;}).join('')+'<p class="beam-muted">선택한 규격에서 휨·최소철근·연성·간격을 충족하는 가장 넓은 75–300 mm 후보 간격입니다. 전단·두께·수축철근 조건은 별도로 확인합니다.</p>';
  const t=o.thickness;$('thickness').innerHTML=values([['절대 최소 두께 100 mm',badge(t.absolute)],['처짐 미계산 시 참고 두께',`${f(t.reference,1)} mm · ${t.referenceOk?'참고 두께 충족':'상세 처짐 검토 또는 두께 증가 필요'}`]])+`<p class="beam-muted">KDS 14 20 30 표 4.2-1: L/${t.divisor} × ${f(t.factor,3)}. 선택한 지지조건·경간 기준이며, 큰 처짐에 손상되기 쉬운 비구조요소가 없는 경우에 한합니다. 직접 입력 모드에서도 선택한 조건으로 참고값만 표시합니다. 처짐량·균열폭 자체는 계산하지 않습니다.</p>`;
  $('basis').innerHTML=values([['재료',`fck ${o.p.fck} / fy ${o.p.fy} MPa`],['치수·피복',`h ${o.p.h} mm / L ${o.p.L} m / 피복 ${o.p.cover} mm`],['골재·노출환경',`25 mm (내부 고정) / ${o.p.environment==='dry'?'건조':'기타'}`]])+'<p>주철근은 상·하부 각 면의 최외측, 수축·온도철근은 그 안쪽에 배치합니다. 각 휨 검토는 해당 인장면 철근만 사용하며 반대편 압축철근 효과는 산입하지 않습니다. 보수적인 배근 정책으로 상·하부 각각 최소 휨철근량을 확보하며, 직각방향 수축·온도철근량은 양면 합으로 검토합니다.</p><p>KDS 14 20 10 4.2.2 식 (4.2-1), (4.2-2) / 14 20 70 4.1.1 / 14 20 20 4.1.2, 4.2.2(3), 4.2.3 / 14 20 50 4.2.2, 4.6.2 / 14 20 22 4.2.1(1), 4.3.3(1) / 14 20 30 표 4.2-1.</p><p>일정 두께·축력 없는 일반 RC 슬래브입니다. 연속 슬래브의 모멘트 수정·활하중 패턴, 개구부, 뚫림전단, 정착·이음·단부 상세, 피복의 노출등급 적합성은 별도 검토합니다. 연속단은 회전을 완전히 구속하는 이상화입니다. 1단 연속은 왼쪽 단순·오른쪽 회전구속으로 해석합니다. 인접 경간 강성과 재하 패턴을 포함한 연속 슬래브 전체 해석을 대신하지 않습니다. 자동 하중조합은 D와 L만 작용하는 중력하중 범위이며 다른 하중은 포함하지 않습니다.</p>';
 }catch(e){last=null;$('error').hidden=false;$('error').textContent=e.message;$('results').hidden=true;$('summary').innerHTML='';$('diagram').innerHTML='';$('selected').innerHTML='';}
}
for(const k of keys)for(const event of ['input','change'])$(k).addEventListener(event,run);
for(const face of ['bottom','top','temp'])$('view_'+face).addEventListener('click',()=>{selected=face;if(last)diagram(last);});
$('diagram').addEventListener('click',e=>{const target=e.target.closest('[data-face]');if(target&&last){selected=target.dataset.face;diagram(last);}});
$('diagram').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const target=e.target.closest('[data-face]');if(target&&last){e.preventDefault();selected=target.dataset.face;diagram(last);}}});
$('suggestions').addEventListener('click',e=>{const target=e.target.closest('[data-apply]');if(target&&last){const k=target.dataset.apply;$(k+'Spacing').value=last.suggestions[k].spacing;run();}});
root.runRCSlabOneWay=run;run();
})(typeof globalThis!=='undefined'?globalThis:this);
