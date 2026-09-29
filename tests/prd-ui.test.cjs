const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../prd.js'),Z=require('../prd-zones.js'),base=require('./prd-fixture.cjs');
// Small DOM adapter: count writes/layout reads, drive the real UI event handlers.
async function load(options={}){
 const nodes=new Map(),frames=new Map(),writes=[];let nextFrame=0,reads=0,saved=null,failSave=false,role=options.role||'editor',userId='test-user',generation=1;const docEvents={},remote={},calls=[];
 class Element{
  constructor(tag='div'){this.tagName=tag;this.attrs={};this.dataset={};this.children=[];this.style={};this.events={};this.value='';this.hidden=false;this.checked=true;this._html='';this._text='';this.classes=new Set();this.selectors={};
   this.classList={add:k=>{this.classes.add(k);writes.push(['class',this]);},remove:k=>{this.classes.delete(k);writes.push(['class',this]);},contains:k=>this.classes.has(k),toggle:(k,v)=>{if(v===undefined)v=!this.classes.has(k);v?this.classList.add(k):this.classList.remove(k);}};
  }
  setAttribute(k,v){this.attrs[k]=String(v);writes.push([k,this]);if(k==='id')nodes.set(v,this);if(k==='class')this.classes=new Set(v.split(' '));if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  appendChild(n){return this.insertBefore(n,null);}
  insertBefore(n,before){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(c=>c!==n);const i=this.children.indexOf(before);if(i<0)this.children.push(n);else this.children.splice(i,0,n);n.parentNode=this;return n;}
  replaceChildren(){this.children=[];}
  get firstElementChild(){return this.children[0];}
  set textContent(v){this._text=v;writes.push(['text',this]);}get textContent(){return this._text;}
  set innerHTML(v){this._html=v;writes.push(['html',this]);this.children=[];for(const m of v.matchAll(/<button\b([^>]*)>/g)){const n=new Element('button');for(const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g))n.setAttribute(a[1],a[2]);this.children.push(n);}}get innerHTML(){return this._html;}
  querySelectorAll(s){if(this.selectors[s])return this.selectors[s];return this.children.filter(n=>s==='button'?n.tagName==='button':s==='text'?n.tagName==='text':s==='[data-zone]'?n.dataset.zone!==undefined:false);}
  querySelector(s){if(this.selectors[s])return this.selectors[s][0];return s==='title'?this.children.find(n=>n.tagName==='title'):null;}
  addEventListener(k,fn){this.events[k]=fn;}
  closest(){return this;}
  setPointerCapture(){}
  focus(){}
  getScreenCTM(){reads++;return {inverse:()=>({a:2,b:0,c:0,d:2})};}
  createSVGPoint(){return {x:0,y:0,matrixTransform(m){return {x:this.x*m.a+this.y*m.c,y:this.x*m.b+this.y*m.d};}};}
 }
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');for(const m of html.matchAll(/id="(prd-[^"]+|site-prd|site-north-prd|site-north-fullscreen)"/g)){const n=new Element();nodes.set(m[1],n);}
 const $=id=>{assert.ok(nodes.has(id),id);return nodes.get(id);};
 const mapCard=new Element();mapCard.appendChild($('prd-map'));$('prd-workspace').appendChild($('prd-dashboard-panel'));$('prd-workspace').appendChild(mapCard);$('prd-dashboard-panel').open=true;
 const pages=[$('site-prd'),$('site-north-prd')];
 for(const page of pages){page.id=page===$('site-prd')?'site-prd':'site-north-prd';const select=new Element('select');select.value='prd';const button=page.id==='site-prd'?$('prd-fullscreen'):$('site-north-fullscreen');
 page.selectors['[data-site-trade]']=[select];page.selectors['[data-site-fullscreen]']=[button];
 page.selectors['[data-trade]']=['prd','steel','slab','curtainwall'].map(trade=>{const pane=new Element();pane.dataset.trade=trade;pane.hidden=trade!=='prd';return pane;});}
 function emit(name){for(const fn of docEvents[name]||[])fn();}
 const cloud={allowed:()=>['viewer','editor','admin'].includes(role),canEdit:()=>['editor','admin'].includes(role),get generation(){return generation;},get userId(){return userId;},explain:e=>e.message,
 load:async()=>({base:JSON.parse(JSON.stringify(base)),rows:Object.values(remote)}),records:async()=>Object.values(remote),save:async(key,r,version)=>{
 calls.push({key,r,version});if(failSave)throw Object.assign(Error('RECORD_CONFLICT'),{code:'40001'});if(!cloud.canEdit())throw Object.assign(Error('EDIT_ACCESS_REQUIRED'),{code:'42501'});
 const row={...r,pile_key:key,version:version+1};remote[key]=row;saved={records:Object.fromEntries(Object.entries(remote).map(([k,v])=>[k,v]))};return row;
 }};
 const ctx=vm.createContext({PRD:P,PRDZones:Z,PRDDashboard:require('../prd-dashboard.js'),SiteCloud:cloud,console,setInterval(){},confirm:()=>options.confirm!==false,document:{getElementById:$,createElementNS:(_,tag)=>new Element(tag),addEventListener(k,fn){(docEvents[k]??=[]).push(fn);},querySelectorAll:s=>s==='.site-page'?pages:[],body:new Element()},window:{addEventListener(){}},localStorage:{getItem:()=>options.legacy?JSON.stringify(options.legacy):null,setItem(){throw Error('must not write localStorage');}},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../prd-ui.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../site-workspace.js'),'utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));
 function flush(){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();}
 flush();assert.equal($('prd-feedback').hidden,true);writes.length=0;
 const map=$('prd-map'),event=(kind,target=map,extra={})=>map.events[kind]({target,button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){},...extra});
 async function click(key){const n=$('prd-p-'+key);event('pointerdown',n);event('pointerup',n);await new Promise(r=>setImmediate(r));}
 async function zone(id){$('prd-zone-tabs').events.click({target:$('prd-zone-tabs').children.find(n=>n.dataset.zone===id)});await new Promise(r=>setImmediate(r));flush();}
 return {$,event,click,zone,flush,writes,frames,calls,remote,ctx,async changeRole(next){role=next;generation++;emit('site-auth-change');await new Promise(r=>setImmediate(r));},async logout(){role='pending';userId=null;generation++;emit('site-auth-change');await new Promise(r=>setImmediate(r));},get reads(){return reads;},get saved(){return saved;},failSave:()=>failSave=true};
}
test('pile selection only updates the old/new circle and preserves the 790-row table',async()=>{
 const h=await load(),[a,b]=base.drawing.piles;
 await h.click(a.key);h.writes.length=0;await h.click(b.key);
 assert.equal(h.$('prd-selected-title').textContent,b.number.join(' / '));
 assert.equal(h.$('prd-p-'+a.key).classList.contains('prd-selected'),false);
 assert.equal(h.$('prd-p-'+b.key).classList.contains('prd-selected'),true);
 assert.equal(h.writes.filter(([,n])=>n===h.$('prd-zone-rows')).length,0);
 assert.equal(h.writes.filter(([,n])=>n.tagName==='circle').length,2);
 assert.equal((h.$('prd-zone-rows').innerHTML.match(/<tr>/g)||[]).length,790);
});
test('zones and cross-zone selection keep the correct scope',async()=>{
 const h=await load(),zones=Z.build(base.drawing);await h.zone('C4');
 assert.equal((h.$('prd-zone-rows').innerHTML.match(/<tr>/g)||[]).length,40);
 await h.click(zones.zones.find(z=>z.id==='A1').keys[0]);
 assert.match(h.$('prd-zone-title').textContent,/A1/);
 assert.equal((h.$('prd-zone-rows').innerHTML.match(/<tr>/g)||[]).length,120);
 await h.zone('');assert.equal((h.$('prd-zone-rows').innerHTML.match(/<tr>/g)||[]).length,790);
});
test('autosave preserves records and refreshes status/filter/table before changing selection',async()=>{
 const h=await load(),[a,b]=base.drawing.piles;await h.click(a.key);
 h.$('prd-drilled').value='2026-09-21';h.$('prd-note').value='test';h.$('prd-form').events.input();await h.click(b.key);
 assert.equal(h.saved.records[a.key].drilled,'2026-09-21');assert.equal(h.saved.records[a.key].note,'test');
 assert.match(h.$('prd-p-'+a.key).getAttribute('aria-label'),/천공 완료/);
 h.$('prd-filter').value='drilled';h.$('prd-filter').events.change();assert.equal((h.$('prd-zone-rows').innerHTML.match(/<tr>/g)||[]).length,1);
 await h.click(a.key);assert.equal(h.$('prd-drilled').value,'2026-09-21');
 h.$('prd-drilled').value='';h.$('prd-form').events.input();h.$('prd-form').events.submit({preventDefault(){}});await new Promise(r=>setImmediate(r));
 assert.match(h.$('prd-zone-rows').innerHTML,/해당 조건/);assert.equal(h.saved.records[a.key].drilled,'');
});
test('failed save keeps the current pile and unsaved values',async()=>{
 const h=await load(),[a,b]=base.drawing.piles;await h.click(a.key);h.failSave();h.$('prd-note').value='keep me';h.$('prd-form').events.input();await h.click(b.key);
 assert.equal(h.$('prd-selected-title').textContent,a.number.join(' / '));assert.equal(h.$('prd-note').value,'keep me');assert.equal(h.$('prd-feedback').hidden,false);
});
test('pan bursts use one transform read and one paint; release keeps final position without selecting',async()=>{
 const h=await load(),map=h.$('prd-map'),start=map.getAttribute('viewBox').split(' ').map(Number),reads=h.reads;
 h.event('pointerdown',h.$('prd-p-'+base.drawing.piles[0].key));
 for(let i=1;i<=30;i++)h.event('pointermove',map,{clientX:100+i,clientY:100+2*i});
 assert.equal(h.reads-reads,1);assert.equal(h.frames.size,1);assert.equal(h.writes.filter(([k])=>k==='viewBox').length,0);
 h.event('pointerup',map,{clientX:140,clientY:180});h.flush();
 const end=map.getAttribute('viewBox').split(' ').map(Number);assert.equal(end[0],start[0]-80);assert.equal(end[1],start[1]-160);assert.equal(end[2],start[2]);
 assert.equal(h.writes.filter(([k])=>k==='viewBox').length,1);assert.equal(h.writes.filter(([k])=>k==='font-size').length,0);assert.equal(h.$('prd-form').hidden,true);
});
test('wheel bursts coalesce, zoom clamps, cancellation and later clicking still work',async()=>{
 const h=await load(),map=h.$('prd-map'),initial=map.getAttribute('viewBox').split(' ').map(Number);
 for(let i=0;i<60;i++)h.event('wheel',map,{deltaY:-1});assert.equal(h.frames.size,1);h.flush();
 assert.equal(map.getAttribute('viewBox').split(' ').map(Number)[2],initial[2]/35);
 assert.equal(h.writes.filter(([k])=>k==='viewBox').length,1);
 h.event('pointerdown');h.event('pointercancel');const before=map.getAttribute('viewBox');h.event('pointermove',map,{clientX:300});h.flush();assert.equal(map.getAttribute('viewBox'),before);
 await h.click(base.drawing.piles[0].key);assert.equal(h.$('prd-form').hidden,false);
});

