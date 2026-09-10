const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../transfer-beam.js');
const base=()=>({b:800,h:1500,span:8,fy:500,fyt:400,fyd:400,heights:[750,750],strengths:{1:[24],2:[24,24]},release:1,deadFactor:1.4,bar:'D32',stirrup:'D13',counts:[8,0,0],legs:4,stirrupSpacing:200,cover:40,aggregate:25,dowel:'D19',dowelCount:0,dowelSpacing:200,crossAnchored:false,dowelAnchored:false});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('wet second lift increases demand without crediting fresh concrete strength or depth',()=>{
 const rows=T.calculate(base()).phases;
 assert.equal(rows[0].status,'shored');near(rows[1].D,14.4);near(rows[1].M,161.28);near(rows[2].M,322.56);near(rows[2].V,161.28);
 assert.equal(rows[2].H,750);assert.equal(rows[2].loaded,1500);near(rows[1].r.phiMn,rows[2].r.phiMn);assert.ok(rows[3].r.phiMn>rows[2].r.phiMn);
});
test('release after second cure keeps earlier phases shored and requires second-stage measurements',()=>{
 const p=base();p.release=2;delete p.strengths[1];const rows=T.calculate(p).phases;
 assert.ok(rows.slice(0,3).every(r=>r.status==='shored'));assert.equal(rows[3].status,'calculated');
 delete p.strengths[2];assert.equal(T.calculate(p).phases[3].status,'missing');
});
test('unknown, zero and unsupported early strengths never become a pass',()=>{
 for(const fc of [null,0,15,91]){const p=base();p.strengths[2]=[24,fc];assert.equal(T.calculate(p).phases[3].status,'missing');}
});
test('deep beam aspect ratio prevents ordinary beam adequacy judgement',()=>{
 const p=base();p.span=6;const r=T.calculate(p).phases[3];assert.equal(r.status,'outside');assert.equal(r.deep,true);
});
test('mid-depth uncracked shear flow matches 1.5 V / h and friction demand uses per-metre units',()=>{
 const r=T.calculate(base()).phases[3],j=r.interfaces[0];near(j.qGross,1.5*r.V*1000/1500);near(j.requiredArea,j.demand*1000/(.75*400));
 assert.equal(j.neededCount,Math.ceil(j.requiredArea*.2/286.5));
});
test('unconfirmed steel gives no friction resistance; existing anchored stirrups can remove extra demand',()=>{
 const p=base();p.dowelCount=2;const a=T.calculate(p).phases[3].interfaces[0];near(a.available,0);
 p.dowelAnchored=true;const b=T.calculate(p).phases[3].interfaces[0];near(b.available,.75*2*286.5*5*400/1000);assert.equal(b.ok,true);
 p.dowelCount=0;p.crossAnchored=true;const c=T.calculate(p).phases[3].interfaces[0];near(c.existing,.75*4*126.7*5*400/1000);near(c.requiredArea,0);
});
test('friction steel is capped at 500 MPa and concrete interface cap cannot be overcome by adding steel',()=>{
 const p=base();p.fyd=600;p.dowelCount=100;p.dowelAnchored=true;
 const j=T.calculate(p).phases[3].interfaces[0];near(j.available,j.cap);near(j.requiredArea,j.demand*1000/(.75*500));assert.equal(j.ok,false);
});
test('different stage strengths use the minimum for strength and distinct stiffness in interface flow',()=>{
 const p=base();const equal=T.calculate(p).phases[3];p.strengths[2]=[40,24];const mixed=T.calculate(p).phases[3];
 near(equal.r.phiMn,mixed.r.phiMn);assert.notEqual(equal.interfaces[0].qGross,mixed.interfaces[0].qGross);near(equal.interfaces[0].cap,mixed.interfaces[0].cap);
});
test('invalid geometry, release or reinforcement cannot produce capacity results',()=>{
 for(const patch of [{release:0},{heights:[500,500]},{dowelCount:-1},{span:0}])assert.throws(()=>T.calculate({...base(),...patch}));
 const p=base();p.counts=[50,0,0];assert.equal(T.calculate(p).phases[1].status,'missing');
});

test('only the confirmed effective stirrup legs contribute as dowel reinforcement',()=>{
 const p=base();p.crossAnchored=true;p.crossLegs=2;
 let j=T.calculate(p).phases[3].interfaces[0];near(j.existing,.75*2*126.7*5*400/1000);
 p.crossLegs=0;j=T.calculate(p).phases[3].interfaces[0];near(j.existing,0);assert.ok(j.requiredArea>0);
 p.crossLegs=5;assert.throws(()=>T.calculate(p));p.crossLegs=1.5;assert.throws(()=>T.calculate(p));
});
