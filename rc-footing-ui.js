(function(){'use strict';
const E=RCFooting,F=(x,n=1)=>Number.isFinite(x)?x.toLocaleString('ko-KR',{maximumFractionDigits:n}):'—';
const dl=rows=>'<dl class="beam-values">'+rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')+'</dl>';
const status=ok=>`<span style="color:${ok?'#18704c':'#b23c31'}">${ok?'충족':'미충족'}</span>`;
for(const pre of ['fs','fp']){
 const el=k=>document.getElementById(pre+'_'+k),keys=['shearBar','fyt','fck','fy','bx','by','h','cx','cy','cover','Ns','Mxs','Mys','Nu','Mxu','Myu','weightFactor','barX','barY','spacingX','spacingY',...(pre==='fs'?['qa']:['nx','ny','sx','sy','diameter','pileAllow','gapFactor'])];
 function update(){
  try{
   const p={mode:pre==='fs'?'soil':'pile'};
   for(const k of keys)p[k]=(k.startsWith('bar')||k==='shearBar')?el(k).value:el(k).value===''?NaN:Number(el(k).value);
   if(pre==='fp'){p.autoSize=true;Object.assign(p,E.pileSize(p));for(const k of ['bx','by','sx','sy'])el(k).value=String(p[k]);}
   el('customWrap').hidden=el('fck').value!=='직접 입력';
   if(el('fck').value==='직접 입력')p.fck=el('fckCustom').value===''?NaN:Number(el('fckCustom').value);
   const r=E.calculate(p),b=r.bearing,pc=r.punching,sr=r.reinforcement;
   const pn=sr.punching,pl=r.pileLayout;
   el('reinforcement').innerHTML=sr.oneway.map(v=>'<h3>'+v.axis+' 방향 1방향 전단</h3>'+(!v.needed?'<p>추가 보강 불필요</p>':!v.ok?'<p style="color:#b23c31">'+v.reason+'</p>':dl([['배치',sr.bar+' · '+v.legs+'다리/열 × '+v.rows+'열 (폐쇄형 '+v.count+'조)'],['진행 / 폭 방향 간격',F(v.s)+' / '+F(v.t)+' mm'],['소요 / 제공 Av',F(v.avReq)+' / '+F(v.Av)+' mm²/열'],['보강 후 φVn / Vu',F(v.phiVn)+' / '+F(r.rows.find(a=>a.axis===v.axis).Vu)+' kN · '+status(v.ok)]]))).join('')+'<h3>기둥 주변 2방향 전단</h3>'+(!pn.needed?'<p>추가 보강 불필요</p>':!pn.ok?'<p style="color:#b23c31">'+pn.reason+'</p>':dl([['배치',sr.bar+' · '+pn.legs+'다리/열 × '+pn.count+'열'],['첫 열 / 열 간격',F(pn.first)+' / '+F(pn.s)+' mm'],['소요 / 제공 Av',F(pn.requiredAv)+' / '+F(pn.Av)+' mm²/열'],['보강 구간 최대 검토비',F(pn.ratio,3)+' · '+status(pn.ok)],['보강 외곽 무보강 검토',F(pn.outer.vu,3)+' / '+F(.75*Math.min(pn.outer.base,pn.outer.cap),3)+' MPa · '+status(pn.outer.ok)]]))+sr.notes.map(v=>'<p class="beam-muted">'+v+'</p>').join('');
   el('error').hidden=true;el('results').hidden=false;
   el('summary').innerHTML=dl([['사용하중 지지력',`${status(b.max<=b.limit)} · 최대 ${F(b.max)} / 허용 ${F(b.limit)} ${b.unit}`],['최소 반력',F(b.min)+' '+b.unit],['유효깊이 dX / dY',`${F(r.dx)} / ${F(r.dy)} mm · ${status(r.depthOK)}`],['1방향 전단 · 보강 후',sr.oneway.map(v=>v.axis+' '+status(v.ok)).join(' / ')],['2방향 전단 · 보강 후',pn.needed?(pn.ok?status(true)+' · 검토비 '+F(pn.ratio,3):'배치 불가 · 두께/크기 조정 필요'):'추가 보강 불필요'],['2방향 전단 · 무보강',`${status(pc.ok)} · 검토비 ${F(pc.ratio,3)}`]])+`<p class="beam-muted">${p.mode==='pile'?'파일캡 추가 검토 필요 · 아래 적용 범위를 확인하세요.':'표시된 항목에 대한 검토 결과입니다.'}</p>`;
   if(pl)el('summary').innerHTML+=dl([['자동 기초 크기 / 면적',`${F(p.bx)} × ${F(p.by)} mm / ${F(p.bx*p.by/1e6,3)} m²`],['파일 배치',`${p.nx} × ${p.ny} = ${p.nx*p.ny}본 · 중심 간격 ${p.gapFactor}D`],['파일 배치 간격',status(pl.ok)],['X / Y 중심 간격',`${F(p.sx)} / ${F(p.sy)} mm / 필요 2.5D = ${F(pl.spacingMin)} mm · ${status(pl.spacingXOK&&pl.spacingYOK)}`],['X / Y 가장자리 중심거리',`${F(pl.edgeX)} / ${F(pl.edgeY)} mm / 필요 1.25D = ${F(pl.edgeMin)} mm · ${status(pl.edgeXOK&&pl.edgeYOK)}`],['간격을 만족하는 기초 치수',`${F(pl.minBx)} × ${F(pl.minBy)} mm 이상 · 50 mm 단위`]])+'<p class="beam-muted">D는 파일 직경입니다. 최소 치수는 중심 간격을 2.5D 이상으로 조정한 배치를 기준으로 합니다. 간격 미충족 시 지지력·전단 충족과 별개로 배치를 수정해야 합니다.</p>' ;
   el('checks').innerHTML='<div style="overflow-x:auto"><table class="beam-table"><thead><tr><th>방향</th><th>하부 철근</th><th>Mu / φMn<br>(kN·m/m)</th><th>Vu / φVc · 무보강<br>(kN)</th><th>배근·연성</th></tr></thead><tbody>'+r.rows.map(v=>`<tr><td>${v.axis}</td><td>${v.bar}@${v.spacing}<br>As ${F(v.As)} mm²/m</td><td>${F(v.Mu)} / ${F(v.phiMn)}<br>${status(v.flexOK)}</td><td>${F(v.Vu)} / ${F(v.phiVc)}<br>${status(v.shearOK)}</td><td>${status(v.steelOK&&v.ductile)}<br>최소 As ${F(v.AsMin)}</td></tr>`).join('')+'</tbody></table></div>'+dl([['기둥 뚫림 위험둘레 b₀',F(pc.b0)+' mm'],['뚫림 전단력 Vu / φVc',`${F(pc.Vu)} / ${F(pc.phiVc)} kN`],['편심 포함 최대 vu / φvc',`${F(pc.vu,3)} / ${F(pc.phiV,3)} MPa`],['적용 철근비 ρ / 크기계수 ks',`${F(pc.rho,5)} / ${F(pc.ks,3)}`]])+'<p class="beam-muted">기둥면에서 d는 1방향 전단, d/2는 2방향 전단 위험단면입니다. 휨은 기둥면에서 검토합니다. 단변 방향 Mu에는 중앙대 배근 보정이 포함됩니다.</p>';
   el('basis').innerHTML=dl([['기초 자중',F(r.W)+' kN · 24 kN/m³'],['지지력용 총 축력',F(r.totalS)+' kN'],['계수 총 축력',F(r.totalU)+' kN · 자중계수 '+p.weightFactor],['자중 처리','반력에 가산 후, 휨·전단 산정에서 해당 구역 자중 차감']])+r.notes.map(v=>'<p class="beam-muted">'+v+'</p>').join('')+'<p class="beam-muted">기준: <a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2070" target="_blank" rel="noopener">KDS 14 20 70 §4.2</a> · <a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2022" target="_blank" rel="noopener">KDS 14 20 22 §4.11</a>. 전단 φ = 0.75. 뚫림 vc는 철근비·유효깊이·위험둘레 영향을 반영합니다.</p>';
   el('basis').innerHTML+='<p class="beam-muted">주황 점선은 기둥면 d/2의 전단력 검토선이며 보강 금지 영역이 아닙니다. 첫 열은 기둥면 d/2 이내, 다음 열 간격도 d/2 이내입니다(KDS 14 20 22 §4.11.3). 보강 시 보라 점선은 마지막 열에서 d/2 바깥의 무보강 검토선입니다.</p>';
   if(pl)el('basis').innerHTML+='<p class="beam-muted"><a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2011%2050%2015" target="_blank" rel="noopener">KDS 11 50 15 §4.1.5.2(2)</a>: 중심 간격 ≥ 2.5D, 기초측면~파일 중심 ≥ 1.25D. 시설물별 별도 기준은 추가 확인해야 합니다.</p>';
   const sc=300/Math.max(p.bx,p.by),x=v=>250+v*sc,y=v=>205-v*sc;
   let svg='<svg viewBox="0 0 720 480" style="width:100%;max-height:500px" role="img" aria-label="기초 평면 및 전단 위험단면"><text x="250" y="26" text-anchor="middle">기초 평면 · X → / Y ↑</text>';
   svg+=`<rect x="${x(-p.bx/2)}" y="${y(p.by/2)}" width="${p.bx*sc}" height="${p.by*sc}" fill="#eff4f8" stroke="#27679b"/><rect x="${x(-pc.px/2)}" y="${y(pc.py/2)}" width="${pc.px*sc}" height="${pc.py*sc}" fill="none" stroke="#b97626" stroke-width="2" stroke-dasharray="7 4"><title>뚫림 위험둘레 · 기둥면 d/2 · b₀ ${F(pc.b0)} mm</title></rect>`;
   if(pn.needed&&pn.ok){const o=pn.outer;svg+=`<rect x="${x(-o.bx/2)}" y="${y(o.by/2)}" width="${o.bx*sc}" height="${o.by*sc}" fill="none" stroke="#704ba0" stroke-width="2" stroke-dasharray="3 5"><title>최외곽 보강근에서 d/2 · 무보강 전단 검토선</title></rect><text x="470" y="355" font-size="12" fill="#704ba0">보라 점선: 보강 외곽 검토선</text>`;}
   if(pl){
    const lx=-(p.nx-1)*p.sx/2,ly=-(p.ny-1)*p.sy/2;
    const dim=(a,b,yy,label,color)=>`<path d="M${x(a)} ${yy-5}V${yy+5}M${x(a)} ${yy}H${x(b)}M${x(b)} ${yy-5}V${yy+5}" stroke="${color}"/><text x="${(x(a)+x(b))/2}" y="${yy+17}" text-anchor="middle" font-size="11" fill="${color}">${label}</text>`;
    svg+=dim(lx,lx+p.sx,390,`sX ${F(p.sx)} / ${F(pl.spacingMin)} (2.5D)`,pl.spacingXOK?'#168777':'#b23c31');
    svg+=dim(-p.bx/2,lx,428,`eX ${F(pl.edgeX)} / ${F(pl.edgeMin)} (1.25D)`,pl.edgeXOK?'#168777':'#b23c31');
    svg+=`<text x="470" y="385" font-size="12" fill="${pl.spacingYOK?'#168777':'#b23c31'}">sY ${F(p.sy)} / ${F(pl.spacingMin)} mm (2.5D)</text><text x="470" y="410" font-size="12" fill="${pl.edgeYOK?'#168777':'#b23c31'}">eY ${F(pl.edgeY)} / ${F(pl.edgeMin)} mm (1.25D)</text>`;
   }
   for(const v of r.piles)svg+=`<circle data-pile="${v.id}" tabindex="0" role="button" aria-label="파일 ${v.id} 반력" cx="${x(v.x*1000)}" cy="${y(v.y*1000)}" r="${p.diameter*sc/2}" fill="#d2e9e4" stroke="#168777"><title>파일 ${v.id}: 사용 ${F(v.Rs)} kN / 계수 ${F(v.Ru)} kN</title></circle><text pointer-events="none" x="${x(v.x*1000)}" y="${y(v.y*1000)+4}" text-anchor="middle" font-size="12">${v.id}</text>`;
   for(const pt of sr.points)svg+=`<circle cx="${x(pt.x)}" cy="${y(pt.y)}" r="2.4" fill="${pt.type==='P'?'#c55f22':pt.type==='X'?'#704ba0':'#198ba0'}"><title>${pt.label} · ${sr.bar}</title></circle>`;
   svg+=`<rect x="${x(-p.cx/2)}" y="${y(p.cy/2)}" width="${p.cx*sc}" height="${p.cy*sc}" fill="#27679b"><title>중앙 기둥 ${p.cx} × ${p.cy} mm</title></rect><text x="250" y="463" text-anchor="middle">${p.bx} × ${p.by} × ${p.h} mm</text><text x="470" y="120">청색: 기둥 / 기초</text><text x="470" y="151" fill="#b97626">주황 점선: 기둥면 d/2 검토선</text><text x="470" y="182" fill="#168777">${p.mode==='pile'?'녹색: 파일 · 클릭하여 반력 확인':'지반 반력: 전면 선형 분포'}</text><text x="470" y="230">X 하부 ${p.barX}@${p.spacingX}</text><text x="470" y="260">Y 하부 ${p.barY}@${p.spacingY}</text><text x="470" y="300" font-size="12">보라: X 보강 / 청록: Y 보강</text><text x="470" y="325" font-size="12">주황 점: 뚫림 전단 보강 다리</text></svg>`;
   el('plot').innerHTML=svg;
   el('selection').textContent=p.mode==='pile'?'파일을 클릭하면 해당 파일의 반력이 표시됩니다.':'기초 모서리의 최대·최소 사용 접지압: '+F(b.max)+' / '+F(b.min)+' kPa';
   el('plot').onclick=e=>{const t=e.target.closest('[data-pile]');if(!t)return;const v=r.piles.find(v=>v.id===Number(t.getAttribute('data-pile')));if(v)el('selection').textContent=`파일 ${v.id} · X ${F(v.x*1000)} / Y ${F(v.y*1000)} mm · 사용 ${F(v.Rs)} kN / 계수 ${F(v.Ru)} kN`;};
   el('plot').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el('plot').onclick(e);}};
  }catch(e){el('error').hidden=false;el('error').textContent=e.message;el('results').hidden=true;for(const k of ['summary','plot','checks','basis','reinforcement'])el(k).innerHTML='';}
 }
 for(const k of [...keys,'fckCustom'])el(k).addEventListener('input',update);
 update();
}
})();