test('viewer can select and inspect, but cannot edit or import',async()=>{
 const h=await load({role:'viewer'});await h.click(base.drawing.piles[0].key);
 assert.equal(h.$('prd-note').disabled,true);assert.equal(h.$('prd-save').disabled,true);
 h.$('prd-form').events.input();h.$('prd-form').events.submit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(h.calls.length,0);
});
test('logout clears geometry, record DOM and unsaved fields',async()=>{
 const h=await load();await h.click(base.drawing.piles[0].key);h.$('prd-note').value='private';h.$('prd-form').events.input();await h.logout();
 assert.equal(h.$('prd-geometry').children.length,0);assert.equal(h.$('prd-zone-rows').innerHTML,'');assert.equal(h.$('prd-note').value,'');assert.equal(h.$('prd-workspace').hidden,true);assert.equal(h.$('prd-dashboard').innerHTML,'');
});
test('remote refresh preserves dirty input; explicit refresh cancellation also keeps it',async()=>{
 const h=await load({confirm:false});await h.click(base.drawing.piles[0].key);h.$('prd-note').value='draft';h.$('prd-form').events.input();
 await h.$('prd-refresh').events.click();assert.equal(h.$('prd-note').value,'draft');assert.equal(h.ctx.PRDCloudUI.hasUnsaved(),true);
});

