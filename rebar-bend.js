/* KDS 14 20 50, 4.1.1 and 4.1.2, verified against official equation images. */
(function(root){
'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./rebar-spec'):root.RebarSpec;
const types={main90:['주철근 · 90°',90,false],main180:['주철근 · 180°',180,false],stirrup90:['스터럽·띠철근 · 90°',90,true],stirrup135:['스터럽·띠철근 · 135°',135,true]};
function calculate(name,type){
 const b=S.find(name),t=types[type];if(!b||!t)throw Error('철근 호칭과 갈고리 형식을 선택하세요.');
 const n=Number(name.slice(1)),d=b.diameter;
 if(!t[2]&&n<10)return {supported:false,reason:'주철근 표준갈고리의 표 4.1-1은 D10부터 규정합니다. 이 호칭은 별도 상세 확인이 필요합니다.'};
 if(t[2]&&n>25)return {supported:false,reason:'스터럽·띠철근의 표준갈고리 연장 규정은 D25 이하입니다. 이 호칭은 별도 상세 확인이 필요합니다.'};
 const factor=t[2]&&n<=16?2:n<=25?3:n<=35?4:5;
 const extension=t[2]?(t[1]===90&&n>=19?12:6)*d:t[1]===90?12*d:Math.max(4*d,60);
 const rule=t[2]?(t[1]===90&&n>=19?'12db':'6db'):t[1]===90?'12db':'max(4db, 60 mm)';
 return {supported:true,name,type,label:t[0],angle:t[1],d,factor,radius:factor*d,diameter:2*factor*d,extension,rule};
}
root.RebarBend={calculate,types};if(typeof module!=='undefined'&&module.exports)module.exports=root.RebarBend;
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),f=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});
function diagram(o){
 const scale=Math.min(220/(2*o.radius+o.d+o.extension),90/(o.radius+o.d/2));
 const r=(o.radius+o.d/2)*scale,w=o.d*scale,L=o.extension*scale,cx=270,cy=65+r;
 const a=(o.angle-90)*Math.PI/180,ex=cx+r*Math.cos(a),ey=cy+r*Math.sin(a),tx=-Math.sin(a),ty=Math.cos(a),fx=ex+L*tx,fy=ey+L*ty;
 const nx=ty,ny=-tx,offset=24+w/2;
 return `<svg viewBox="0 0 640 360" style="display:block;width:100%;max-width:720px;margin:auto" role="img" aria-label="${o.label}, 최소 내면 반지름 ${f(o.radius)} mm, 직선 연장 ${f(o.extension)} mm"><path d="M70 65H270 A${r} ${r} 0 0 1 ${ex} ${ey} L${fx} ${fy}" fill="none" stroke="#246496" stroke-width="${w}" stroke-linecap="butt"/><path d="M${cx} ${cy}V${65+w/2}" stroke="#c07618" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="${cx}" cy="${cy}" r="3" fill="#c07618"/><text x="${cx-12}" y="${cy-8}" text-anchor="end" font-size="14" fill="#98600d">ri = ${f(o.radius)}</text><path d="M${ex} ${ey}l${nx*offset} ${ny*offset} M${fx} ${fy}l${nx*offset} ${ny*offset} M${ex+nx*offset} ${ey+ny*offset}L${fx+nx*offset} ${fy+ny*offset}" fill="none" stroke="#555" stroke-width="1"/><text x="${(ex+fx)/2+nx*(offset+18)}" y="${(ey+fy)/2+ny*(offset+18)}" text-anchor="middle" font-size="14" fill="#333">le = ${f(o.extension)}</text><text x="70" y="35" fill="#246496" font-size="16">${o.name} · ${o.angle}°</text><text x="320" y="325" text-anchor="middle" fill="#666" font-size="13">ri: 굽힘 내면 반지름 · le: 곡선 끝부터 직선 연장길이 (mm)</text><text x="320" y="347" text-anchor="middle" fill="#666" font-size="12">형상 설명용 · 입구 직선부 길이는 임의이며 절단길이를 뜻하지 않습니다.</text></svg>`;
}
function update(){
 const o=calculate($('rs_bar').value,$('rs_bend_type').value);
 if(!o.supported){$('rs_bend_summary').innerHTML=`<p class="warn">${o.reason}</p>`;$('rs_bend_diagram').innerHTML='';return;}
 $('rs_bend_summary').innerHTML=`<p class="beam-layout">${o.name} · ${o.label}</p><dl class="beam-values">${[['공칭지름 db',f(o.d)+' mm'],['최소 내면 반지름 ri',`${o.factor}db = ${f(o.radius)} mm`],['최소 내면지름 Di',`${2*o.factor}db = ${f(o.diameter)} mm`],['최소 직선 연장 le',`${o.rule} = ${f(o.extension)} mm`]].map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`;
 $('rs_bend_diagram').innerHTML=diagram(o);
}
$('rs_bar').addEventListener('change',update);$('rs_bend_type').addEventListener('change',update);
$('rs_table').addEventListener('click',e=>{if(e.target.closest('[data-rebar]'))update();});
update();
})(globalThis);
