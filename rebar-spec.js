/* KS D 3504:2025, table 4. Transcribed from the official notice, 2025-06-02.
 * Dimensions mm, area mm², mass kg/m. Published nominal values, not πd²/4 recomputation.
 */
(function(root){
'use strict';
const rows=[
 ['D4',4.23,14.05,.110,13.3,3.0,.2,.4,3.3],
 ['D5',5.29,21.98,.173,16.6,3.7,.2,.4,4.2],
 ['D6',6.35,31.67,.249,20.0,4.4,.3,.6,5.0],
 ['D7',7.00,38.48,.302,22.0,4.9,.3,.6,5.5],
 ['D8',7.94,49.51,.389,24.9,5.6,.3,.6,6.3],
 ['D10',9.53,71.33,.560,29.9,6.7,.4,.8,7.5],
 ['D13',12.7,126.7,.995,39.9,8.9,.5,1.0,10.0],
 ['D16',15.9,198.6,1.56,50.0,11.1,.7,1.4,12.5],
 ['D19',19.1,286.5,2.25,60.0,13.4,1.0,2.0,15.0],
 ['D22',22.2,387.1,3.04,69.8,15.5,1.1,2.2,17.5],
 ['D25',25.4,506.7,3.98,79.8,17.8,1.3,2.6,20.0],
 ['D29',28.6,642.4,5.04,89.9,20.0,1.4,2.8,22.5],
 ['D32',31.8,794.2,6.23,99.9,22.3,1.6,3.2,25.0],
 ['D35',34.9,956.6,7.51,109.7,24.4,1.7,3.4,27.5],
 ['D38',38.1,1140,8.95,119.7,26.7,1.9,3.8,30.0],
 ['D41',41.3,1340,10.5,129.8,28.9,2.1,4.2,32.5],
 ['D43',43.0,1452,11.4,135.1,30.1,2.2,4.4,33.8],
 ['D51',50.8,2027,15.9,159.6,35.6,2.5,5.0,40.0],
 ['D57',57.3,2579,20.2,180.0,40.1,2.9,5.8,45.0]
];
const bars=rows.map(([name,diameter,area,mass,circumference,ribSpacing,ribMin,ribMax,ribGap])=>Object.freeze({name,diameter,area,mass,circumference,ribSpacing,ribMin,ribMax,ribGap}));
const api=Object.freeze({bars:Object.freeze(bars),find:name=>bars.find(b=>b.name===name)});
root.RebarSpec=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
const $=id=>document.getElementById('rs_'+id),f=(n,d=2)=>n.toLocaleString('ko-KR',{maximumFractionDigits:d});
$('bar').innerHTML=bars.map(b=>`<option value="${b.name}">${b.name} · ${f(b.diameter)} mm</option>`).join('');$('bar').value='D25';
function update(){
 const b=api.find($('bar').value);if(!b)return;
 $('summary').innerHTML=`<p class="beam-layout">${b.name} · 이형 봉강</p><p class="beam-capacity">${f(b.diameter)} <small>mm · 공칭지름</small></p><dl class="beam-values"><div><dt>공칭 단면적</dt><dd>${f(b.area)} mm²</dd></div><div><dt>단위중량</dt><dd>${f(b.mass,3)} kg/m</dd></div><div><dt>공칭 둘레</dt><dd>${f(b.circumference,1)} mm</dd></div></dl>`;
 const radius=b.diameter*2;
 $('diagram').innerHTML=`<svg style="display:block;width:100%;max-width:580px;max-height:280px;margin:auto" viewBox="0 0 580 280" role="img" aria-label="${b.name} 공칭지름 ${b.diameter} mm를 원으로 표시"><circle cx="290" cy="135" r="${radius}" fill="#e3edf6" stroke="#246496" stroke-width="2"/><path d="M${290-radius} 135H${290+radius}" stroke="#246496" stroke-width="1.5"/><path d="M${290-radius+6} 131l-6 4 6 4M${290+radius-6} 131l6 4-6 4" fill="none" stroke="#246496"/><text x="290" y="${Math.max(18,125-radius)}" text-anchor="middle" fill="#246496" font-size="16">${b.name} · d = ${f(b.diameter)} mm</text><text x="290" y="270" text-anchor="middle" fill="#666" font-size="13">공칭지름 비교용 원 · 리브를 포함한 실제 외형이 아닙니다.</text></svg>`;
 $('rib').innerHTML=`<table class="beam-table"><tbody>${[['횡방향 리브 평균간격 최대',b.ribSpacing],['횡방향 리브 평균높이 최소',b.ribMin],['횡방향 리브 평균높이 최대',b.ribMax],['횡방향 리브 틈 합계 최대',b.ribGap]].map(([label,n])=>`<tr><th scope="row">${label}</th><td>${n.toFixed(1)} mm</td></tr>`).join('')}<tr><th scope="row">횡방향 리브와 축선의 각도</th><td>45° 이상</td></tr></tbody></table>`;
 $('table').innerHTML=`<table class="beam-table"><caption class="beam-muted" style="text-align:left;padding-bottom:12px">KS D 3504:2025 표 4 · 호칭을 클릭하면 상세 규격을 확인할 수 있습니다.</caption><thead><tr><th scope="col">호칭</th><th scope="col">공칭지름<br>mm</th><th scope="col">공칭 단면적<br>mm²</th><th scope="col">공칭 둘레<br>mm</th><th scope="col">단위중량<br>kg/m</th></tr></thead><tbody>${bars.map(r=>`<tr${r.name===b.name?' class="selected" style="background:#edf5fc"':''}><th scope="row"><span class="rs-print-name">${r.name}</span><button type="button" class="beam-view" data-rebar="${r.name}" aria-pressed="${r.name===b.name}">${r.name}</button></th><td>${f(r.diameter)}</td><td>${f(r.area)}</td><td>${r.circumference.toFixed(1)}</td><td>${f(r.mass,3)}</td></tr>`).join('')}</tbody></table>`;
}
$('bar').addEventListener('change',update);
$('table').addEventListener('click',e=>{const b=e.target.closest('[data-rebar]');if(b){$('bar').value=b.dataset.rebar;update();$('bar').focus();}});
update();
})(globalThis);
