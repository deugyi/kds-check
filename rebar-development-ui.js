(function(){'use strict';
const E=RebarDevelopment,$=k=>document.getElementById('rd_'+k),f=(v,d=2)=>v.toLocaleString('ko-KR',{maximumFractionDigits:d});
const labels={tension:'인장 · 직선 정착',compression:'압축 · 직선 정착',hook90:'인장 · 90° 표준갈고리',hook180:'인장 · 180° 표준갈고리'};
$('bar').innerHTML=E.bars.map(b=>`<option value="${b.name}">${b.name}</option>`).join('');$('bar').value='D25';
const numeric=['fck','fy','lambda','cover','clear','Atr','s','n','hookSide','hookTail','hookSpacing','hookFirst'];
function num(k){if($(k).value.trim()==='')throw Error('입력값을 모두 입력하세요.');return Number($(k).value);}
function inputs(){const type=$('type').value,p={type,bar:$('bar').value,fck:num('fck'),fy:num('fy'),lambda:num('lambda'),epoxy:$('epoxy').value==='yes',available:$('available').value.trim()===''?null:num('available')};
 if(type==='tension'){Object.assign(p,{top:$('top').value==='yes',cover:num('cover'),clear:num('clear'),ties:$('ties').value==='yes'});if(p.ties)for(const k of ['Atr','s','n'])p[k]=num(k);}
 if(type==='compression')p.compressionConfined=$('compressionConfined').value==='yes';
 if(type.startsWith('hook')){Object.assign(p,{hookSide:num('hookSide'),hookTail:type==='hook90'?num('hookTail'):0,hookTie:$('hookTie').value,hookEndRequired:$('hookEndRequired').value==='yes'});if(p.hookTie!=='none'){p.hookSpacing=num('hookSpacing');p.hookFirst=num('hookFirst');}}
 return p;
}
function diagram(r){const ld=r.suggested,db=r.db,h=r.hook,scale=Math.min(430/Math.max(ld,r.p.available||0),h?175/(h.radius+db+(h.angle===90?h.extension:h.radius+db)):2),x=140,end=x+ld*scale,y=h?100:155,w=Math.max(3,db*scale),ri=h?h.radius*scale:0,rc=h?(h.radius+db/2)*scale:0,curve=h?end-(h.radius+db)*scale:end;
 const path=!h?`M45 ${y}H${end}`:h.angle===90?`M45 ${y}H${curve}A${rc} ${rc} 0 0 1 ${curve+rc} ${y+rc}V${y+rc+h.extension*scale}`:`M45 ${y}H${curve}A${rc} ${rc} 0 0 1 ${curve} ${y+2*rc}H${curve-h.extension*scale}`;
 return `<svg viewBox="0 0 720 360" role="img" aria-label="${labels[r.p.type]}, 위험단면부터 제안 정착길이 ${ld} mm"><rect x="${x}" y="68" width="${Math.max(100,end-x+36)}" height="228" rx="4" fill="#eef4fa"/><path d="${path}" fill="none" stroke="#246496" stroke-width="${w}"/><path d="M${x} 60V305" stroke="#555" stroke-dasharray="5 4"/><text x="${x-12}" y="328" text-anchor="end" fill="#555" font-size="14">위험단면</text><path d="M${x} 38V62M${end} 38V62M${x} 48H${end}" stroke="#246496"/><text x="${(x+end)/2}" y="30" text-anchor="middle" font-size="16" fill="#246496">${h?'ldh':'ld'} = ${f(ld,0)} mm · 제안 길이</text>${r.p.available===null?'':`<path d="M${x+r.p.available*scale} 65V295" stroke="#bd6b14" stroke-dasharray="4 4"/><text x="400" y="348" text-anchor="middle" fill="#98600d" font-size="13">주황 점선: 확보 길이 ${f(r.p.available)} mm</text>`}${h?`<text x="350" y="325" text-anchor="middle" fill="#555" font-size="13">ri = ${f(h.radius)} mm · 끝 연장 le = ${f(h.extension)} mm</text>`:''}</svg>`;
}
function update(){const type=$('type').value,hook=type.startsWith('hook');$('tension').hidden=type!=='tension';$('compression').hidden=type!=='compression';$('hook').hidden=!hook;$('top_wrap').hidden=type!=='tension';$('epoxy_wrap').hidden=type==='compression';$('ties_fields').hidden=$('ties').value!=='yes';$('hookTail_wrap').hidden=type!=='hook90';$('hook_ties_fields').hidden=$('hookTie').value==='none';
 try{const p=inputs(),r=E.calculate(p);$('error').hidden=true;$('results').hidden=false;
  $('summary').innerHTML=`<p class="beam-layout">${p.bar} · ${labels[p.type]}</p><p class="beam-capacity">${f(r.required,1)} <small>mm · 소요 정착길이</small></p><p>10 mm 단위 올림 제안: <b>${f(r.suggested,0)} mm</b> · ${f(r.required/r.db,2)}db</p><p class="${r.ok?'ok':'ng'}">${!r.detailingOK?'정착 상세조건 미충족':r.lengthOK===null?'소요 길이 산정 완료 · 확보 길이 미입력':r.lengthOK?'입력한 확보 길이 충족':'확보 길이 부족'}${p.available===null?'':` · ${f(p.available)} / ${f(r.required,1)} mm`}</p>`;
  $('diagram').innerHTML=diagram(r);
  const rows=[['공칭지름 db',`${f(r.db)} mm`],['재료 강도',`fck ${f(p.fck)} / fy ${f(p.fy)} MPa`],['경량콘크리트계수 λ',f(p.lambda)],['적용 √fck',f(r.sqrt,4)]];
  if(p.type==='tension')rows.push(['위치계수 α / 도막계수 β',`${f(r.factors.alpha)} / ${f(r.factors.beta)}`],['αβ (최대 1.7) / 크기계수 γ',`${f(r.factors.alphaBeta)} / ${f(r.factors.gamma)}`],['c = min(순피복 + db/2, 중심간격/2)',`${f(r.c)} mm`],['Ktr = 40 Atr / (s n)',`${f(r.Ktr)} mm`],['(c + Ktr) / db (최대 2.5)',f(r.confinement,4)]);
  if(hook)rows.push(['도막계수 β',f(r.factors.beta)],['측면피복 보정 / 횡구속 보정',`${f(r.factors.cover)} / ${f(r.factors.confinement)}`]);
  if(p.type==='compression')rows.push(['압축 횡구속 보정',f(r.factors.confinement)]);
  rows.push(['최솟값 적용 전',`${f(r.adjusted)} mm`],['최소 정착길이',`${f(r.minimum)} mm`],['최종 소요 길이 = max(계산값, 최솟값)',`${f(r.required)} mm`]);
  $('calculation').innerHTML=`<p>${r.clause}</p><p class="rd-formula">${r.formula}</p>${hook?'<p>ldh = max(lhb × 피복 보정 × 횡구속 보정, 8db, 150 mm)</p>':p.type==='compression'?'<p>ld = max(ldb × 횡구속 보정, 200 mm)</p>':'<p>ld ≥ 300 mm · Ktr = 40 Atr / (s n)</p>'}<dl class="beam-values">${rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`;
  $('checks').innerHTML=(r.checks.length?r.checks.map(c=>`<p class="${c.pass?'ok':'ng'}"><b>${c.pass?'충족':'미충족'} · ${c.name}</b><br>${c.detail.replace(/\d+\.\d{5,}/g,v=>f(Number(v),4))}</p>`).join(''):'<p>이 입력조건에 추가 고강도철근·갈고리 횡구속 검사항목은 없습니다.</p>')+r.notes.map(n=>`<p class="beam-muted">${n}</p>`).join('');
  $('rows').innerHTML=E.bars.map(b=>{const q=E.calculate({...p,bar:b.name});return `<tr${p.bar===b.name?' class="selected"':''}><th scope="row"><button type="button" class="beam-view" data-anchbar="${b.name}" aria-pressed="${p.bar===b.name}">${b.name}</button></th><td>${f(b.diameter)}</td><td>${f(q.required,1)}</td><td>${f(q.suggested,0)}</td><td>${!q.detailingOK?'상세조건 미충족':q.lengthOK===null?'길이 미입력':q.lengthOK?'충족':'길이 부족'}</td></tr>`;}).join('');
 }catch(e){$('error').textContent=e.message;$('error').hidden=false;$('results').hidden=true;$('summary').innerHTML='';}
}
for(const k of [...numeric,'available'])$(k).addEventListener('input',update);
for(const k of ['type','bar','fy','top','epoxy','ties','compressionConfined','hookTie','hookEndRequired'])$(k).addEventListener('change',update);
$('rows').addEventListener('click',e=>{const button=e.target.closest('[data-anchbar]');if(button){$('bar').value=button.dataset.anchbar;update();}});
update();
})();
