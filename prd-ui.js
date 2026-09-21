(function(){
'use strict';
if(!document.createElementNS)return;
const $=id=>document.getElementById(id),P=globalThis.PRD,Z=globalThis.PRDZones,NS='http://www.w3.org/2000/svg',STORE='kds-prd-v1';
let data=null,selected=null,view=null,full=null,drag=null,dirty=false,baseDrawing=null,zoneData=null,activeZone='';
const map=$('prd-map'),group=$('prd-geometry'),labels=$('prd-labels'),zoneShapes=$('prd-zone-shapes'),zoneLabels=$('prd-zone-labels');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=p=>p.number.join(' / ')||'번호 미연결 · '+p.key;
const message=(s,error=false)=>{$('prd-feedback').textContent=s;$('prd-feedback').classList.toggle('prd-error',error);};
function svg(name,attrs,parent){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));parent.appendChild(n);return n;}
function stage(p){return P.stages.find(s=>s[0]===P.status(data.records[p.key]));}
function persist(){try{localStorage.setItem(STORE+'-'+data.id,JSON.stringify(data));return true;}catch{message('이 브라우저에 저장하지 못했습니다. 백업 저장으로 기록을 내려받으세요.',true);return false;}}
function viewbox(){map.setAttribute('viewBox',view.join(' '));labels.style.display=$('prd-show-labels').checked&&view[2]<full[2]*.48?'':'none';for(const t of zoneLabels.querySelectorAll('text'))t.setAttribute('font-size',view[2]/65);}
function fit(){if(full){view=[...full];viewbox();}}
function zoom(factor,point){if(!view)return;const nw=Math.max(full[2]/35,Math.min(full[2]*1.3,view[2]*factor)),ratio=nw/view[2];point=point||[view[0]+view[2]/2,view[1]+view[3]/2];view=[point[0]-(point[0]-view[0])*ratio,point[1]-(point[1]-view[1])*ratio,nw,view[3]*ratio];viewbox();}
function saveForm(silent=false){
 if(!selected||!dirty)return true;
 try{const r=P.record({drilled:$('prd-drilled').value,delivered:$('prd-delivered').value,installed:$('prd-installed').value,note:$('prd-note').value});data.records[selected]=r;dirty=false;const ok=persist();renderStatus();if(ok&&!silent)message('저장했습니다. 이 브라우저에 보관됩니다.');return true;}catch(e){message(e.message,true);return false;}
}
function select(key,focus=false){
 if(!saveForm(true))return;
 selected=key;const p=data.drawing.piles.find(p=>p.key===key),r=data.records[key]||{};
 if(activeZone&&zoneData.membership[key]!==activeZone)activeZone=zoneData.membership[key];
 $('prd-selection-empty').hidden=true;$('prd-form').hidden=false;$('prd-selected-title').textContent=title(p);
 $('prd-info').innerHTML=[['공구',zoneData.membership[p.key]==='unassigned'?'미분류':zoneData.membership[p.key]],['객체 번호',p.key],['부재명',p.name.join(' / ')||'—'],['타입',p.type.join(' / ')||'—'],['반력 원문',p.reaction.join(' / ')||'—'],['공경 레이어',p.layer],['도면 원 지름',Math.round(p.radius*2).toLocaleString()+' mm']].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
 $('prd-selected-warning').textContent=p.warnings.join(' · ');$('prd-selected-warning').hidden=!p.warnings.length;
 for(const k of ['drilled','delivered','installed','note'])$('prd-'+k).value=r[k]||'';
 if(focus){const width=full[2]/6;view=[p.x-width/2,-p.y-width*.65/2,width,width*.65];viewbox();}
 renderStatus();
}
function inZone(p){return !activeZone||zoneData.membership[p.key]===activeZone;}
function visible(p){const q=$('prd-search').value.trim().toLowerCase(),f=$('prd-filter').value;return inZone(p)&&(!q||[title(p),...p.name,...p.type,p.key].join(' ').toLowerCase().includes(q))&&(!f||(f==='issues'?p.warnings.length:P.status(data.records[p.key])===f));}
function renderStatus(){
 if(!data)return;
 const counts=Object.fromEntries(P.stages.map(s=>[s[0],0]));let shown=0;
 for(const p of data.drawing.piles){const n=document.getElementById('prd-p-'+p.key),v=visible(p),s=stage(p);if(inZone(p))counts[s[0]]++;shown+=v?1:0;n.setAttribute('fill',s[2]);n.setAttribute('opacity',v?1:.12);n.setAttribute('aria-label',title(p)+' · '+s[1]+(p.warnings.length?' · 확인 필요':''));n.classList.toggle('prd-selected',p.key===selected);n.querySelector('title').textContent=title(p)+' · '+s[1];}
 $('prd-stats').innerHTML=P.stages.map(([key,name,color])=>`<span class="prd-stat"><i class="prd-dot" style="background:${color}"></i>${name} <strong>${counts[key]}</strong></span>`).join('');
 $('prd-count').textContent=`${activeZone?(activeZone==='unassigned'?'미분류':activeZone)+' 공구':'전체'} ${data.drawing.piles.filter(inZone).length}공 · 검색/필터 ${shown}공`;
 $('prd-list').innerHTML=data.drawing.piles.filter(visible).map(p=>`<button type="button" data-key="${esc(p.key)}" aria-pressed="${p.key===selected}"><i class="prd-dot" style="background:${stage(p)[2]}"></i>${esc(title(p))}${p.warnings.length?' ⚠':''}</button>`).join('')||'<p class="prd-muted">검색 결과가 없습니다.</p>';
 if(selected){const p=data.drawing.piles.find(p=>p.key===selected);$('prd-current-status').textContent=stage(p)[1];}
 renderZoneDetails();
}
function selectZone(id){
 if(!saveForm(true))return;
 activeZone=id;selected=null;$('prd-form').hidden=true;$('prd-selection-empty').hidden=false;
 $('prd-selection-empty').textContent=id?(id==='unassigned'?'미분류':id)+' 공구의 공을 선택하면 날짜를 입력할 수 있습니다.':'도면 또는 목록에서 공을 선택하세요.';
 $('prd-search').value='';$('prd-filter').value='';
 const z=zoneData.zones.find(z=>z.id===id);
 if(z){const xs=z.points.map(p=>p[0]),ys=z.points.map(p=>-p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.max(w,h)*.08;view=[x-pad,y-pad,w+2*pad,h+2*pad];viewbox();}else fit();
 renderStatus();
}
function renderZoneDetails(){
 const members=data.drawing.piles.filter(inZone),info=Z.summary(members,data.records,P.status),name=activeZone==='unassigned'?'미분류':activeZone;
 $('prd-zone-title').textContent=(name?name+' 공구':'전체 공구')+' PRD 상세 현황';
 $('prd-zone-side').innerHTML=activeZone?`<h3>${esc(name)} 공구 현황</h3><p><strong>${info.total}공 · 시공률 ${info.percent.toFixed(1)}%</strong></p><p class="prd-muted">천공 ${info.work.drilled} · 반입 ${info.work.delivered} · 시공 ${info.work.installed}공</p><button type="button" data-zone-details>상세 목록 보기</button><hr>`:'';
 $('prd-zone-progress').textContent=`시공률 ${info.percent.toFixed(1)}%`;
 $('prd-zone-summary').innerHTML=[['전체',info.total],['천공 완료',info.work.drilled],['자재 반입',info.work.delivered],['시공 완료',info.work.installed],['확인 필요',info.warnings]].map(([label,n])=>`<div><span>${label}</span><strong>${n}<small> 공</small></strong></div>`).join('');
 const rows=members.filter(visible).sort((a,b)=>title(a).localeCompare(title(b),'ko',{numeric:true})||a.key.localeCompare(b.key));
 $('prd-zone-table-count').textContent=`공 번호를 누르면 해당 공으로 이동합니다. ${rows.length} / ${members.length}공 표시`;
 $('prd-zone-rows').innerHTML=rows.map(p=>{const r=data.records[p.key]||{},s=stage(p),z=zoneData.membership[p.key];return `<tr><td><button type="button" data-key="${esc(p.key)}">${esc(title(p))}${p.warnings.length?' ⚠':''}</button></td><td>${esc(z==='unassigned'?'미분류':z)}</td><td>${esc(p.type.join(' / ')||'—')}</td><td><i class="prd-dot" style="background:${s[2]}"></i> ${s[1]}</td><td>${esc(r.drilled||'—')}</td><td>${esc(r.delivered||'—')}</td><td>${esc(r.installed||'—')}</td><td class="prd-note-cell">${esc(r.note||'—')}</td></tr>`;}).join('')||'<tr><td colspan="8">해당 조건의 공이 없습니다.</td></tr>';
 for(const b of $('prd-zone-tabs').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.zone===activeZone));
 for(const n of zoneShapes.querySelectorAll('[data-zone]')){const on=n.dataset.zone===activeZone;n.classList.toggle('prd-zone-active',on);n.setAttribute('aria-pressed',String(on));}
 for(const n of zoneLabels.querySelectorAll('[data-zone]'))n.classList.toggle('prd-zone-active',n.dataset.zone===activeZone);
}
function draw(){
 group.replaceChildren();labels.replaceChildren();zoneShapes.replaceChildren();zoneLabels.replaceChildren();
 const ps=data.drawing.piles,xs=ps.map(p=>p.x),ys=ps.map(p=>-p.y),minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY,pad=Math.max(w,h)*.045||3000;
 full=[minX-pad,minY-pad,Math.max(w+pad*2,1000),Math.max(h+pad*2,1000)];
 for(const z of zoneData.zones){
  const n=svg('polygon',{points:z.points.map(([x,y])=>`${x},${-y}`).join(' '),class:'prd-zone',tabindex:'0',role:'button','data-zone':z.id,'aria-label':z.id+' 공구 · '+z.keys.length+'공'},zoneShapes);svg('title',{},n).textContent=z.id+' 공구 · 클릭하여 상세 현황 보기';
  const text=svg('text',{x:z.center[0],y:-z.center[1],class:'prd-zone-label','data-zone':z.id,'font-size':Math.max(w/65,1600),'text-anchor':'middle',tabindex:'0',role:'button','aria-label':z.id+' 공구 상세 현황'},zoneLabels);text.textContent=z.id;
 }
 for(const path of data.drawing.paths.filter(p=>p.layer==='-perimeter'))svg('polyline',{points:path.points.map(([x,y])=>`${x},${-y}`).join(' ')+(path.closed&&path.points.length?` ${path.points[0][0]},${-path.points[0][1]}`:''),fill:'none',stroke:path.layer==='-perimeter'?'#8198a9':'#bcc8d1','stroke-width':path.layer==='-perimeter'?1.5:1,'stroke-dasharray':path.layer==='-zoning'?'5 5':'none','vector-effect':'non-scaling-stroke'},group);
 for(const p of ps){const n=svg('circle',{id:'prd-p-'+p.key,cx:p.x,cy:-p.y,r:p.radius,tabindex:'0',role:'button',class:'prd-pile'+(p.warnings.length?' prd-issue':''),'data-key':p.key},group);svg('title',{},n);const t=svg('text',{x:p.x,y:-p.y-p.radius-260,'font-size':Math.max(w/550,300),'text-anchor':'middle'},labels);t.textContent=title(p);}
 fit();renderStatus();
}
function activate(next){
 data=next;zoneData=Z.build(data.drawing);activeZone='';selected=null;dirty=false;$('prd-empty').hidden=true;$('prd-workspace').hidden=false;$('prd-backup').disabled=false;$('prd-csv').disabled=false;
 $('prd-filename').textContent=data.filename+' · '+data.drawing.piles.length+'공';$('prd-selection-empty').hidden=false;$('prd-form').hidden=true;
 $('prd-search').value='';$('prd-filter').value='';
 $('prd-zone-tabs').innerHTML=[['','전체 '+data.drawing.piles.length+'공'],...zoneData.zones.map(z=>[z.id,z.id+' · '+z.keys.length+'공']),...(zoneData.issues.length?[['unassigned','미분류 · '+zoneData.issues.length+'공']]:[])].map(([id,label])=>`<button type="button" data-zone="${esc(id)}" aria-pressed="${!id}">${esc(label)}</button>`).join('');
 const different=data.drawing.piles.filter(p=>p.diameter&&Math.abs(p.diameter-p.radius*2)>1).length;
 $('prd-import-warning').textContent=[...data.drawing.warnings,...(zoneData.issues.length?[`공구 경계 확인 필요 ${zoneData.issues.length}공: 미분류 목록을 확인하세요.`]:[]),...(different?[`레이어 공경과 원 지름이 다른 공 ${different}개: 화면은 도면 형상 그대로 표시합니다.`]:[])].join('\n');$('prd-import-warning').hidden=!$('prd-import-warning').textContent;
 draw();
}
async function restore(file){
 if(!file||!saveForm())return;
 if(!baseDrawing){message('기본 도면을 먼저 불러와야 합니다.',true);return;}
 if(file.size>20*1024*1024){message('20MB 이하 파일을 선택해 주세요.',true);return;}
 try{
  const next=P.fixedDrawing(baseDrawing,JSON.parse(await file.text()));
  if(JSON.stringify(next.records)!==JSON.stringify(data.records)&&!confirm('백업 파일의 기록으로 현재 시공 기록을 교체할까요?')){message('복원을 취소했습니다.');return;}
  activate(next);if(persist())message('기본 도면의 시공 기록을 복원했습니다.');
 }catch(e){message('복원하지 못했습니다. '+e.message,true);}
}
$('prd-restore').addEventListener('change',e=>{restore(e.target.files[0]);e.target.value='';});
async function openFixedDrawing(){
 $('prd-retry').disabled=true;message('서리풀 PRD 기본 도면을 불러오고 있습니다…');
 try{
  const response=await fetch('prd-default.json?v=20260921-84');
  if(!response.ok)throw Error('도면 응답 오류');
  baseDrawing=P.fixedDrawing(await response.json());
  let saved=null,readError=false;
  try{const raw=localStorage.getItem(STORE+'-'+baseDrawing.id);if(raw)saved=JSON.parse(raw);}
  catch{readError=true;}
  let next=baseDrawing;
  if(saved){try{next=P.fixedDrawing(baseDrawing,saved);}catch{readError=true;}}
  activate(next);
  message(readError?'저장 기록을 읽지 못했습니다. 기본 도면을 표시합니다. 기존 기록은 덮어쓰지 않았으니 백업 파일로 복원해 주세요.':saved?'기본 도면과 저장된 시공 기록을 불러왔습니다.':'기본 도면이 준비되었습니다. 공을 클릭해 시공 일자를 입력하세요.',readError);
 }catch{message('기본 도면을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.',true);}
 finally{$('prd-retry').disabled=false;}
}
$('prd-retry').addEventListener('click',openFixedDrawing);
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('prd-backup').addEventListener('click',()=>{if(data&&saveForm())download('PRD-현황-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data),'application/json');});
$('prd-csv').addEventListener('click',()=>{if(!data||!saveForm())return;const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const rows=[['객체ID','공 번호','공구','부재명','타입','반력 원문','공경 레이어','상태','천공 일자','자재 반입 일자','자재 시공 일자','메모','확인 사항'],...data.drawing.piles.map(p=>{const r=data.records[p.key]||{};return [p.key,title(p),zoneData.membership[p.key]==='unassigned'?'미분류':zoneData.membership[p.key],p.name.join(' / '),p.type.join(' / '),p.reaction.join(' / '),p.layer,stage(p)[1],r.drilled,r.delivered,r.installed,r.note,p.warnings.join(' / ')];})];download('PRD-시공현황.csv','\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');});
$('prd-form').addEventListener('input',()=>{dirty=true;message('입력 중 · 저장 버튼을 누르면 기록됩니다.');});
$('prd-form').addEventListener('submit',e=>{e.preventDefault();saveForm();});
$('prd-search').addEventListener('input',renderStatus);$('prd-filter').addEventListener('change',renderStatus);
$('prd-zone-side').addEventListener('click',e=>{if(e.target.closest('[data-zone-details]'))$('prd-zone-title').scrollIntoView({behavior:'smooth',block:'start'});});
$('prd-zone-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-zone]');if(b)selectZone(b.dataset.zone);});
$('prd-zone-rows').addEventListener('click',e=>{const b=e.target.closest('button[data-key]');if(b)select(b.dataset.key,true);});
$('prd-list').addEventListener('click',e=>{const b=e.target.closest('button[data-key]');if(b)select(b.dataset.key,true);});
$('prd-fit').addEventListener('click',fit);$('prd-zoom-in').addEventListener('click',()=>zoom(.7));$('prd-zoom-out').addEventListener('click',()=>zoom(1/.7));$('prd-show-labels').addEventListener('change',viewbox);
function point(e){const p=map.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(map.getScreenCTM().inverse());return [q.x,q.y];}
map.addEventListener('wheel',e=>{if(!view)return;e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15,point(e));},{passive:false});
map.addEventListener('pointerdown',e=>{if(!view||e.button!==0)return;drag={x:e.clientX,y:e.clientY,p:point(e),view:[...view],key:e.target.dataset.key,zone:e.target.dataset.zone,moved:false};map.setPointerCapture(e.pointerId);});
map.addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;if(drag.moved){const p=point(e);view[0]+=drag.p[0]-p[0];view[1]+=drag.p[1]-p[1];viewbox();}});
map.addEventListener('pointerup',()=>{if(drag&&!drag.moved){if(drag.key)select(drag.key);else if(drag.zone)selectZone(drag.zone);}drag=null;});map.addEventListener('pointercancel',()=>drag=null);
map.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){if(e.target.dataset.key){e.preventDefault();select(e.target.dataset.key);}else if(e.target.dataset.zone){e.preventDefault();selectZone(e.target.dataset.zone);}}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
openFixedDrawing();
})();
