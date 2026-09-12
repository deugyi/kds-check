const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../wind.js');
const p={H:30,B:20,D:30,V0:34,Kzt:1,Kd:1,stories:10,importance:'II',terrain:'B',design:'strength',xFrequency:1.5,yFrequency:1.5,xDamping:.02,yDamping:.02,beta:1,massMode:'uniform',massRatio:1/3,area:2,z:15,internal:'sealed'};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('500-year velocity, density and 2022 importance factors',()=>{
 const r=W.common({...p,H:10,terrain:'C',importance:'I'});near(r.Kr,1);near(r.VH,34);near(r.qH,.70805);
 near(W.common({...p,Kd:.85}).qH/W.common(p).qH,.85**2);
 near(W.importance({...p,stories:50}),1.05);near(W.importance({...p,H:200}),1.05);near(W.importance({...p,importance:'special'}),1);near(W.importance({...p,importance:'III'}),.9);
});
test('terrain table boundaries and cladding low-rise exposure substitution',()=>{
 for(const t of Object.values(W.TERRAIN)){near(W.kr(t.zb,t),t.base);near(W.kr(t.zb+.01,t),t.c*(t.zb+.01)**t.alpha);near(W.kz(0,t.zb,t),1);}
 for(const terrain of ['A','B','C']){const r=W.cladding({...p,terrain,H:19,z:10});assert.equal(r.effectiveTerrain,'C');near(r.Kd,1);}
 assert.equal(W.cladding({...p,terrain:'A',H:20}).effectiveTerrain,'A');assert.equal(W.cladding({...p,terrain:'D',H:19,z:10}).effectiveTerrain,'D');
});
test('enclosed building uses net windward-minus-leeward force, not one wall',()=>{
 const r=W.main({...p,H:10,B:20,D:20,terrain:'C',importance:'I',stories:5});assert.equal(r.valid,true);const a=r.axes.x;
 near(a.GD,2.1190061187704563);near(a.V,390.09419342280967);near(a.M,1950.4709671140483);near(a.V,a.GD*.70805*1.3*20*10);near(a.M,a.V*5);near(a.rows[0].F,a.V/5);near(a.rows.at(-1).shear,a.V);near(a.rows.at(-1).overturning,a.M);
 near(a.V,r.axes.y.V);near(a.M,r.axes.y.M);
});
test('integration is independent of floor count and X/Y swap preserves direction results',()=>{
 const r=W.main(p),many=W.main({...p,stories:40}),swap=W.main({...p,B:p.D,D:p.B});near(r.axes.x.V,many.axes.x.V,1e-6);near(r.axes.x.M,many.axes.x.M,1e-6);near(r.axes.x.V,swap.axes.y.V);near(r.axes.y.M,swap.axes.x.M);
 const y=r.axes.y;near(y.leeward,-.5);near(r.axes.x.leeward,-.35);near(r.axes.x.offset,.05);
});
test('flexible gust branch at 1 Hz includes generalized-mass mode correction',()=>{
 const r=W.main({...p,xFrequency:1,yFrequency:1.001});assert.equal(r.axes.x.mode,'유연');assert.equal(r.axes.y.mode,'강체');near(r.axes.x.phi,1);
 const a=W.main({...p,xFrequency:.3,beta:1.5}),b=W.main({...p,xFrequency:.3,beta:1.5,massMode:'direct',massRatio:.25});near(a.axes.x.GD,b.axes.x.GD);near(a.axes.x.phi,(1-.4*Math.log(1.5))*4/3.5);
 assert.ok(W.main({...p,xFrequency:.3,xDamping:.01}).axes.x.GD>W.main({...p,xFrequency:.3,xDamping:.05}).axes.x.GD);
});
test('high and low cladding peak chart endpoints and logarithmic interpolation',()=>{
 near(W.peak({...p,area:2},'corner').neg,-3.6);near(W.peak({...p,area:50},'corner').neg,-2);near(W.peak({...p,area:10},'wall').pos,1.5);
 near(W.peak({...p,area:1},'roofCorner').neg,-6.4);near(W.peak({...p,area:50},'roofCorner').neg,-4.6);
 near(W.peak({...p,H:19,area:1},'wall').neg,-2.2);near(W.peak({...p,H:19,area:50},'corner').neg,-1.6);
 near(W.peak({...p,H:19,area:10},'roofCorner').neg,-2.25);near(W.peak({...p,H:19,area:100},'roofCorner').neg,-2.25);
 assert.equal(W.peak(p,'roof').pos,null);
});
test('cladding internal signs, height factor only on positive wall external pressure',()=>{
 const r=W.cladding({...p,internal:'one'}),v=r.rows[0];near(v.rawPos,r.qH*(v.k*v.pos+.8));near(v.rawNeg,r.qH*(v.neg-1.4));
 const high=W.cladding({...p,z:30});near(high.rows[0].negative,W.cladding(p).rows[0].negative);assert.ok(high.rows[0].positive>=W.cladding(p).rows[0].positive);
 assert.equal(r.rows[2].positive,null);near(r.rows[2].Fneg,r.rows[2].negative*p.area);
});
test('minimum pressure precedes ASD factor, and area scales forces',()=>{
 const r=W.cladding({...p,V0:1,design:'asd'});near(r.rows[0].positive,.675*.65);near(r.rows[0].negative,-.675*.65);near(r.rows[0].Fpos,.675*.65*2);
 near(W.main({...p,design:'asd'}).axes.x.V/W.main(p).axes.x.V,.65);
});
test('invalid and out-of-scope conditions cannot produce design results',()=>{
 for(const v of [{H:NaN},{Kd:.8},{Kzt:.9},{stories:0},{xFrequency:0},{xFrequency:.5,xDamping:0},{H:300,B:1,D:1},{H:551,terrain:'A',B:100,D:100}])assert.equal(W.main({...p,...v}).valid,false,JSON.stringify(v));
 for(const v of [{z:31},{area:0},{area:NaN},{internal:'unknown'},{H:0}])assert.equal(W.cladding({...p,...v}).valid,false);
});
