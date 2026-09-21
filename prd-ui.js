(function(){
'use strict';
if(!document.createElementNS)return;
const $=id=>document.getElementById(id),P=globalThis.PRD,Z=globalThis.PRDZones,NS='http://www.w3.org/2000/svg',STORE='kds-prd-v1';
let data=null,selected=null,view=null,full=null,drag=null,dirty=false,baseDrawing=null,zoneData=null,activeZone='';
let frame=0,wheel=null,paintedView=null,sortedPiles=[];
const cloud=globalThis.SiteCloud;
let busy=false,loading=false,loadedUser=null,versions=new Map(),legacy=null;
const pileNodes=new Map(),pilesByKey=new Map(),searchText=new Map(),collator=new Intl.Collator('ko',{numeric:true});
const map=$('prd-map'),group=$('prd-geometry'),labels=$('prd-labels'),zoneShapes=$('prd-zone-shapes'),zoneLabels=$('prd-zone-labels');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=p=>p.number.join(' / ')||'번호 미연결 · '+p.key;
const message=(s,error=false)=>{$('prd-feedback').textContent=error?s:'';$('prd-feedback').hidden=!error;$('prd-feedback').classList.toggle('prd-error',error);$('prd-form-feedback').textContent=error?'':s;};
function svg(name,attrs,parent){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));parent.appendChild(n);return n;}
function stage(p){return P.stages.find(s=>s[0]===P.status(data.records[p.key]));}
function controls(){
 const disabled=busy||!cloud?.canEdit();
 for(const id of ['prd-drilled','prd-delivered','prd-installed','prd-note','prd-save'])$(id).disabled=disabled;
 $('prd-import-local').hidden=!legacy||!cloud?.canEdit();
 $('prd-import-local').disabled=busy;$('prd-refresh').disabled=busy;
}
function takeRows(rows){
 const records={},nextVersions=new Map();
 for(const row of rows){if(!pilesByKey.has(row.pile_key))continue;records[row.pile_key]=P.record(row);nextVersions.set(row.pile_key,row.version);}
 data.records=records;versions=nextVersions;
}
// Coalesce pointer/wheel bursts into one SVG update per animation frame.
function viewbox(){if(!frame)frame=requestAnimationFrame(paintView);}
function paintView(){
 frame=0;if(!view)return;
 if(wheel){const e=wheel;wheel=null;let p=point(e);if(paintedView){const r=view[2]/paintedView[2];p=[view[0]+(p[0]-paintedView[0])*r,view[1]+(p[1]-paintedView[1])*r];}zoomView(e.factor,p);}
 map.setAttribute('viewBox',view.join(' '));
 labels.style.display=$('prd-show-labels').checked&&view[2]<full[2]*.48?'':'none';
 if(!paintedView||paintedView[2]!==view[2])for(const t of zoneLabels.children)t.setAttribute('font-size',view[2]/65);
 paintedView=[...view];
}
function flushView(){if(frame){cancelAnimationFrame(frame);paintView();}}
function fit(){if(full){view=[...full];viewbox();}}
function zoomView(factor,point){const nw=Math.max(full[2]/35,Math.min(full[2]*1.3,view[2]*factor)),ratio=nw/view[2];point=point||[view[0]+view[2]/2,view[1]+view[3]/2];view=[point[0]-(point[0]-view[0])*ratio,point[1]-(point[1]-view[1])*ratio,nw,view[3]*ratio];}
function zoom(factor){if(view){flushView();zoomView(factor);viewbox();}}
function setSelected(key){
 if(selected!==key){pileNodes.get(selected)?.classList.remove('prd-selected');pileNodes.get(key)?.classList.add('prd-selected');selected=key;}
 if(selected)$('prd-current-status').textContent=stage(pilesByKey.get(selected))[1];
}
async function saveForm(silent=false){
 if(busy)return false;
 if(!selected||!dirty)return true;
 const key=selected,epoch=cloud.generation;
 try{
  const r=P.record({drilled:$('prd-drilled').value,delivered:$('prd-delivered').value,installed:$('prd-installed').value,note:$('prd-note').value});
  busy=true;controls();message('서버에 저장하고 있습니다…');
  const saved=await cloud.save(key,r,versions.get(key)||0);
  if(epoch!==cloud.generation||!cloud.allowed())return false;
  data.records[key]=P.record(saved);versions.set(key,saved.version);dirty=false;renderStatus();
  if(!silent)message('서버에 저장했습니다.');return true;
 }catch(e){message(e?.code?cloud.explain(e):e.message,true);return false;}
 finally{busy=false;controls();}
}
async function select(key,focus=false){
 if(busy||!data||!cloud.allowed())return;
 if(dirty&&!await saveForm(true))return;
 const oldZone=activeZone,p=pilesByKey.get(key),r=data.records[key]||{};setSelected(key);
 if(activeZone&&zoneData.membership[key]!==activeZone)activeZone=zoneData.membership[key];
 $('prd-selection-empty').hidden=true;$('prd-form').hidden=false;$('prd-selected-title').textContent=title(p);
 $('prd-info').innerHTML=[['공구',zoneData.membership[p.key]==='unassigned'?'미분류':zoneData.membership[p.key]],['부재명',p.name.join(' / ')||'—'],['타입',p.type.join(' / ')||'—'],['공경 레이어',p.layer]].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
 $('prd-form-feedback').textContent=cloud.canEdit()?'':'조회 전용 계정입니다.';controls();
 if(isExpanded())showDetails(true);
 $('prd-selected-warning').textContent=p.warnings.join(' · ');$('prd-selected-warning').hidden=!p.warnings.length;
 for(const k of ['drilled','delivered','installed','note'])$('prd-'+k).value=r[k]||'';
 if(focus){const width=full[2]/6;view=[p.x-width/2,-p.y-width*.65/2,width,width*.65];viewbox();}
 // A selection does not change counts, filters or the dates table.
 if(oldZone!==activeZone)renderStatus();
}
function inZone(p){return !activeZone||zoneData.membership[p.key]===activeZone;}
function visibility(){const q=$('prd-search').value.trim().toLowerCase(),f=$('prd-filter').value;return p=>inZone(p)&&(!q||searchText.get(p.key).includes(q))&&(!f||(f==='issues'?p.warnings.length:P.status(data.records[p.key])===f));}
function attr(n,k,v){v=String(v);if(n.getAttribute(k)!==v)n.setAttribute(k,v);}
function renderStatus(){
 if(!data)return;
 const visible=visibility();
 const counts=Object.fromEntries(P.stages.map(s=>[s[0],0]));let shown=0;
 for(const p of data.drawing.piles){const n=pileNodes.get(p.key),v=visible(p),s=stage(p);if(inZone(p))counts[s[0]]++;shown+=v?1:0;attr(n,'fill',s[2]);attr(n,'opacity',v?1:.12);attr(n,'aria-label',title(p)+' · '+s[1]+(p.warnings.length?' · 확인 필요':''));const t=n.firstElementChild,text=title(p)+' · '+s[1];if(t.textContent!==text)t.textContent=text;}
 $('prd-stats').innerHTML=P.stages.map(([key,name,color])=>`<span class="prd-stat"><i class="prd-dot" style="background:${color}"></i>${name} <strong>${counts[key]}</strong></span>`).join('');
 $('prd-count').textContent=`${activeZone?(activeZone==='unassigned'?'미분류':activeZone)+' 공구':'전체'} ${data.drawing.piles.filter(inZone).length}공 · 검색/필터 ${shown}공`;
 setSelected(selected);
 renderZoneDetails(visible);
}
async function selectZone(id){
 if(busy||!data||!cloud.allowed())return;
 if(dirty&&!await saveForm(true))return;
 if(isExpanded())showDetails(true);
 activeZone=id;setSelected(null);$('prd-form').hidden=true;$('prd-selection-empty').hidden=false;
 $('prd-selection-empty').textContent=id?(id==='unassigned'?'미분류':id)+' 공구의 공을 선택하면 날짜를 입력할 수 있습니다.':'도면 또는 목록에서 공을 선택하세요.';
 $('prd-search').value='';$('prd-filter').value='';
 const z=zoneData.zones.find(z=>z.id===id);
 if(z){const xs=z.points.map(p=>p[0]),ys=z.points.map(p=>-p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.max(w,h)*.08;view=[x-pad,y-pad,w+2*pad,h+2*pad];viewbox();}else fit();
 renderStatus();
}
function renderZoneDetails(visible){
 const members=sortedPiles.filter(inZone),info=Z.summary(members,data.records,P.status),name=activeZone==='unassigned'?'미분류':activeZone;
 $('prd-zone-title').textContent=(name?name+' 공구':'전체 공구')+' PRD 상세 현황';
 $('prd-zone-side').innerHTML=activeZone?`<h3>${esc(name)} 공구 현황</h3><p><strong>${info.total}공 · 시공률 ${info.percent.toFixed(1)}%</strong></p><p class="prd-muted">천공 ${info.work.drilled} · 반입 ${info.work.delivered} · 시공 ${info.work.installed}공</p><button type="button" data-zone-details>상세 목록 보기</button><hr>`:'';
 $('prd-zone-progress').textContent=`시공률 ${info.percent.toFixed(1)}%`;
 $('prd-zone-summary').innerHTML=[['전체',info.total],['천공 완료',info.work.drilled],['자재 반입',info.work.delivered],['시공 완료',info.work.installed],['확인 필요',info.warnings]].map(([label,n])=>`<div><span>${label}</span><strong>${n}<small> 공</small></strong></div>`).join('');
 const rows=members.filter(visible);
 $('prd-zone-table-count').textContent=`공 번호를 누르면 해당 공으로 이동합니다. ${rows.length} / ${members.length}공 표시`;
 $('prd-zone-rows').innerHTML=rows.map(p=>{const r=data.records[p.key]||{},s=stage(p),z=zoneData.membership[p.key];return `<tr><td><button type="button" data-key="${esc(p.key)}">${esc(title(p))}${p.warnings.length?' ⚠':''}</button></td><td>${esc(z==='unassigned'?'미분류':z)}</td><td>${esc(p.type.join(' / ')||'—')}</td><td><i class="prd-dot" style="background:${s[2]}"></i> ${s[1]}</td><td>${esc(r.drilled||'—')}</td><td>${esc(r.delivered||'—')}</td><td>${esc(r.installed||'—')}</td><td class="prd-note-cell">${esc(r.note||'—')}</td></tr>`;}).join('')||'<tr><td colspan="8">해당 조건의 공이 없습니다.</td></tr>';
 for(const b of $('prd-zone-tabs').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.zone===activeZone));
 for(const n of zoneShapes.querySelectorAll('[data-zone]')){const on=n.dataset.zone===activeZone;n.classList.toggle('prd-zone-active',on);n.setAttribute('aria-pressed',String(on));}
 for(const n of zoneLabels.querySelectorAll('[data-zone]'))n.classList.toggle('prd-zone-active',n.dataset.zone===activeZone);
}
function draw(){
 pileNodes.clear();paintedView=null;
 group.replaceChildren();labels.replaceChildren();zoneShapes.replaceChildren();zoneLabels.replaceChildren();
 const ps=data.drawing.piles,xs=ps.map(p=>p.x),ys=ps.map(p=>-p.y),minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY,pad=Math.max(w,h)*.045||3000;
 full=[minX-pad,minY-pad,Math.max(w+pad*2,1000),Math.max(h+pad*2,1000)];
 for(const z of zoneData.zones){
  const n=svg('polygon',{points:z.points.map(([x,y])=>`${x},${-y}`).join(' '),class:'prd-zone',tabindex:'0',role:'button','data-zone':z.id,'aria-label':z.id+' 공구 · '+z.keys.length+'공'},zoneShapes);svg('title',{},n).textContent=z.id+' 공구 · 클릭하여 상세 현황 보기';
  const text=svg('text',{x:z.center[0],y:-z.center[1],class:'prd-zone-label','data-zone':z.id,'font-size':Math.max(w/65,1600),'text-anchor':'middle',tabindex:'0',role:'button','aria-label':z.id+' 공구 상세 현황'},zoneLabels);text.textContent=z.id;
 }
 for(const path of data.drawing.paths.filter(p=>p.layer==='-perimeter'))svg('polyline',{points:path.points.map(([x,y])=>`${x},${-y}`).join(' ')+(path.closed&&path.points.length?` ${path.points[0][0]},${-path.points[0][1]}`:''),fill:'none',stroke:path.layer==='-perimeter'?'#8198a9':'#bcc8d1','stroke-width':path.layer==='-perimeter'?1.5:1,'stroke-dasharray':path.layer==='-zoning'?'5 5':'none','vector-effect':'non-scaling-stroke'},group);
 for(const p of ps){const n=svg('circle',{id:'prd-p-'+p.key,cx:p.x,cy:-p.y,r:p.radius,tabindex:'0',role:'button',class:'prd-pile'+(p.warnings.length?' prd-issue':''),'data-key':p.key},group);pileNodes.set(p.key,n);svg('title',{},n);const t=svg('text',{x:p.x,y:-p.y-p.radius-260,'font-size':Math.max(w/550,300),'text-anchor':'middle'},labels);t.textContent=title(p);}
 fit();renderStatus();
}
function activate(next){
 data=next;zoneData=Z.build(data.drawing);activeZone='';selected=null;dirty=false;$('prd-empty').hidden=true;$('prd-workspace').hidden=false;
 pilesByKey.clear();searchText.clear();for(const p of data.drawing.piles){pilesByKey.set(p.key,p);searchText.set(p.key,[title(p),...p.name,...p.type,p.key].join(' ').toLowerCase());}
 sortedPiles=[...data.drawing.piles].sort((a,b)=>collator.compare(title(a),title(b))||a.key.localeCompare(b.key));
 $('prd-selection-empty').hidden=false;$('prd-form').hidden=true;
 $('prd-search').value='';$('prd-filter').value='';
 $('prd-zone-tabs').innerHTML=[['','전체 '+data.drawing.piles.length+'공'],...zoneData.zones.map(z=>[z.id,z.id+' · '+z.keys.length+'공']),...(zoneData.issues.length?[['unassigned','미분류 · '+zoneData.issues.length+'공']]:[])].map(([id,label])=>`<button type="button" data-zone="${esc(id)}" aria-pressed="${!id}">${esc(label)}</button>`).join('');
 $('prd-import-warning').textContent=[...data.drawing.warnings,...(zoneData.issues.length?[`공구 경계 확인 필요 ${zoneData.issues.length}공: 미분류 목록을 확인하세요.`]:[])].join('\n');$('prd-import-warning').hidden=!$('prd-import-warning').textContent;
 draw();
}
async function openFixedDrawing(){
 if(!cloud?.allowed()||loading)return;
 const epoch=cloud.generation;loading=true;$('prd-retry').disabled=true;message('서버 도면을 불러오고 있습니다…');
 try{
  const result=await cloud.load();if(epoch!==cloud.generation||!cloud.allowed())return;
  baseDrawing=P.fixedDrawing(result.base);activate(baseDrawing);takeRows(result.rows);renderStatus();loadedUser=cloud.userId;
  legacy=null;
  try{const raw=localStorage.getItem(STORE+'-'+baseDrawing.id);if(raw){const saved=P.fixedDrawing(baseDrawing,JSON.parse(raw));if(Object.values(saved.records).some(r=>Object.values(r).some(Boolean)))legacy=saved.records;}}
  catch{message('기존 브라우저 기록을 읽지 못했습니다. 기존 저장 내용은 그대로 보존했습니다.',true);}
  controls();$('prd-sync-status').textContent='서버 기록 연결됨';
 }catch(e){message(cloud.explain(e),true);}
 finally{loading=false;$('prd-retry').disabled=false;if(epoch!==cloud.generation&&cloud.allowed()&&!data)openFixedDrawing();}
}
async function refreshRecords(manual=false){
 if(busy||loading||!data||!cloud.allowed())return;
 if(dirty&&(!manual||!confirm('저장하지 않은 입력을 버리고 최신 기록을 불러올까요?')))return;
 const epoch=cloud.generation;busy=true;controls();
 try{const rows=await cloud.records();if(epoch!==cloud.generation)return;takeRows(rows);dirty=false;renderStatus();if(selected){const r=data.records[selected]||{};for(const k of ['drilled','delivered','installed','note'])$('prd-'+k).value=r[k]||'';}message('최신 서버 기록을 불러왔습니다.');}
 catch(e){message(cloud.explain(e),true);}
 finally{busy=false;controls();}
}
async function importLocal(){
 if(!legacy||busy||!cloud.canEdit())return;
 if(dirty&&!await saveForm())return;
 const entries=Object.entries(legacy).filter(([,r])=>Object.values(r).some(Boolean));
 if(!confirm(`이 브라우저의 기존 기록 ${entries.length}건을 서버로 옮길까요? 서버에 이미 기록이 있는 공은 건너뜁니다.`))return;
 const epoch=cloud.generation;busy=true;controls();let imported=0,skipped=0;
 try{
  const rows=await cloud.records();if(epoch!==cloud.generation||!cloud.allowed())return;takeRows(rows);
  for(const [key,r] of entries){
   if(epoch!==cloud.generation||!cloud.canEdit())throw Error('접근 권한이 변경되어 가져오기를 중단했습니다.');
   if(versions.has(key)){skipped++;continue;}
   try{const saved=await cloud.save(key,r,0);if(epoch!==cloud.generation)return;data.records[key]=P.record(saved);versions.set(key,saved.version);imported++;}
   catch(e){if(e.code==='40001'){skipped++;continue;}throw e;}
   $('prd-sync-status').textContent=`기록 가져오는 중 ${imported+skipped} / ${entries.length}`;
  }
  legacy=null;dirty=false;renderStatus();message(`${imported}건을 옮겼습니다. 서버에 기록이 있는 ${skipped}건은 유지했습니다. 브라우저 원본은 보존했습니다.`);
 }catch(e){message(`${imported}건 저장 후 중단되었습니다. 다시 시도할 수 있습니다. `+cloud.explain(e),true);if(data)renderStatus();}
 finally{busy=false;controls();$('prd-sync-status').textContent=cloud.allowed()?'서버 기록 연결됨':'';if(selected&&!dirty)select(selected);}
}
function clearDrawing(){
 if(isExpanded())exitExpanded();
 data=null;baseDrawing=null;loadedUser=null;selected=null;zoneData=null;legacy=null;dirty=false;view=null;wheel=null;drag=null;
 pileNodes.clear();pilesByKey.clear();searchText.clear();versions.clear();sortedPiles=[];
 for(const n of [group,labels,zoneShapes,zoneLabels])n.replaceChildren();
 for(const id of ['prd-zone-rows','prd-zone-tabs','prd-zone-side','prd-stats','prd-info','prd-zone-summary'])$(id).innerHTML='';
 for(const id of ['prd-drilled','prd-delivered','prd-installed','prd-note','prd-search'])$(id).value='';
 for(const id of ['prd-count','prd-selected-title','prd-current-status','prd-selected-warning','prd-zone-title','prd-zone-progress','prd-zone-table-count','prd-import-warning','prd-sync-status'])$(id).textContent='';
 $('prd-workspace').hidden=true;$('prd-empty').hidden=false;$('prd-form').hidden=true;message('');
}
document.addEventListener('site-auth-change',()=>{
 if(loadedUser&&loadedUser!==cloud.userId)clearDrawing();
 if(!cloud.allowed()){if(isExpanded())exitExpanded();controls();return;}
 if(data){controls();refreshRecords();}else openFixedDrawing();
});
$('prd-refresh').addEventListener('click',()=>refreshRecords(true));
$('prd-import-local').addEventListener('click',importLocal);
setInterval(()=>{if(!document.hidden&&$('site-prd').classList.contains('on'))refreshRecords();},30000);
globalThis.PRDCloudUI={hasUnsaved:()=>dirty||busy};
$('prd-retry').addEventListener('click',openFixedDrawing);
$('prd-form').addEventListener('input',()=>{if(busy||!cloud.canEdit())return;dirty=true;message('입력 중 · 저장 버튼을 누르면 기록됩니다.');});
$('prd-form').addEventListener('submit',e=>{e.preventDefault();saveForm();});
$('prd-search').addEventListener('input',renderStatus);$('prd-filter').addEventListener('change',renderStatus);
$('prd-zone-side').addEventListener('click',async e=>{if(e.target.closest('[data-zone-details]')){if(isExpanded())await exitExpanded();$('prd-zone-title').scrollIntoView({behavior:'smooth',block:'start'});}});
$('prd-zone-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-zone]');if(b)selectZone(b.dataset.zone);});
$('prd-zone-rows').addEventListener('click',e=>{const b=e.target.closest('button[data-key]');if(b)select(b.dataset.key,true);});
$('prd-fit').addEventListener('click',fit);$('prd-zoom-in').addEventListener('click',()=>zoom(.7));$('prd-zoom-out').addEventListener('click',()=>zoom(1/.7));$('prd-show-labels').addEventListener('change',viewbox);
const page=$('site-prd');
let fullscreenFocus=null;
function isExpanded(){return page.classList.contains('prd-fullscreen');}
function showDetails(open){page.classList.toggle('prd-fs-details',open);$('prd-details-toggle').setAttribute('aria-pressed',String(open));$('prd-details-toggle').textContent=open?'상세정보 닫기':'상세정보 열기';}
function expandedState(on){
 page.classList.toggle('prd-fullscreen',on);document.body.classList.toggle('prd-fullscreen-open',on);
 $('prd-fullscreen').textContent=on?'전체 화면 닫기':'전체 화면';$('prd-fullscreen').setAttribute('aria-pressed',String(on));$('prd-details-toggle').hidden=!on;
 if(on){showDetails(false);page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');$('prd-fullscreen').focus();}
 else{showDetails(false);page.removeAttribute('role');page.removeAttribute('aria-modal');if(fullscreenFocus?.isConnected)fullscreenFocus.focus({preventScroll:true});}
}
async function exitExpanded(){
 if(document.fullscreenElement===page){try{await document.exitFullscreen();}catch{}}
 expandedState(false);
}
$('prd-fullscreen').addEventListener('click',async()=>{
 if(isExpanded()){await exitExpanded();return;}
 fullscreenFocus=document.activeElement;expandedState(true);
 if(page.requestFullscreen){try{await page.requestFullscreen();}catch{/* Keep viewport expansion when native fullscreen is unavailable. */}}
});
$('prd-details-toggle').addEventListener('click',()=>showDetails(!page.classList.contains('prd-fs-details')));
// Native Escape and browser exits restore the original layout without changing view or records.
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==page&&isExpanded())expandedState(false);});
page.addEventListener('keydown',e=>{
 if(!isExpanded())return;
 if(e.key==='Escape'){e.preventDefault();exitExpanded();}
 if(e.key==='Tab'){
  const focusable=Array.from(page.querySelectorAll('button,input,select,textarea,[tabindex="0"]')).filter(n=>!n.disabled&&n.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }
});
function point(e){const p=map.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(map.getScreenCTM().inverse());return [q.x,q.y];}
map.addEventListener('wheel',e=>{if(!view)return;e.preventDefault();if(drag||!e.deltaY)return;wheel={clientX:e.clientX,clientY:e.clientY,factor:(wheel?.factor||1)*(e.deltaY>0?1.15:1/1.15)};viewbox();},{passive:false});
map.addEventListener('pointerdown',e=>{if(!view||e.button!==0||drag)return;flushView();drag={id:e.pointerId,x:e.clientX,y:e.clientY,matrix:map.getScreenCTM().inverse(),view:[...view],key:e.target.dataset.key,zone:e.target.dataset.zone,moved:false};map.setPointerCapture(e.pointerId);});
function pan(e){
 if(!drag||e.pointerId!==drag.id)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.hypot(dx,dy)>4)drag.moved=true;
 if(drag.moved){const m=drag.matrix;view=[drag.view[0]-m.a*dx-m.c*dy,drag.view[1]-m.b*dx-m.d*dy,drag.view[2],drag.view[3]];viewbox();}
}
map.addEventListener('pointermove',pan);
map.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;pan(e);const end=drag;drag=null;if(!end.moved){if(end.key)select(end.key);else if(end.zone)selectZone(end.zone);}});
for(const event of ['pointercancel','lostpointercapture'])map.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
map.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){if(e.target.dataset.key){e.preventDefault();select(e.target.dataset.key);}else if(e.target.dataset.zone){e.preventDefault();selectZone(e.target.dataset.zone);}}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
controls();if(cloud?.allowed())openFixedDrawing();
})();
