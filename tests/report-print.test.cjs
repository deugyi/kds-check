const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('shared printing expands only current-page details and restores after cancel or print',()=>{
  const listeners={},events={},closed={open:false},alreadyOpen={open:true},otherPage={open:false};let calls=0,stopped=false;
  const context={document:{querySelector:()=>({querySelectorAll:()=>[closed]}),addEventListener:(name,fn,capture)=>{listeners[name]=fn;assert.equal(capture,true);}},addEventListener:(name,fn)=>events[name]=fn,print:()=>{calls++;assert.equal(closed.open,true);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../report-print.js'),'utf8'),context);
  listeners.click({target:{closest:()=>null}});assert.equal(calls,0);
  listeners.click({target:{closest:()=>({})},preventDefault(){},stopImmediatePropagation(){stopped=true;}});
  assert.equal(calls,1);assert.equal(stopped,true);assert.equal(otherPage.open,false);
  events.beforeprint();events.afterprint();assert.equal(closed.open,false);assert.equal(alreadyOpen.open,true);
  events.beforeprint();assert.equal(closed.open,true);events.afterprint();assert.equal(closed.open,false);
});
test('each implemented calculator has exactly one shared print header',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const sections=[...html.matchAll(/<section class="tab(?: on)?" id="(t\d+)">([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length,10);
  for(const [,id,body] of sections){assert.match(body,/<button[^>]*class="go"[^>]*data-report-print/,id);assert.equal((body.match(/data-report-print/g)||[]).length,1,id);assert.equal((body.match(/class="report-notice"/g)||[]).length,1,id);}
});
