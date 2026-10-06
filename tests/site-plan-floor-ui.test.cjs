const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
global.PRDZones=require('../prd-zones.js');const G=require('../site-plan.js');
function harness(catalog=[]){
 const listeners={},intervals=[],frames=[],calls=[],records={d1:[],d2:[]},hidden={d1:{},d2:{}},regions={d1:[],d2:[]};let allowed=true,generation=1,failSave=false,failLoad=false,holdId=null,release=null;
 class Element{
  constructor(){this.selectors=new Map();this.events={};this.dataset={};this.value='';this.checked=false;this.hidden=false;this.textContent='';this.attrs={};this.children=[];this.parentNode={title:''};this.classList={toggle(){},contains:()=>false};this.elements={namedItem:n=>this.querySelector('[name="'+n+'"]')};}
  addEventListener(k,f){this.events[k]=f;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}appendChild(n){this.children.push(n);}
  set innerHTML(v){this.html=v;this.children=[];for(const m of v.matchAll(/<button\b([^>]*)>/g)){const b=new Element();for(const a of m[1].matchAll(/data-([\w-]+)="([^"]*)"/g))b.dataset[a[1]]=a[2];this.children.push(b);}}get innerHTML(){return this.html||'';}
  querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new Element());return this.selectors.get(s);}
  querySelectorAll(s){if(s==='button')return this.children;if(s==='input,select,textarea,button')return ['label','spec','delivered','completed','note','slab_kind','decked','reinforced'].map(n=>this.elements.namedItem(n));if(s==='.plan-zones button')return this.querySelector('.plan-zones').children;return [];}
  reset(){for(const e of this.querySelectorAll('input,select,textarea,button'))e.value='';}getBoundingClientRect(){return {left:0,top:0,width:1000,height:1000};}setPointerCapture(){}hasPointerCapture(){return true;}releasePointerCapture(){}focus(){}
  getContext(){if(!this.context){const data={calls:[],transforms:[],translate(...xy){this.transforms.push(xy);},lineTo(...xy){this.calls.push(xy);}};this.context=new Proxy(data,{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}return this.context;}
 }
 const page=new Element(),steel=page.querySelector('[data-trade="steel"]'),slab=page.querySelector('[data-trade="slab"]');slab.hidden=true;page.querySelector('[data-site-trade]').value='steel';page.querySelector('[data-plan-floor]').value='B1';
 const drawing={floor:'지하1층',bounds:[0,0,10000,10000],perimeter:[[0,0],[10000,0],[10000,10000],[0,10000]],zones:[{id:'A1',points:[[0,0],[10000,0],[10000,10000],[0,10000]]}],members:[{key:'same',a:[1000,1500],b:[4000,1500],kind:'beam',zone:'A1'}],slabs:[{key:'panel',zone:'A1',points:[[6000,1000],[8000,1000],[8000,3000],[6000,3000]],holes:[],area:4}],columns:[],background:[],duplicatePairs:[],duplicateGroups:[],openEnds:[]};
 const cloud={planFloors:[{id:'B1',name:'지하1층',drawing:'d1'},{id:'B2',name:'지하2층',drawing:'d2'}],allowed:()=>allowed,canEditTrade:()=>allowed,isAdmin:()=>allowed,explain:e=>e.message,get generation(){return generation;},get userId(){return 'viewer';},loadPlan:async id=>{calls.push(['load',id]);if(failLoad&&id==='d2')throw Error('offline');if(holdId===id)await new Promise(r=>release=r);return {document:{drawing:{...drawing,floor:id==='d1'?'지하1층':'지하2층',slabsReady:id==='d1',slabCatalog:id==='d1'?catalog:[]}},rows:structuredClone(records[id]),visibility:hidden[id],regions:structuredClone(regions[id])};},planState:async id=>{calls.push(['state',id]);return {records:structuredClone(records[id]),visibility:hidden[id],regions:structuredClone(regions[id])};},saveTrade:async(trade,key,value,version,id)=>{calls.push(['save',id]);if(failSave)throw Error('save failed');const row={...value,trade,item_key:key,version:version+1};records[id]=records[id].filter(r=>r.trade!==trade||r.item_key!==key).concat(row);return row;},saveSlabRegion:async(key,geometry,hide,version,id)=>{calls.push(['region',id,key]);if(failSave)throw Error('save failed');const row={item_key:key,geometry:structuredClone(geometry),hidden:hide,version:version+1};regions[id]=regions[id].filter(r=>r.item_key!==key).concat(row);return row;},saveSlabRegions:async(changes,expected,id)=>{calls.push(['regions',id,changes]);if(failSave)throw Error('save failed');const actual=Object.fromEntries(regions[id].map(r=>[r.item_key,r.version]));if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('REGION_STATE_CONFLICT');const rows=changes.map(c=>({item_key:c.item_key,geometry:structuredClone(c.geometry),hidden:c.hidden,version:c.expected_version+1}));const keys=new Set(rows.map(r=>r.item_key));regions[id]=regions[id].filter(r=>!keys.has(r.item_key)).concat(rows);return rows;},setMemberHidden:async(key,hide,version,id)=>{calls.push(['hide',id]);return hidden[id][key]={hidden:hide,version:version+1};}};
 const context=vm.createContext({document:{createElementNS(){},createElement:()=>new Element(),getElementById:()=>page,addEventListener:(k,f)=>listeners[k]=f,hidden:false},window:{addEventListener(){}},SiteCloud:cloud,crypto:require('node:crypto').webcrypto,SiteSlabEditor:require('../site-slab-editor.js'),PRDZones:global.PRDZones,SitePlan:G,SiteSlabCatalog:require('../site-slab-catalog.js'),SiteSlabArea:require('../site-slab-area.js'),SiteWorkspace:{refreshControls(){}},PRDDashboard:{today:()=> '2026-10-03'},ResizeObserver:class{observe(){}},Path2D:class{moveTo(){}lineTo(){}closePath(){}arc(){}},requestAnimationFrame:f=>{frames.push(f);return frames.length;},setInterval:f=>intervals.push(f),confirm:()=>true,structuredClone});
 vm.runInContext(fs.readFileSync(require.resolve('../site-plan-ui.js'),'utf8'),context);
 const form=steel.querySelector('form'),field=n=>form.elements.namedItem(n);
 async function pick(){const canvas=steel.querySelector('canvas'),e={button:0,pointerId:1,clientX:2450/10.9,clientY:1000-1950/10.9};canvas.events.pointerdown(e);await canvas.events.pointerup(e);}
 return {context,page,steel,slab,cloud,calls,records,regions,field,pick,flush(){while(frames.length)frames.shift()();},async pickSlab(){const canvas=slab.querySelector('canvas'),e={button:0,pointerId:1,clientX:7450/10.9,clientY:1000-2450/10.9};canvas.events.pointerdown(e);await canvas.events.pointerup(e);},async activate(){await context.SitePlanUI.activate('steel');},edit(name,value){field(name).value=value;form.events.input();},failSave(){failSave=true;},failLoad(){failLoad=true;},hold(){holdId='d2';},release(){release();},logout(){allowed=false;generation++;listeners['site-auth-change']();}};
}
test('slab catalog selection saves a specification without changing kind, dates, label or geometry; clears across floors and logout',async()=>{
 const catalog=[{code:'S1',thickness_mm:180,type:'T1',attributes:[{label:'상부 주근',value:'<img src=x>'}]}],h=harness(catalog);
 await h.activate();await h.pickSlab();const form=h.slab.querySelector('form'),field=n=>form.elements.namedItem(n),select=h.slab.querySelector('[data-slab-catalog]');
 assert.equal(field('slab_kind').value,'opening');field('label').value='keep area name';field('note').value='keep note';
 select.value='S1';form.events.input({target:select});assert.equal(select.value,'S1');select.events.change();assert.equal(field('spec').value,'S1 · 두께 180 mm · T1');assert.equal(field('slab_kind').value,'opening');
 assert.equal(field('completed').value,'');assert.equal(field('label').value,'keep area name');h.flush();
 assert.doesNotMatch(h.slab.innerHTML,/슬래브 사양|부재표 상세|data-slab-catalog-details/);assert.match(h.slab.innerHTML,/<input type="hidden" name="spec">/);
 const snap=await h.context.SitePlanUI.exportSnapshot('slab');assert.equal(snap.records.panel.spec,field('spec').value);assert.equal(snap.records.panel.note,'keep note');assert.equal(snap.slabCatalog.length,1);assert.equal(h.regions.d1.length,0);
 field('spec').value='custom text';form.events.input();assert.equal(select.value,'__existing__');assert.match(select.innerHTML,/기존 입력 · custom text/);
 await h.context.SitePlanUI.selectFloor('B2');assert.equal(h.slab.querySelector('[data-slab-catalog-control]').hidden,true);assert.doesNotMatch(select.innerHTML,/S1/);
 await h.context.SitePlanUI.selectFloor('B1');await h.pickSlab();assert.equal(field('spec').value,'custom text');assert.equal(select.value,'__existing__');select.value='';select.events.change();assert.equal(field('spec').value,'');assert.equal(select.value,'');
 h.logout();assert.doesNotMatch(select.innerHTML,/S1/);assert.doesNotMatch(select.innerHTML,/custom text/);
});
test('floor switch saves source edits before replacing geometry; destination records and export stay isolated',async()=>{
 const h=harness();await h.activate();await h.pick();h.edit('label','B1 member');await h.context.SitePlanUI.selectFloor('B2');
 assert.deepEqual(h.calls.filter(c=>c[0]==='save'),[['save','d1']]);assert.equal(h.context.SitePlanUI.floor,'B2');assert.equal(h.context.SitePlanUI.isReady('slab'),true);
 await h.pick();assert.equal(h.field('label').value,'');h.edit('label','B2 member');h.edit('completed','2026-10-03');
 const snap=await h.context.SitePlanUI.exportSnapshot('steel');assert.equal(snap.floor,'지하2층');assert.equal(snap.records.same.label,'B2 member');
 await h.context.SitePlanUI.selectFloor('B1');await h.pick();assert.equal(h.field('label').value,'B1 member');assert.equal(h.field('completed').value,'');assert.equal(h.records.d2[0].label,'B2 member');
});
test('save or destination load failure retains current floor and unsaved source input',async()=>{
 const h=harness();await h.activate();await h.pick();h.edit('label','keep draft');h.failSave();assert.equal(await h.context.SitePlanUI.selectFloor('B2'),false);assert.equal(h.context.SitePlanUI.floor,'B1');assert.equal(h.field('label').value,'keep draft');assert.equal(h.calls.some(c=>c[0]==='load'&&c[1]==='d2'),false);
 const g=harness();await g.activate();g.failLoad();assert.equal(await g.context.SitePlanUI.selectFloor('B2'),false);assert.equal(g.context.SitePlanUI.floor,'B1');assert.match(g.page.querySelector('[data-plan-sync-status]').textContent,/이전 층/);
});
test('access revocation while destination loads clears geometry and rejects the late response',async()=>{
 const h=harness();await h.activate();await h.pick();h.hold();const pending=h.context.SitePlanUI.selectFloor('B2');await tick();h.logout();h.release();await pending;
 assert.equal(h.context.SitePlanUI.floor,'B1');assert.equal(h.context.SitePlanUI.isReady('steel'),false);assert.equal(h.steel.querySelector('.plan-workspace').hidden,true);assert.equal(h.field('label').value,'');assert.equal(await h.context.SitePlanUI.selectFloor('B2'),false);
});

test('steel hide and restore updates slab background; admin show-hidden mode stays limited to steel',async()=>{
 const h=harness();await h.activate();await h.pick();await h.steel.events.click({target:{closest:()=>({dataset:{action:'hide-member'}})}});
 h.steel.querySelector('[data-plan-hidden]').checked=true;h.steel.hidden=true;h.slab.hidden=false;h.page.querySelector('[data-site-trade]').value='slab';await h.context.SitePlanUI.activate('slab');h.flush();
 const canvas=h.slab.querySelector('canvas');assert.equal(canvas.context.calls.some(x=>x[0]===4000&&x[1]===1500),false);
 h.slab.hidden=true;h.steel.hidden=false;h.page.querySelector('[data-site-trade]').value='steel';await h.context.SitePlanUI.activate('steel');await h.pick();await h.steel.events.click({target:{closest:()=>({dataset:{action:'hide-member'}})}});
 h.steel.hidden=true;h.slab.hidden=false;h.page.querySelector('[data-site-trade]').value='slab';await h.context.SitePlanUI.activate('slab');canvas.context.calls.length=0;h.flush();assert.equal(canvas.context.calls.some(x=>x[0]===4000&&x[1]===1500),true);
});
test('opening save preserves dates, disables date editing and updates area export independently of candidate count',async()=>{
 const h=harness();h.records.d1.push({trade:'slab',item_key:'panel',slab_kind:'deck',completed:'2026-10-03',version:1});h.steel.hidden=true;h.slab.hidden=false;h.page.querySelector('[data-site-trade]').value='slab';await h.context.SitePlanUI.activate('slab');await h.pickSlab();
 const form=h.slab.querySelector('form'),kind=form.elements.namedItem('slab_kind'),cast=form.elements.namedItem('completed');assert.equal(cast.value,'2026-10-03');kind.value='opening';form.events.input();assert.equal(cast.disabled,true);assert.equal(h.slab.querySelector('[data-slab-opening-note]').hidden,false);
 const snap=await h.context.SitePlanUI.exportSnapshot('slab');assert.equal(snap.records.panel.slab_kind,'opening');assert.equal(snap.records.panel.completed,'2026-10-03');assert.equal(snap.area.gross,100);assert.equal(snap.area.opening,100);assert.equal(snap.area.total,0);assert.equal(snap.area.completed,0);assert.equal(snap.area.percent,null);
 kind.value='deck';form.events.input();assert.equal(cast.disabled,false);const restored=await h.context.SitePlanUI.exportSnapshot('slab');assert.equal(restored.area.opening,96);assert.equal(restored.area.total,4);assert.ok(Math.abs(restored.area.completed-4)<1e-8);assert.equal(restored.area.percent,100);
});

test('untouched regions open with the opening default and dates locked until a slab type is chosen',async()=>{
 const h=harness();h.steel.hidden=true;h.slab.hidden=false;h.page.querySelector('[data-site-trade]').value='slab';await h.context.SitePlanUI.activate('slab');await h.pickSlab();const form=h.slab.querySelector('form');
 assert.equal(form.elements.namedItem('slab_kind').value,'opening');assert.equal(form.elements.namedItem('completed').disabled,true);assert.match(h.slab.innerHTML,/영역 지정 방법/);assert.match(h.slab.innerHTML,/경계 수정/);
 form.elements.namedItem('slab_kind').value='deck';form.events.input();assert.equal(form.elements.namedItem('completed').disabled,false);const snap=await h.context.SitePlanUI.exportSnapshot('slab');assert.equal(snap.area.total,4);assert.equal(snap.area.completed,0);assert.equal(snap.area.percent,0);
});

const slabAction=(h,action,extra={})=>h.slab.events.click({target:{closest:()=>({dataset:{action,...extra}})}});
const slabEvent=(x,y)=>({button:0,pointerId:1,clientX:(x+450)/10.9,clientY:1000-(y+450)/10.9});
async function slabPoint(h,x,y){const c=h.slab.querySelector('canvas'),e=slabEvent(x,y);c.events.pointerdown(e);await c.events.pointerup(e);}
async function slabActive(h){h.steel.hidden=true;h.slab.hidden=false;h.page.querySelector('[data-site-trade]').value='slab';await h.context.SitePlanUI.activate('slab');}
test('new polygon saves on the current floor; kind defaults opening and the saved polygon controls area export',async()=>{
 const h=harness();await slabActive(h);await slabAction(h,'slab-new');assert.equal(h.context.SitePlanUI.hasUnsaved(),true);
 assert.equal(await h.context.SitePlanUI.selectFloor('B2'),false);assert.equal(await h.context.SitePlanUI.beforeTradeChange('slab'),false);
 for(const p of [[1000,1000],[3000,1000],[3000,3000],[1000,3000]])await slabPoint(h,...p);
 await slabAction(h,'slab-commit');assert.equal(h.regions.d1.length,1);assert.equal(h.regions.d2.length,0);assert.equal(h.context.SitePlanUI.hasUnsaved(),false);
 const row=h.regions.d1[0],form=h.slab.querySelector('form');assert.match(row.item_key,/^USER-SLAB-/);assert.equal(form.elements.namedItem('slab_kind').value,'opening');
 form.elements.namedItem('slab_kind').value='deck';form.elements.namedItem('completed').value='2026-10-06';form.events.input();const snap=await h.context.SitePlanUI.exportSnapshot('slab');assert.ok(Math.abs(snap.area.total-4)<1e-8);assert.ok(Math.abs(snap.area.completed-4)<1e-8);assert.ok(snap.items.find(v=>v.key===row.item_key));
 await h.context.SitePlanUI.selectFloor('B2');await h.context.SitePlanUI.selectFloor('B1');await slabActive(h);const restored=await h.context.SitePlanUI.exportSnapshot('slab');assert.ok(Math.abs(restored.area.completed-4)<1e-8);
});
test('existing boundary supports point drag/add/delete/undo; saves retain construction dates and hide/restore excludes area',async()=>{
 const h=harness();h.records.d1.push({trade:'slab',item_key:'panel',slab_kind:'deck',label:'keep',completed:'2026-10-03',version:1});await slabActive(h);await h.pickSlab();await slabAction(h,'slab-edit');
 const c=h.slab.querySelector('canvas'),down=slabEvent(8000,1000),moved=slabEvent(9000,1000);c.events.pointerdown(down);c.events.pointermove(moved);await c.events.pointerup(moved);
 await slabPoint(h,6000,2000);await slabAction(h,'slab-delete-point');await slabAction(h,'slab-undo');await slabAction(h,'slab-undo');
 await slabAction(h,'slab-commit');assert.ok(Math.abs(h.regions.d1[0].geometry.points[1][0]-9000)<1e-8);assert.equal(h.records.d1[0].version,1);assert.equal(h.records.d1[0].completed,'2026-10-03');assert.ok(Math.abs((await h.context.SitePlanUI.exportSnapshot('slab')).area.total-5)<1e-8);
 await slabAction(h,'slab-hide');assert.equal((await h.context.SitePlanUI.exportSnapshot('slab')).area.total,0);assert.equal(h.records.d1[0].label,'keep');await slabAction(h,'slab-restore',{region:'panel'});assert.ok(Math.abs((await h.context.SitePlanUI.exportSnapshot('slab')).area.completed-5)<1e-8);
});
test('invalid shapes or server failure retain boundary draft; cancel and logout leave saved geometry unchanged',async()=>{
 const h=harness();await slabActive(h);await slabAction(h,'slab-new');for(const p of [[1000,1000],[3000,3000],[1000,3000],[3000,1000]])await slabPoint(h,...p);await slabAction(h,'slab-commit');assert.equal(h.regions.d1.length,0);assert.match(h.slab.querySelector('[data-editor-message]').textContent,/교차/);
 await slabAction(h,'slab-cancel');await h.pickSlab();await slabAction(h,'slab-redraw');for(const p of [[6000,1000],[9000,1000],[9000,3000],[6000,3000]])await slabPoint(h,...p);h.failSave();await slabAction(h,'slab-commit');assert.equal(h.context.SitePlanUI.hasUnsaved(),true);assert.equal(h.regions.d1.length,0);
 h.logout();assert.equal(h.context.SitePlanUI.hasUnsaved(),false);assert.equal(h.slab.querySelector('.plan-editor-dock').hidden,true);
});

test('blank slab clicks show a notice without changing the zone, zoom, selection or unsaved record',async()=>{
 const h=harness();await slabActive(h);await h.pickSlab();const form=h.slab.querySelector('form');form.elements.namedItem('note').value='draft';form.events.input();const c=h.slab.querySelector('canvas');h.flush();const before=c.context.transforms.at(-1);
 await slabPoint(h,4000,7000);h.flush();assert.equal(h.slab.querySelector('.plan-map-toast').hidden,false);assert.match(h.slab.querySelector('.plan-map-toast').querySelector('span').textContent,/선택할 영역이 없습니다/);assert.deepEqual(c.context.transforms.at(-1),before);assert.equal(form.elements.namedItem('note').value,'draft');assert.equal(h.records.d1.length,0);assert.equal(h.context.SitePlanUI.hasUnsaved(),true);
 await slabAction(h,'slab-dismiss');assert.equal(h.slab.querySelector('.plan-map-toast').hidden,true);
});
test('preview does not persist; saving an overlapping opening trims its neighbour atomically and preserves dates',async()=>{
 const h=harness();h.records.d1.push({trade:'slab',item_key:'panel',slab_kind:'deck',completed:'2026-10-03',note:'keep',version:1});await slabActive(h);await slabAction(h,'slab-new');for(const p of [[6900,0],[7200,0],[7200,4000],[6900,4000]])await slabPoint(h,...p);
 await slabAction(h,'slab-preview');assert.equal(h.regions.d1.length,0);assert.match(h.slab.querySelector('[data-editor-message]').textContent,/주변 1개/);h.flush();await slabAction(h,'slab-commit');assert.equal(h.regions.d1.length,2);assert.equal(h.regions.d1.find(r=>r.item_key==='panel').geometry.parts.length,2);assert.equal(h.records.d1[0].note,'keep');assert.equal(h.records.d1[0].completed,'2026-10-03');
 const snap=await h.context.SitePlanUI.exportSnapshot('slab');assert.ok(Math.abs(snap.area.total-3.4)<1e-8);assert.ok(Math.abs(snap.area.completed-3.4)<1e-8);
 // Both disconnected pieces retain the same record and can be selected/edited.
 await slabPoint(h,7600,2000);assert.equal(h.slab.querySelector('form').elements.namedItem('note').value,'keep');await slabAction(h,'slab-edit');await slabPoint(h,8000,2000);await slabAction(h,'slab-commit');assert.equal(h.regions.d1.find(r=>r.item_key==='panel').geometry.parts.length,2);
});
test('fully covered region retains its record; restore cannot reintroduce overlap and failed batch keeps all geometry unchanged',async()=>{
 const h=harness();h.records.d1.push({trade:'slab',item_key:'panel',slab_kind:'deck',completed:'2026-10-03',version:1});await slabActive(h);await slabAction(h,'slab-new');for(const p of [[5500,500],[8500,500],[8500,3500],[5500,3500]])await slabPoint(h,...p);await slabAction(h,'slab-commit');assert.equal(h.regions.d1.find(r=>r.item_key==='panel').hidden,true);
 const before=structuredClone(h.regions.d1);await slabAction(h,'slab-restore',{region:'panel'});assert.match(h.slab.querySelector('.plan-form-message').textContent,/겹칩니다/);assert.deepEqual(h.regions.d1,before);assert.equal(h.records.d1[0].completed,'2026-10-03');
 await slabAction(h,'slab-new');for(const p of [[5000,1000],[7000,1000],[7000,3000],[5000,3000]])await slabPoint(h,...p);h.failSave();await slabAction(h,'slab-commit');assert.deepEqual(h.regions.d1,before);assert.equal(h.context.SitePlanUI.hasUnsaved(),true);
});
