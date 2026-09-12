const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../rc-slab-oneway.js');
const base={fck:30,fy:500,h:200,L:3,cover:20,bottomBar:'D13',topBar:'D13',tempBar:'D10',bottomSpacing:150,topSpacing:200,tempSpacing:250,mode:'auto',support:'simple',environment:'dry',dead:0,live:6.25,point:0,pointX:1.5,Mp:20,Mn:20,V:30};
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('one-way UDL demands use the exact three ideal support solutions',()=>{
 let r=C.calculate(base);near(r.load.Mp,11.25);near(r.load.Mn,0);near(r.load.V,15);
 r=C.calculate({...base,support:'fixed'});near(r.load.Mp,3.75);near(r.load.Mn,7.5);near(r.load.V,15);
 r=C.calculate({...base,support:'cantilever'});near(r.load.Mp,0);near(r.load.Mn,45);near(r.load.V,30);
 r=C.calculate({...base,dead:0,live:0,point:0,h:400});near(r.load.Mp,0);near(r.load.V,0);
});
test('direct demands are preserved and isolated from inactive nominal loads',()=>{
 const r=C.calculate({...base,mode:'direct',dead:NaN,live:NaN,point:NaN,pointX:NaN});near(r.load.Mp,20);near(r.load.Mn,20);near(r.load.V,30);
 assert.throws(()=>C.calculate({...base,mode:'direct',Mn:NaN}));
});
test('flexure matches independent yielded-steel equilibrium and shear hand calculation',()=>{
 const r=C.calculate(base),As=126.7*1000/150,d=200-20-12.7/2,a=As*500/(.85*30*1000);
 near(r.bottom.As,As);near(r.bottom.d,d);near(r.bottom.phiMn,.85*As*500*(d-a/2)/1e6);
 near(r.bottom.phi,.85);near(r.shear.phiVc,.75*Math.sqrt(30)*d/6);
 const high=C.calculate({...base,fck:90});near(high.shear.phiVc,.75*8.4*d/6);
});
test('minimum steel, slab critical spacing and crack spacing are enforced independently',()=>{
 const r=C.calculate(base);near(r.bottom.AsMin,320);near(r.bottom.detailMax,300);near(r.bottom.crackMax,252);
 near(r.temp.As,2*71.33*1000/250);near(r.temp.maxSpacing,450);
 const wide=C.calculate({...base,bottomSpacing:350});assert.ok(wide.bottom.reasons.includes('위험단면 최대간격 초과'));
 const exposure=C.calculate({...base,environment:'other',bottomSpacing:200});near(exposure.bottom.crackMax,186.25);assert.equal(exposure.bottom.ok,false);
 assert.equal(C.calculate({...base,tempSpacing:500}).temp.ok,false);
 assert.equal(C.calculate({...base,bottomSpacing:30}).bottom.ok,false);
});
test('thickness reference is conditional and absolute 100mm is checked',()=>{
 const r=C.calculate(base);near(r.thickness.reference,150*(.43+500/700));assert.equal(r.thickness.absolute,true);
 const thin=C.calculate({...base,h:95,cover:10,bottomBar:'D10',topBar:'D10'});assert.equal(thin.thickness.absolute,false);assert.equal(thin.ok,false);
 assert.equal(C.calculate({...base,L:10}).thickness.referenceOk,false);
});
test('suggestions satisfy all face checks; an impossible demand returns no suggestion',()=>{
 const r=C.calculate(base);for(const k of ['bottom','top']){assert.equal(r.suggestions[k].ok,true);assert.ok(r.suggestions[k].spacing<=r[k].sMax);}
 const fail=C.calculate({...base,mode:'direct',Mp:10000,V:10000});assert.equal(fail.suggestions.bottom,null);assert.equal(fail.shear.ok,false);assert.equal(fail.ok,false);
});
test('bad geometry and malformed numbers cannot produce a result',()=>{
 for(const p of [{h:50},{bottomSpacing:0},{cover:Infinity},{fy:700},{fck:20},{mode:'x'},{dead:-1},{point:10,pointX:4}])assert.throws(()=>C.calculate({...base,...p}));
});


test('one simple and one continuous end matches propped-beam closed forms',()=>{
 const r=C.calculate({...base,support:'propped'}),q=10,L=3;
 near(r.load.Mp,9*q*L*L/128);near(r.load.Mn,q*L*L/8);near(r.load.V,5*q*L/8);
 near(r.load.governing.Mp.xp,3*L/8);near(r.load.governing.Mn.xn,L);
 near(r.thickness.reference,L*1000/24*(.43+500/700));
});
test('dead-only 1.4D and simultaneous uniform plus concentrated live are enveloped',()=>{
 const dead=C.calculate({...base,dead:10,live:0});near(dead.load.Mp,14*9/8);assert.equal(dead.load.governing.Mp.name,'1.4D');
 const p={...base,dead:5,live:3,point:10,pointX:1.5},r=C.calculate(p),q=10.8,P=16,L=3;
 near(r.load.Mp,q*L*L/8+P*L/4);near(r.load.V,q*L/2+P/2);
 near(r.load.cases[1].q,q);near(r.load.cases[1].P,P);
 const cant=C.calculate({...p,support:'cantilever',pointX:2});near(cant.load.Mn,q*L*L/2+P*2);near(cant.load.V,q*L+P);
});
test('off-centre and endpoint live load positions are preserved',()=>{
 const p={...base,dead:0,live:0,point:10,pointX:1};const r=C.calculate(p);
 near(r.load.Mp,16*1*2/3);near(r.load.V,16*2/3);near(r.load.governing.Mp.xp,1);
 const support=C.calculate({...p,pointX:0});near(support.load.Mp,0);near(support.load.V,0);
 const tip=C.calculate({...p,support:'cantilever',pointX:3});near(tip.load.Mn,48);near(tip.load.V,16);
 assert.throws(()=>C.calculate({...p,pointX:NaN}));
});
test('distribution reinforcement has independent amount, spacing and clear-distance failures',()=>{
 let r=C.calculate({...base,tempSpacing:450});assert.equal(r.temp.areaOK,false);assert.equal(r.temp.spacingOK,true);
 r=C.calculate({...base,tempBar:'D13',tempSpacing:460});assert.equal(r.temp.areaOK,true);assert.equal(r.temp.spacingOK,false);
 r=C.calculate({...base,tempSpacing:30});assert.equal(r.temp.clearOK,false);assert.equal(r.temp.ok,false);
 assert.equal(C.AGGREGATE,25);
});
