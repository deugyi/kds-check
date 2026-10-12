const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 const events={},created=[];let allowed=true,generation=1,held=null,release,failPlans=false,planCalls=0,downloaded=null;
 class Element{
  constructor(tag='div'){this.tagName=tag;this.events={};this.value='';this.disabled=false;this.open=false;this.textContent='';this.innerHTML='';this.dataset={};this.nodes=new Map();this.attrs={};}
  querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
  querySelectorAll(){return this.controls||[];}addEventListener(k,f){this.events[k]=f;}setAttribute(k,v){this.attrs[k]=v;}appendChild(n){this.child=n;}prepend(n){this.child=n;}focus(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const page=new Element();
 const cloud={allowed:()=>allowed,get generation(){return generation;}};
 const document={getElementById:()=>page,createElementNS(){},createElement:tag=>{const el=new Element(tag);created.push(el);if(tag==='dialog'){const form=el.querySelector('form'),fields=Object.fromEntries(['kind','start','end'].map(n=>[n,new Element()]));fields.kind.value='weekly';form.elements={namedItem:n=>fields[n]};form.controls=[...Object.values(fields),new Element('button')];}return el;},addEventListener:(k,f)=>events[k]=f};
 const ctx=vm.createContext({document,SiteCloud:cloud,PRDDashboard:{today:()=> '2026-10-12'},SiteReports:{...require('../site-reports.js'),download:async(m,valid)=>{await tick();if(valid()){downloaded=m;return true;}return false;}},PRDCloudUI:{reportSnapshot:async()=>{if(held)await held;return {items:[{key:'a',label:'A1-001',zone:'A1'}],records:{a:{installed:'2026-10-08'}}};}},SitePlanUI:{reportSnapshot:async()=>{planCalls++;if(failPlans)throw Error('second floor unavailable');return [];}}});
 vm.runInContext(fs.readFileSync(require.resolve('../site-reports-ui.js'),'utf8'),ctx);
 const button=created[0],dialog=created[1],form=dialog.querySelector('form'),field=n=>form.elements.namedItem(n),body=dialog.querySelector('[data-report-body]'),download=dialog.querySelector('[data-report-download]'),status=dialog.querySelector('[data-report-status]');
 return {button,dialog,form,field,body,download,status,async open(){button.events.click();await tick();},async query(){form.events.submit({preventDefault(){}});await tick();},hold(){held=new Promise(r=>release=r);},release(){release();held=null;},logout(){allowed=false;generation++;events['site-auth-change']();},failPlans(){failPlans=true;},get planCalls(){return planCalls;},get downloaded(){return downloaded;}};
}
test('report presets select actual daily/weekly periods and changing the period invalidates the old download',async()=>{
 const h=harness();await h.open();assert.equal(h.field('start').value,'2026-10-12');assert.equal(h.download.disabled,false);
 h.field('end').value='2026-10-08';h.field('end').events.change();assert.equal(h.field('start').value,'2026-10-05');assert.equal(h.download.disabled,true);assert.equal(h.body.innerHTML,'');await h.query();assert.match(h.body.innerHTML,/2026-10-05 ~ 2026-10-08/);
 await h.download.events.click();assert.equal(h.downloaded.start,'2026-10-05');assert.equal(h.downloaded.end,'2026-10-08');
 h.field('kind').value='daily';h.field('kind').events.change();assert.equal(h.field('start').value,'2026-10-08');assert.equal(h.download.disabled,true);
});
test('logout while source records load cannot show old data or load other floors',async()=>{
 const h=harness();h.hold();await h.open();h.logout();h.release();await tick();assert.equal(h.dialog.open,false);assert.equal(h.body.innerHTML,'');assert.equal(h.download.disabled,true);assert.equal(h.button.disabled,true);assert.equal(h.planCalls,0);
});
test('failure in one source prevents a partial report and download',async()=>{
 const h=harness();h.failPlans();await h.open();assert.equal(h.download.disabled,true);assert.equal(h.body.innerHTML,'');assert.match(h.status.textContent,/second floor unavailable/);
});
test('closing a pending report discards the late response, and Escape/Tab stay inside the report',async()=>{
 const h=harness();h.hold();await h.open();let stopped=0;h.dialog.events.keydown({key:'Escape',stopPropagation:()=>stopped++});h.dialog.events.keydown({key:'Tab',stopPropagation:()=>stopped++});assert.equal(stopped,2);
 h.dialog.querySelector('[data-report-close]').events.click();h.release();await tick();assert.equal(h.dialog.open,false);assert.equal(h.body.innerHTML,'');assert.equal(h.download.disabled,true);
});
