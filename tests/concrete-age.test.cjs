const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../concrete-age.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('KDS age estimate independently matches temperature, mean and applied-strength arithmetic',()=>{
 const r=A.estimate(30,'normal',20,7),te=7*Math.exp(13.65-4000/293),mean=34*Math.exp(.35*(1-Math.sqrt(28/te)));
 near(r.equivalentDays,te);near(r.mean,mean);near(r.applied,mean-4);assert.ok(r.applied<21);
});
test('time, curing temperature and cement type affect development in the expected direction',()=>{
 const f=(t,c='normal',T=20)=>A.estimate(30,c,T,t).applied;
 assert.ok(f(14)>f(7));assert.ok(f(7,'normal',30)>f(7,'normal',10));assert.ok(f(7,'rapid')>f(7));assert.ok(f(7)>f(7,'moderate'));
});
test('zero age has no strength; long-term applied strength does not exceed reference',()=>{
 near(A.estimate(30,'normal',20,0).applied,0);near(A.estimate(30,'normal',40,365).applied,30);
 near(A.estimate(50,'normal',20,7).delta,5);near(A.estimate(70,'normal',20,7).delta,6);
});
test('each previous pour accumulates elapsed days at every later review',()=>{
 const r=A.schedule(30,'normal',20,[7,3,14]);
 assert.deepEqual(r.details[1].map(x=>x.days),[7]);assert.deepEqual(r.details[2].map(x=>x.days),[10,3]);assert.deepEqual(r.details[3].map(x=>x.days),[24,17,14]);
 near(r.strengths[3][0],A.estimate(30,'normal',20,24).applied);
});
test('invalid estimation inputs never create artificial strength',()=>{
 for(const T of [NaN,0,41])assert.throws(()=>A.estimate(30,'normal',T,7));
 for(const d of [NaN,-1,Infinity])assert.throws(()=>A.estimate(30,'normal',20,d));
 assert.throws(()=>A.estimate(30,'unknown',20,7));assert.throws(()=>A.schedule(30,'normal',20,[7,NaN]));
});