test('unchanged server refresh does not repaint the dashboard',async()=>{
 const h=await load();h.writes.length=0;
 await h.$('prd-refresh').events.click();
 assert.equal(h.writes.filter(([,n])=>n===h.$('prd-dashboard')).length,0);
});

test('dashboard reflects saved dates and its zone bars reuse the existing drawing selection',async()=>{
 const h=await load(),a=base.drawing.piles[0];
 await h.click(a.key);const initial=h.$('prd-dashboard').innerHTML;
 h.$('prd-drilled').value='2026-09-01';h.$('prd-installed').value='2026-09-02';h.$('prd-form').events.input();
 await h.$('prd-form').events.submit({preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.notEqual(h.$('prd-dashboard').innerHTML,initial);
 assert.match(h.$('prd-dashboard').innerHTML,/2026-09-02/);
 const b=h.$('prd-dashboard').children.find(n=>n.dataset.zone==='A1');
 await h.$('prd-dashboard').events.click({target:b});
 assert.equal(h.$('prd-zone-title').textContent,'A1 공구 PRD 상세 현황');
 assert.equal(h.$('prd-dashboard').innerHTML.includes('남측 전체 기록 기준'),true);
});
test('import skips existing server records and keeps local source untouched',async()=>{
 const [a,b]=base.drawing.piles,legacy={...base,records:{[a.key]:{note:'old'},[b.key]:{note:'local'}}};
 const h=await load({legacy});h.remote[a.key]={pile_key:a.key,note:'newer',version:3};await h.$('prd-import-local').events.click();
 assert.equal(h.remote[a.key].note,'newer');assert.equal(h.remote[b.key].note,'local');assert.equal(h.calls.length,1);assert.equal(h.calls[0].version,0);
});


test('fullscreen switches graphs and zone/all drawings, preserving view and restoring the dashboard',async()=>{
 const h=await load(),page=h.$('site-prd'),panel=h.$('prd-dashboard-panel'),map=h.$('prd-map');
 const full=map.getAttribute('viewBox');panel.open=false;
 await h.$('prd-fullscreen').events.click();
 assert.equal(page.classList.contains('prd-fullscreen'),true);
 assert.equal(panel.parentNode,map.parentNode);
 h.$('prd-graphs-toggle').events.click();
 assert.equal(page.classList.contains('prd-fs-graphs'),true);
 assert.equal(panel.open,true);
 const bar=h.$('prd-dashboard').children.find(n=>n.dataset.zone==='C4');
 await h.$('prd-dashboard').events.click({target:bar});h.flush();
 assert.equal(page.classList.contains('prd-fullscreen'),true);
 assert.equal(page.classList.contains('prd-fs-graphs'),false);
 assert.equal(page.classList.contains('prd-fs-details'),false);
 assert.match(h.$('prd-zone-title').textContent,/C4/);
 const zoneView=map.getAttribute('viewBox');assert.notEqual(zoneView,full);
 h.$('prd-graphs-toggle').events.click();h.$('prd-graphs-toggle').events.click();h.flush();
 assert.equal(map.getAttribute('viewBox'),zoneView);
 h.$('prd-graphs-toggle').events.click();await h.zone('');
 assert.equal(page.classList.contains('prd-fs-graphs'),false);
 assert.equal(map.getAttribute('viewBox'),full);
 assert.equal((h.$('prd-zone-rows').innerHTML.match(/<tr>/g)||[]).length,790);
 h.$('prd-graphs-toggle').events.click();await h.$('prd-fullscreen').events.click();
 assert.equal(page.classList.contains('prd-fullscreen'),false);
 assert.equal(panel.parentNode,h.$('prd-workspace'));
 assert.equal(panel.open,false);
 assert.equal(h.$('prd-graphs-toggle').hidden,true);
});

test('logout while fullscreen graphs are visible removes records and exits fullscreen',async()=>{
 const h=await load();await h.$('prd-fullscreen').events.click();h.$('prd-graphs-toggle').events.click();await h.logout();
 assert.equal(h.$('site-prd').classList.contains('prd-fullscreen'),false);
 assert.equal(h.$('prd-dashboard').innerHTML,'');
 assert.equal(h.$('prd-workspace').hidden,true);
 assert.equal(h.$('prd-dashboard-panel').parentNode,h.$('prd-workspace'));
});


test('trade switching keeps fullscreen and the PRD zone, view, graph and records',async()=>{
 const h=await load(),page=h.$('site-prd'),select=page.querySelector('[data-site-trade]');
 await h.zone('C4');const box=h.$('prd-map').getAttribute('viewBox');
 await h.$('prd-fullscreen').events.click();h.$('prd-graphs-toggle').events.click();
 for(const trade of ['steel','slab','curtainwall','prd']){
  select.value=trade;await select.events.change();
  assert.equal(page.classList.contains('site-fullscreen'),true);
  assert.equal(page.querySelectorAll('[data-trade]').filter(p=>!p.hidden)[0].dataset.trade,trade);
 }
 assert.equal(h.$('prd-map').getAttribute('viewBox'),box);
 assert.match(h.$('prd-zone-title').textContent,/C4/);
 assert.equal(page.classList.contains('prd-fs-graphs'),true);
 assert.equal(h.calls.length,0);
});

test('trade switch saves edits first and failed save keeps the PRD form visible',async()=>{
 const h=await load(),page=h.$('site-prd'),select=page.querySelector('[data-site-trade]'),pile=base.drawing.piles[0];
 await h.click(pile.key);h.$('prd-note').value='before trade switch';h.$('prd-form').events.input();
 select.value='steel';await select.events.change();
 assert.equal(h.saved.records[pile.key].note,'before trade switch');assert.equal(select.value,'steel');
 select.value='prd';await select.events.change();
 h.failSave();h.$('prd-note').value='unsaved draft';h.$('prd-form').events.input();
 select.value='slab';await select.events.change();
 assert.equal(select.value,'prd');assert.equal(h.$('prd-note').value,'unsaved draft');
 assert.equal(page.querySelectorAll('[data-trade]').find(p=>p.dataset.trade==='prd').hidden,false);
});

test('north fullscreen trade changes are independent and access revocation closes them',async()=>{
 const h=await load(),north=h.$('site-north-prd'),select=north.querySelector('[data-site-trade]');
 await h.$('site-north-fullscreen').events.click();select.value='curtainwall';await select.events.change();
 assert.equal(north.classList.contains('site-fullscreen'),true);
 assert.equal(h.$('site-prd').classList.contains('site-fullscreen'),false);
 assert.equal(h.$('site-prd').querySelector('[data-site-trade]').value,'prd');
 await h.changeRole('blocked');
 assert.equal(north.classList.contains('site-fullscreen'),false);
 select.value='steel';await select.events.change();assert.equal(select.value,'curtainwall');
 await h.$('site-north-fullscreen').events.click();assert.equal(north.classList.contains('site-fullscreen'),false);
});
