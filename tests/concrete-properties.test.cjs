const {test}=require('node:test'),a=require('node:assert/strict'),E=require('../concrete-properties.js');
const near=(x,y)=>a.ok(Math.abs(x-y)<1e-8*Math.max(1,Math.abs(y)),`${x} != ${y}`);
test('KDS modulus strength correction boundaries and direct mean strength',()=>{
 for(const [fck,delta] of [[30,4],[40,4],[50,5],[60,6],[80,6]]){const r=E.modulus({strength:fck});a.equal(r.delta,delta);near(r.Ec,8500*(fck+delta)**(1/3));near(r.Eci,1.18*r.Ec);near(E.modulus({strength:fck+delta,basis:'fcm'}).Ec,r.Ec);}
 near(E.modulus({strength:23}).Ec,25500);
});
test('KDS density formula uses cube root and checks its density range',()=>{
 for(const density of [1450,2300,2500])near(E.modulus({strength:23,basis:'fcm',method:'density',density}).Ec,.077*density**1.5*23**(1/3));
 for(const density of [1449,2501,NaN])a.throws(()=>E.modulus({method:'density',density}));
 for(const strength of [0,-1,NaN,Infinity,'30'])a.throws(()=>E.modulus({strength}));
});
test('EN characteristic classes are discrete pairs with nonconstant ratios',()=>{
 a.equal(E.classes.length,16);a.deepEqual(E.strengthClass('C30/37'),{name:'C30/37',cylinder:30,cube:37,ratio:30/37});a.equal(E.strengthClass('C50/60').ratio,5/6);a.equal(E.strengthClass('C8/10').cylinder,8);a.equal(E.strengthClass('C100/115').cube,115);a.throws(()=>E.strengthClass('C32/40'));
});
test('user coefficient estimate converts in either direction and rejects invalid data',()=>{
 a.equal(E.convert({strength:40}).result,32);near(E.convert({strength:32,direction:'cylinder-cube'}).result,40);
 for(const c of E.classes){near(E.convert({strength:c.cube,ratio:c.cylinder/c.cube}).result,c.cylinder);near(E.convert({strength:c.cylinder,ratio:c.cylinder/c.cube,direction:'cylinder-cube'}).result,c.cube);}
 for(const ratio of [0,-1,NaN,Infinity])a.throws(()=>E.convert({strength:40,ratio}));a.throws(()=>E.convert({strength:0}));a.throws(()=>E.convert({strength:Number.MAX_VALUE,ratio:2}));a.throws(()=>E.convert({strength:1,direction:'bad'}));
});
