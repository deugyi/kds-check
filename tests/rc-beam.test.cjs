const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../rc-beam.js');
const base={b:400,h:600,fck:24,fy:400,bar:'D25',stirrup:'D10',cover:40,aggregate:25};
function near(a,b,t=1e-7){assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);}
test('single yielded layer agrees with independent closed-form moment',()=>{
  const o=R.calculate(base),r=o.results.find(x=>x.total===4);
  // 4-D25: As=2026.8; d=600-40-9.53-25.4/2=537.77.
  near(r.As,2026.8);near(r.d,537.77);near(r.phiMn,336.35110824);
  near(r.c,(2026.8*400/(.85*24*400))/.8);near(r.phi,.85);
});
test('selected stirrup changes packing at the width boundary',()=>{
  assert.equal(R.geometry({...base,b:360,stirrup:'D10'}).perLayer,5);
  assert.equal(R.geometry({...base,b:360,stirrup:'D13'}).perLayer,4);
  assert.equal(R.geometry({...base,b:360,stirrup:'D16'}).perLayer,4);
  near(R.geometry({...base,stirrup:'D16'}).edge-R.geometry(base).edge,6.37);
});
test('maximum-width packing boundary never rounds up infeasible count',()=>{
  const limit=2*(40+9.53)+5*25.4+4*(100/3);
  assert.equal(R.geometry({...base,b:limit}).perLayer,5);
  assert.equal(R.geometry({...base,b:limit-.001}).perLayer,4);
});
test('all representative layouts obey spacing, cover, symmetry, alignment and 3-layer limit',()=>{
  for(const b of [160,240,300,400,650])for(const stirrup of R.STIRRUPS)for(const bar of ['D16','D25','D35']){
    const p={...base,b,stirrup,bar},o=R.calculate(p),g=o.g;
    for(const r of o.results){
      assert.ok(r.layers.length<=3);assert.equal(r.total,r.layers.reduce((s,l)=>s+l.count,0));
      r.layers.forEach((l,i)=>{
        assert.ok(l.d>=g.edge-1e-8&&l.d<=p.h-g.edge+1e-8);
        const xs=l.xs;
        xs.forEach((x,j)=>{assert.ok(x>=g.edge-1e-8&&x<=p.b-g.edge+1e-8);near(x+xs[xs.length-1-j],p.b);if(j)assert.ok(x-xs[j-1]-g.bar.diameter>=g.horizontalClear-1e-8);if(i)assert.ok(r.layers[i-1].xs.some(v=>Math.abs(v-x)<1e-8));});
        if(i)assert.ok(r.layers[i-1].d-l.d-g.bar.diameter>=g.verticalClear-1e-8);
      });
    }
  }
});
test('multi-layer equilibrium uses individual steel stresses',()=>{
  const p={...base,b:400,h:600},o=R.calculate(p),r=o.results.at(-1);
  assert.ok(Math.abs(r.force)<1e-4);assert.equal(r.layers.length,3);
  const C=.85*p.fck*p.b*r.a;
  const T=r.layers.reduce((sum,l,i)=>sum+l.count*o.g.bar.area*r.stresses[i],0);
  near(C,T,.001);
  const Mn=r.layers.reduce((sum,l,i)=>sum+l.count*o.g.bar.area*r.stresses[i]*(l.d-r.a/2),0)/1e6;
  near(r.Mn,Mn);assert.ok(r.stresses.some(s=>s<400));
});
test('over-reinforced layouts remain flagged even though they fit',()=>{
  const rows=R.calculate(base).results;
  assert.ok(rows.find(r=>r.total===7).eligible);
  assert.equal(rows.find(r=>r.total===8).ductile,false);
});
test('higher steel grade changes ductility limits; concrete table interpolates',()=>{
  const r=R.calculate({...base,fy:600}).results[0];near(r.etl,.0075);near(r.emin,.006);
  const k=R.concrete(45);near(k.ecu,.00325);near(k.eta,.985);near(k.beta,.8);
  near(R.concrete(90).beta,.70);assert.throws(()=>R.concrete(100));
});
test('minimum flexural reinforcement criterion is actually checked',()=>{
  const r=R.calculate({...base,bar:'D10'}).results[0];
  near(r.minMoment,1.2*.63*Math.sqrt(24)*400*600**2/6/1e6);
  assert.equal(r.minimum,false);assert.equal(r.eligible,false);
});
test('zero, empty-equivalent, unsupported and non-finite inputs are rejected',()=>{
  for(const k of ['b','h','fck','fy','cover','aggregate'])for(const v of [0,-1,NaN,Infinity])assert.throws(()=>R.calculate({...base,[k]:v}));
  assert.throws(()=>R.calculate({...base,stirrup:'D19'}));assert.throws(()=>R.calculate({...base,bar:'D99'}));
  assert.throws(()=>R.calculate({...base,fck:100}));assert.throws(()=>R.calculate({...base,aggregate:100}));
});
test('insufficient width/height return no fabricated capacity',()=>{
  assert.equal(R.calculate({...base,b:130,aggregate:20}).results.length,0);
  assert.equal(R.calculate({...base,h:100,aggregate:20}).results.length,0);
  assert.equal(R.calculate({...base,h:180}).g.maxLayers,1);
});
