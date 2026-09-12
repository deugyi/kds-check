(function(){'use strict';
const E=RCFooting,F=(x,n=1)=>Number.isFinite(x)?x.toLocaleString('ko-KR',{maximumFractionDigits:n}):'—';
const dl=rows=>'<dl class="beam-values">'+rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')+'</dl>';
const status=ok=>`<span style="color:${ok?'#18704c':'#b23c31'}">${ok?'충족':'미충족'}</span>`;
for(const pre of ['fs','fp']){
 const el=k=>document.getElementById(pre+'_'+k),keys=['fck','fy','bx','by','h','cx','cy','cover','Ns','Mxs','Mys','Nu','Mxu','Myu','weightFactor','barX','barY','spacingX','spacingY',...(pre==='fs'?['qa']:['nx','ny','sx','sy','diameter','pileAllow'])];
 function update(){
  try{
   const p={mode:pre==='fs'?'soil':'pile'};
   for(const k of keys)p[k]=k.startsWith('bar')?el(k).value:el(k).value===''?NaN:Number(el(k).value);
   el('customWrap').hidden=el('fck').value!=='직접 입력';
   if(el('fck').value==='직접 입력')p.fck=el('fckCustom').value===''?NaN:Number(el('fckCustom').value);
   const r=E.calculate(p),b=r.bearing,pc=r.punching;
   el('error').hidden=true;el('results').hidden=false;
   el('summary').innerHTML=dl([['사용하중 지지력',`${status(b.max<=b.limit)} · 최대 ${F(b.max)} / 허용 ${F(b.limit)} ${b.unit}`],['최소 반력',F(b.min)+' '+b.unit],['유효깊이 dX / dY',`${F(r.dx)} / ${F(r.dy)} mm · ${status(r.depthOK)}`],['2방향 전단 · 기둥 주변',`${status(pc.ok)} · 검토비 ${F(pc.ratio,3)}`]])+`<p class="beam-muted">${p.mode==='pile'?'파일캡 추가 검토 필요 · 아래 적용 범위를 확인하세요.':'표시된 항목에 대한 검토 결과입니다.'}</p>`;
   el('checks').innerHTML='<div style="overflow-x:auto"><table class="beam-table"><thead><tr><th>방향</th><th>하부 철근</th><th>Mu / φMn<br>(kN·m/m)</th><th>Vu / φVc<br>(kN)</th><th>배근·연성</th></tr></thead><tbody>'+r.rows.map(v=>`<tr><td>${v.axis}</td><td>${v.bar}@${v.spacing}<br>As ${F(v.As)} mm²/m</td><td>${F(v.Mu)} / ${F(v.phiMn)}<br>${status(v.flexOK)}</td><td>${F(v.Vu)} / ${F(v.phiVc)}<br>${status(v.shearOK)}</td><td>${status(v.steelOK&&v.ductile)}<br>최소 As ${F(v.AsMin)}</td></tr>`).join('')+'</tbody></table></div>'+dl([['기둥 뚫림 위험둘레 b₀',F(pc.b0)+' mm'],['뚫림 전단력 Vu / φVc',`${F(pc.Vu)} / ${F(pc.phiVc)} kN`],['편심 포함 최대 vu / φvc',`${F(pc.vu,3)} / ${F(pc.phiV,3)} MPa`],['적용 철근비 ρ / 크기계수 ks',`${F(pc.rho,5)} / ${F(pc.ks,3)}`]])+'<p class="beam-muted">기둥면에서 d는 1방향 전단, d/2는 2방향 전단 위험단면입니다. 휨은 기둥면에서 검토합니다. 단변 방향 Mu에는 중앙대 배근 보정이 포함됩니다.</p>';
   el('basis').innerHTML=dl([['기초 자중',F(r.W)+' kN · 24 kN/m³'],['지지력용 총 축력',F(r.totalS)+' kN'],['계수 총 축력',F(r.totalU)+' kN · 자중계수 '+p.weightFactor],['자중 처리','반력에 가산 후, 휨·전단 산정에서 해당 구역 자중 차감']])+r.notes.map(v=>'<p class="beam-muted">'+v+'</p>').join('')+'<p class="beam-muted">기준: <a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2070" target="_blank" rel="noopener">KDS 14 20 70 §4.2</a> · <a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2022" target="_blank" rel="noopener">KDS 14 20 22 §4.11</a>. 전단 φ = 0.75. 뚫림 vc는 철근비·유효깊이·위험둘레 영향을 반영합니다.</p>';
   const sc=300/Math.max(p.bx,p.by),x=v=>250+v*sc,y=v=>205-v*sc;
   let svg='<svg viewBox="0 0 720 440" style="width:100%;max-height:500px" role="img" aria-label="기초 평면 및 전단 위험단면"><text x="250" y="26" text-anchor="middle">기초 평면 · X → / Y ↑</text>';
   svg+=`<rect x="${x(-p.bx/2)}" y="${y(p.by/2)}" width="${p.bx*sc}" height="${p.by*sc}" fill="#eff4f8" stroke="#27679b"/><rect x="${x(-pc.px/2)}" y="${y(pc.py/2)}" width="${pc.px*sc}" height="${pc.py*sc}" fill="none" stroke="#b97626" stroke-width="2" stroke-dasharray="7 4"><title>뚫림 위험둘레 · 기둥면 d/2 · b₀ ${F(pc.b0)} mm</title></rect>`;
   for(const v of r.piles)svg+=`<circle data-pile="${v.id}" tabindex="0" role="button" aria-label="파일 ${v.id} 반력" cx="${x(v.x*1000)}" cy="${y(v.y*1000)}" r="${p.diameter*sc/2}" fill="#d2e9e4" stroke="#168777"><title>파일 ${v.id}: 사용 ${F(v.Rs)} kN / 계수 ${F(v.Ru)} kN</title></circle><text pointer-events="none" x="${x(v.x*1000)}" y="${y(v.y*1000)+4}" text-anchor="middle" font-size="12">${v.id}</text>`;
   svg+=`<rect x="${x(-p.cx/2)}" y="${y(p.cy/2)}" width="${p.cx*sc}" height="${p.cy*sc}" fill="#27679b"><title>중앙 기둥 ${p.cx} × ${p.cy} mm</title></rect><text x="250" y="380" text-anchor="middle">${p.bx} × ${p.by} × ${p.h} mm</text><text x="470" y="120">청색: 기둥 / 기초</text><text x="470" y="151" fill="#b97626">주황 점선: 뚫림 위험둘레</text><text x="470" y="182" fill="#168777">${p.mode==='pile'?'녹색: 파일 · 클릭하여 반력 확인':'지반 반력: 전면 선형 분포'}</text><text x="470" y="230">X 하부 ${p.barX}@${p.spacingX}</text><text x="470" y="260">Y 하부 ${p.barY}@${p.spacingY}</text></svg>`;
   el('plot').innerHTML=svg;
   el('selection').textContent=p.mode==='pile'?'파일을 클릭하면 해당 파일의 반력이 표시됩니다.':'기초 모서리의 최대·최소 사용 접지압: '+F(b.max)+' / '+F(b.min)+' kPa';
   el('plot').onclick=e=>{const t=e.target.closest('[data-pile]');if(!t)return;const v=r.piles.find(v=>v.id===Number(t.getAttribute('data-pile')));if(v)el('selection').textContent=`파일 ${v.id} · X ${F(v.x*1000)} / Y ${F(v.y*1000)} mm · 사용 ${F(v.Rs)} kN / 계수 ${F(v.Ru)} kN`;};
   el('plot').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el('plot').onclick(e);}};
  }catch(e){el('error').hidden=false;el('error').textContent=e.message;el('results').hidden=true;for(const k of ['summary','plot','checks','basis'])el(k).innerHTML='';}
 }
 for(const k of [...keys,'fckCustom'])el(k).addEventListener('input',update);
 update();
}
})();
