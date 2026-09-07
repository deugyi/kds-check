const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../rc-beam.js'),C=require('../rc-beam-checks.js');
const base={b:400,h:600,fck:24,fy:400,fyt:400,bar:'D25',stirrup:'D10',cover:40,aggregate:25,compressionCount:0,compressionBar:'D25',legs:2,stirrupSpacing:200,Vu:null,skinMode:'auto',skinBar:'D13',skinCount:2,environment:'other',concretePrice:120000,steelPrice:1300000,wastePercent:0,stirrupCutLength:null};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
function sample(p=base,n=4){const o=R.calculate(p);return {g:o.g,r:o.results.find(r=>r.total===n)};}
test('1m concrete, longitudinal steel, transverse steel and unit costs match independent arithmetic',()=>{
  const {g,r}=sample(),sk=C.skin(base,g,r),q=C.quantities(base,g,r,sk);
  near(q.concrete,.24);near(q.tension,4*506.7/1e6*7.85);
  const length=2*(400-80-9.53+600-80-9.53)+150;
  near(q.stirrups,71.33/1e6*(length/1000)*5*7.85);
  near(q.totalCost,.24*120000+(q.tension+q.stirrups)*1300000);
});
test('quantity counts compression, both skin faces, internal ties, waste and manual cut length',()=>{
  const p={...base,h:1000,compressionCount:2,legs:6,wastePercent:5,stirrupCutLength:4000}, {g,r}=sample(p),sk=C.skin(p,g,r),q=C.quantities(p,g,r,sk);
  near(q.compression,2*506.7*7.85e-6);near(q.skin,2*sk.count*126.7*7.85e-6);
  near(q.stirrups,71.33*4*5*7.85e-6);near(q.steel,q.netSteel*1.05);
  const two=C.quantities({...p,legs:2,stirrupCutLength:null},g,r,sk),six=C.quantities({...p,stirrupCutLength:null},g,r,sk);
  near(six.cutLength-two.cutLength,4*(1000-80-9.53+150));
});
test('stirrups are averaged over 1m without double-counting end stations',()=>{
  const {g,r}=sample(),p={...base,stirrupSpacing:300},q=C.quantities(p,g,r,C.skin(p,g,r));near(q.stations,10/3);
});
test('shear matches KDS concrete and vertical stirrup formulas',()=>{
  const {g,r}=sample(),v=C.shear({...base,Vu:100},g,r),d=537.77;
  near(v.Av,142.66);near(v.Vc,Math.sqrt(24)*400*d/6000);near(v.Vs,142.66*400*d/200/1000);near(v.phiVn,.75*(v.Vc+v.Vs));
  near(v.avMin,.35*400*200/400);assert.equal(v.ok,true);near(v.ratio,100/v.phiVn);
});
test('two to six legs change Av and enforce halved spacing and Vs upper bound',()=>{
  const {g,r}=sample();for(let legs=2;legs<=6;legs++)near(C.shear({...base,legs},g,r).Av,legs*71.33);
  const high=C.shear({...base,legs:6},g,r);near(high.maxSpacing,r.d/4);assert.ok(high.reasons.some(x=>x.includes('간격')));
  const cap=C.shear({...base,legs:6,stirrupSpacing:25},g,r);assert.ok(cap.Vs>cap.VsMax);near(cap.phiVn,.75*(cap.Vc+cap.VsMax));assert.equal(cap.ok,false);
});
test('minimum shear steel, optional demand and high-strength concrete cap are explicit',()=>{
  const p={...base,fck:90,b:2000,stirrupSpacing:600},{g,r}=sample(p),v=C.shear(p,g,r);
  assert.equal(v.minimum,false);near(v.Vc,8.4*p.b*r.d/6000);assert.equal(v.Vu,null);
  const dense=C.shear({...p,legs:6,stirrupSpacing:50},g,r);assert.equal(dense.minimum,true);near(dense.Vc,Math.sqrt(90)*p.b*r.d/6000);
  assert.equal(C.shear({...base,Vu:9999},sample().g,sample().r).ok,false);
});
test('skin threshold is strictly over 900mm and automatic spacing uses KDS environment coefficient',()=>{
  for(const h of [900,901,1000,1400]){
    const p={...base,h},{g,r}=sample(p),sk=C.skin(p,g,r);assert.equal(sk.required,h>900);
    near(sk.maxSpacing,Math.min(375*210/(400*2/3)-2.5*49.53,300*210/(400*2/3)));
    if(h>900){assert.ok(sk.ok);assert.equal(sk.total,2*sk.count);assert.ok(sk.spacing<=sk.maxSpacing);assert.ok(sk.points.every(pt=>pt.d>=h/2&&pt.d<r.layers[0].d));}
    else assert.equal(sk.total,0);
  }
  const p={...base,h:1000},{g,r}=sample(p);assert.ok(C.skin({...p,environment:'dry'},g,r).maxSpacing>C.skin(p,g,r).maxSpacing);
});
test('missing skin steel and overly sparse manual placement do not pass',()=>{
  const p={...base,h:1400},{g,r}=sample(p);
  assert.equal(C.skin({...p,skinMode:'none'},g,r).ok,false);
  assert.equal(C.skin({...p,skinMode:'manual',skinCount:1},g,r).ok,false);
});
test('skin auto-placement clears main layers with one to three tensile layers',()=>{
  const p={...base,h:1000},out=R.calculate(p);
  for(const r of out.results){const sk=C.skin(p,out.g,r);assert.ok(sk.ok);for(const pt of sk.points)for(const l of r.layers)for(const x of l.xs)assert.ok(Math.hypot(pt.x-x,pt.d-l.d)>(sk.bar.diameter+out.g.bar.diameter)/2);}
});
test('invalid shear, pricing and quantity inputs are rejected without fabricated values',()=>{
  const {g,r}=sample(),sk=C.skin(base,g,r);
  for(const q of [{legs:7},{legs:1},{legs:2.5},{fyt:600},{Vu:-1},{Vu:NaN},{stirrupSpacing:0}])assert.throws(()=>C.shear({...base,...q},g,r));
  for(const q of [{concretePrice:-1},{steelPrice:NaN},{wastePercent:101},{stirrupCutLength:0},{stirrupSpacing:0}])assert.throws(()=>C.quantities({...base,...q},g,r,sk));
});
