const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../design-load-table.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('Rev01 D6:I12 source fixture reconciles layers and all totals',()=>{
 const r=E.schedule(E.initial())[0];
 [2.3,.1,3.6,.2].forEach((q,i)=>near(r.rows[i].q,q));
 near(r.D,6.2);near(r.L,3);near(r.service,9.2);near(r.u12,12.24);near(r.u14,8.68);near(r.qu,12.24);
 assert.equal(r.governing,'1.2D + 1.6L');
});
test('material table preserves every source density and area load with explicit units',()=>{
 assert.deepEqual(E.MATERIALS.filter(m=>m.mode==='volume').map(m=>m.value),[24,23,27,20,10,24,10,18,15,12.5]);
 assert.deepEqual(E.MATERIALS.filter(m=>m.mode==='area').map(m=>m.value),[.05,.2,.1,1,1,.1,.1,.2,1.5,.5,.6]);
 assert.equal(E.MATERIALS.length,21);
});
test('material lookup changes every using case, while copied thickness stays independent',()=>{
 const s=E.initial();s.cases.push(E.clone(s.cases[0]));s.cases[1].layers[0].thickness=200;
 s.materials.find(m=>m.id==='plain').value=22;
 const a=E.schedule(s);near(a[0].D,6.1);near(a[1].D,8.3);
 assert.equal(s.cases[0].layers[0].thickness,100);assert.equal(E.MATERIALS[1].value,23);
});
test('direct surface loads ignore thickness; volume materials convert mm to m',()=>{
 const s=E.initial();s.cases[0].layers=[{material:'epoxy',thickness:300},{material:'stone',thickness:30}];
 const r=E.schedule(s)[0];near(r.rows[0].q,.05);near(r.rows[1].q,.81);near(r.D,.86);
});
test('1.4D governs zero live load and the crossover is continuous',()=>{
 const s=E.initial();s.cases[0].live=0;let r=E.schedule(s)[0];near(r.qu,8.68);assert.equal(r.governing,'1.4D');
 s.cases[0].live=.775;r=E.schedule(s)[0];near(r.u12,r.u14);
 s.cases[0].live=.8;assert.equal(E.schedule(s)[0].governing,'1.2D + 1.6L');
});
test('zero values are allowed and intermediate material loads are not rounded',()=>{
 const s=E.initial();s.cases[0].live=0;s.cases[0].layers=[{material:'rc',thickness:0}];near(E.schedule(s)[0].qu,0);
 s.cases[0].layers=Array.from({length:3},()=>({material:'rc',thickness:1.1}));near(E.schedule(s)[0].D,.0792);
});
test('missing, negative and nonfinite inputs reject, rather than silently produce a zero load',()=>{
 for(const bad of [NaN,Infinity,-1,'',null,undefined]){
  let s=E.initial();s.cases[0].live=bad;assert.throws(()=>E.schedule(s),/활하중/);
  s=E.initial();s.cases[0].layers[0].thickness=bad;assert.throws(()=>E.schedule(s),/두께/);
  s=E.initial();s.materials[0].value=bad;assert.throws(()=>E.schedule(s),/기준값/);
 }
 const s=E.initial();s.materials[0].value=1e308;s.cases[0].layers=[{material:'rc',thickness:1e308}];assert.throws(()=>E.schedule(s),/계산 가능한/);
});
test('unknown materials, duplicate identifiers, missing names and empty layers reject',()=>{
 let s=E.initial();s.cases[0].layers[0].material='missing';assert.throws(()=>E.schedule(s),/마감재/);
 s=E.initial();s.materials.push({...s.materials[0]});assert.throws(()=>E.schedule(s),/중복/);
 s=E.initial();s.cases[0].use='';assert.throws(()=>E.schedule(s),/용도/);
 s=E.initial();s.cases[0].layers=[];assert.throws(()=>E.schedule(s),/1~12/);
});
test('new material supports either mode and survives serializing the complete schedule',()=>{
 const s=E.initial();s.materials.push({id:'custom',name:'설비',mode:'area',value:1.37});s.cases[0].layers.push({material:'custom',thickness:0});
 const restored=JSON.parse(JSON.stringify(s));near(E.schedule(restored)[0].D,7.57);
 restored.materials.at(-1).mode='volume';restored.materials.at(-1).value=20;restored.cases[0].layers.at(-1).thickness=100;
 near(E.schedule(restored)[0].D,8.2);
});
