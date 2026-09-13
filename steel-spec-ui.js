(function(){
'use strict';
const api=globalThis.SteelSpec,f=(n,d=3)=>n.toLocaleString('ko-KR',{maximumFractionDigits:d});
function diagram(r){
 const s=210/Math.max(r.H,r.B),w=r.B*s,h=r.H*s,x=260-w/2,y=155-h/2;
 const rect=(a,b,c,d,extra='')=>`<rect x="${a}" y="${b}" width="${c}" height="${d}" ${extra}/>`;
 let shape='';
 if(r.kind==='PIPE')shape=`<circle cx="260" cy="155" r="${w/2}"/><circle cx="260" cy="155" r="${w/2-r.t*s}" fill="white"/>`;
 if(r.kind==='BOX')shape=rect(x,y,w,h,`rx="${Math.min(2*r.t*s,w/4,h/4)}"`)+rect(x+r.t*s,y+r.t*s,w-2*r.t*s,h-2*r.t*s,`rx="${Math.min(r.t*s,w/8,h/8)}" fill="white"`);
 if(r.kind==='L'){
  const t=r.t*s,rr=r.r*s;
  shape=`<path d="M${x} ${y}h${t}v${h-t-rr}a${rr} ${rr} 0 0 0 ${rr} ${rr}h${w-t-rr}v${t}H${x}Z"/>`;
 }
 if(r.kind==='H'){
  const t=r.tf*s,tw=r.tw*s,rr=r.r*s,a=260-tw/2,b=260+tw/2,top=y+t,bot=y+h-t;
  shape=`<path d="M${x} ${y}H${x+w}V${top}H${b+rr}a${rr} ${rr} 0 0 0 ${-rr} ${rr}V${bot-rr}a${rr} ${rr} 0 0 0 ${rr} ${rr}H${x+w}V${y+h}H${x}V${bot}H${a-rr}a${rr} ${rr} 0 0 0 ${rr} ${-rr}V${top+rr}a${rr} ${rr} 0 0 0 ${-rr} ${-rr}H${x}Z"/>`;
 }
 return `<svg style="display:block;width:100%;max-width:620px;max-height:350px;margin:auto" viewBox="0 0 520 330" role="img" aria-label="${r.name} 단면도, 치수 단위 mm"><g fill="#dcebf7" stroke="#246496" stroke-width="1.4">${shape}</g><g stroke="#777" fill="none"><path d="M${x} ${y-10}V${y-27}M${x+w} ${y-10}V${y-27}M${x} ${y-21}H${x+w}M${x-10} ${y}H${x-27}M${x-10} ${y+h}H${x-27}M${x-21} ${y}V${y+h}"/></g><g fill="#444" font-size="14" text-anchor="middle"><text x="260" y="${y-29}">${r.kind==='PIPE'?'D':'B'} = ${f(r.B)} mm</text><text transform="translate(${x-31} 155) rotate(-90)">${r.kind==='PIPE'?'D':'H'} = ${f(r.H)} mm</text><text x="260" y="${Math.min(294,y+h+28)}">${r.kind==='H'?`tw ${r.tw} · tf ${r.tf} · r ${r.r}`:`t ${r.t}${r.kind==='L'?' · r₁ '+r.r+' · r₂ '+r.r2:''}`} mm</text></g><g stroke="#879aaa" fill="none"><path d="M430 280h45m-5-4 5 4-5 4M430 280v-45m-4 5 4-5 4 5"/></g><g fill="#667" font-size="13"><text x="481" y="284">x</text><text x="426" y="226">y</text></g></svg>`;
}
for(const kind of ['H','PIPE','BOX','L']){
 const prefix='ss_'+kind.toLowerCase()+'_',$=id=>document.getElementById(prefix+id),rows=api.catalogs[kind],std=api.standards[kind];
 const defaults={H:'H 400 × 200 × 8 × 13',PIPE:'PIPE 216.3 × 6',BOX:'BOX 200 × 200 × 9',L:'L 100 × 100 × 10'};
 let selected=rows.find(r=>r.name===defaults[kind])||rows[0];
 function filtered(){const q=$('search').value.trim().toLowerCase().replace(/[×xX*\s]/g,'');return rows.filter(r=>{
  const type=$('type').value;
  return (!type||(type==='equal'?r.H===r.B:r.H!==r.B))&&r.name.toLowerCase().replace(/[×xX*\s]/g,'').includes(q);
 });}
 function updateOptions(){
  const list=filtered();$('section').innerHTML=list.map(r=>`<option value="${r.id}">${r.name}${r.issue?' · 원문 확인 필요':''}</option>`).join('');
  if(list.length&&!list.includes(selected))selected=list[0];
  $('section').value=selected.id;$('section').disabled=!list.length;render();
 }
 function render(){
  const list=filtered(),r=selected;
  $('count').textContent=`전체 ${rows.length}개 · 검색 결과 ${list.length}개`;
  $('summary').innerHTML=`<p class="beam-layout">${r.name}</p><p class="beam-capacity">${f(r.mass)} <small>kg/m · 단위중량${r.calculated?' (계산값)':''}</small></p>${r.issue?`<p class="steel-spec-issue">${r.issue}</p>`:''}<dl class="beam-values"><div><dt>단면적 A</dt><dd>${f(r.A)} cm²</dd></div><div><dt>단면 2차 모멘트 Ix</dt><dd>${f(r.Ix)} cm⁴</dd></div><div><dt>단면 2차 모멘트 Iy</dt><dd>${f(r.Iy)} cm⁴</dd></div><div><dt>단면 2차 반지름 ix · iy (계산값)</dt><dd>${f(Math.sqrt(r.Ix/r.A))} · ${f(Math.sqrt(r.Iy/r.A))} cm</dd></div>${kind==='H'?`<div><dt>웨브 · 플랜지 두께 tw · tf</dt><dd>${r.tw} · ${r.tf} mm</dd></div><div><dt>필릿 반지름 r</dt><dd>${r.r} mm</dd></div>`:`<div><dt>두께 t</dt><dd>${r.t} mm</dd></div>`}</dl>`;
  $('diagram').innerHTML=diagram(r);
  $('table').innerHTML=list.length?`<table class="beam-table"><caption class="beam-muted" style="text-align:left;padding:0 0 12px">${std[0]} · ${std[2]} · 규격을 클릭하면 상세 정보가 바뀝니다.</caption><thead><tr><th scope="col">규격 (mm)</th><th scope="col">A<br>cm²</th><th scope="col">단위중량<br>kg/m</th><th scope="col">Ix<br>cm⁴</th><th scope="col">Iy<br>cm⁴</th></tr></thead><tbody>${list.map(b=>`<tr${b===r?' style="background:#edf5fc"':''}><th scope="row"><span class="rs-print-name">${b.name}${b.issue?' ※':''}</span><button type="button" class="beam-view" data-steel-spec="${b.id}" aria-pressed="${b===r}">${b.name}${b.issue?' ※':''}</button></th><td>${f(b.A)}</td><td>${f(b.mass)}</td><td>${f(b.Ix)}</td><td>${f(b.Iy)}</td></tr>`).join('')}</tbody></table>`:'<p class="beam-muted">해당하는 규격이 없습니다. 검색어 또는 형상 필터를 변경해주세요.</p>';
 }
 $('search').addEventListener('input',updateOptions);$('type').addEventListener('change',updateOptions);
 $('section').addEventListener('change',()=>{selected=api.find(kind,$('section').value)||selected;render();});
 $('table').addEventListener('click',event=>{const b=event.target.closest('[data-steel-spec]');if(b){selected=api.find(kind,b.dataset.steelSpec)||selected;$('section').value=selected.id;render();}});
 updateOptions();
}
})();
