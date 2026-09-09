const {test}=require('node:test');
const assert=require('node:assert/strict');
const CB=require('../composite-beam.js'),SL=require('../rc-slab-uplift.js'),C=require('../rc-column.js');
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const beam={H:600,B:200,tw:11,tf:17,Fy:345,E:210000,rolled:true,J:null,span:9000,spacing:3000,edge:null,ts:150,hr:0,fck:30,wc:2300,stud:'D19',Fu:400,studsPerRow:2,studSpacing:200,studTransverseSpacing:100,studLength:100,Mu:1200,Vu:400,MuConstruction:300,LbConstruction:3000,CbConstruction:1};
const slab={l1:8200,l2:8200,footing:3000,h:300,hw:2,gammaW:9.81,gammaC:24,qsd:3.45,liveLoad:10,loadCase:'both',fck:24,fy:500,coverTop:50,coverBottom:50,bar:'D13',spacing:200,spanType:'interior',endCase:0};
test('stud positions count each half span once and include integer boundary changes',()=>{
 const o=CB.calculate(beam),l=o.layout;
 assert.equal(l.rowsPerHalf,22);assert.equal(l.count,44);assert.equal(l.total,88);near(l.endGap,150);near(l.centreGap,300);
 near(o.stud.stud.a,Math.PI*19**2/4);near(o.shearFlow.studs,44*Math.PI*19**2/4*.75*400/1000);
 assert.equal(CB.calculate({...beam,span:8799}).layout.count,42);
 assert.equal(CB.calculate({...beam,span:8800}).layout.count,44);
});
test('invalid stud spacing or transverse packing prevents an overall pass',()=>{
 for(const p of [{studSpacing:100},{studTransverseSpacing:50},{studsPerRow:3},{studLength:50}]){
  const o=CB.calculate({...beam,...p});assert.equal(o.detail.ok,false);assert.equal(o.ok,false);
 }
 for(const p of [{studsPerRow:1.5},{studSpacing:NaN},{studSpacing:5000},{wc:0},{studLength:NaN}])assert.throws(()=>CB.calculate({...beam,...p}));
 assert.equal(CB.calculate({...beam,studsPerRow:1,studTransverseSpacing:NaN}).detail.ok,true);
 const centre=CB.calculate({...beam,span:10000,studSpacing:800});
 assert.equal(centre.detail.ok,false);assert.ok(centre.detail.reasons.some(x=>x.includes('보 중앙')));
});
test('composite plastic strength agrees with independent numerical stress integration',()=>{
 for(const studsPerRow of [1,2,4]){
  const o=CB.calculate({...beam,studsPerRow,B:400});
  // Numerical integration of stresses about steel mid-depth, no steelSlice/PNA moment helper.
  const p={...beam,B:400},dy=.02,c=o.plastic.pna??0;
  let force=0,moment=0;
  for(let y=dy/2;y<p.H;y+=dy){const width=y<p.tf||y>p.H-p.tf?p.B:p.tw;const f=width*dy*(y<c?p.Fy:-p.Fy);force+=f;moment+=f*(p.H/2-y);}
  const cf=o.shearFlow.V*1000,cy=-p.ts+o.plastic.a/2;
  near((moment+cf*(p.H/2-cy))*.9/1e6,o.phiMn,0.5);
  near((force+cf)/1000,0,4);
 }
});
test('slab compares both loads with independent arithmetic and reversed tension faces',()=>{
 const o=SL.calculate(slab);near(o.load.dead,10.65);near(o.load.qu,21.807);near(o.load.gravity,28.78);
 const up=o.combinations[0].directions[0],down=o.combinations[1].directions[0];
 near(down.Mo,28.78*8.2*5.33**2/8);
 near(down.rows.find(r=>r.strip==='column'&&r.face==='top').Mu,28.78*8.2*5.33**2/8*.65*.75/4.1);
 assert.equal(down.rows.find(r=>r.key==='positive').face,'bottom');assert.equal(up.rows.find(r=>r.key==='positive').face,'top');
 for(const r of o.directions[0].rows){const values=[up,down].map(d=>d.rows.find(x=>x.strip===r.strip&&x.face===r.face).Mu);near(r.Mu,Math.max(...values));}
});
test('no uplift still checks gravity, zero live load is allowed, and invalid demand is rejected',()=>{
 const o=SL.calculate({...slab,hw:0});assert.equal(o.combinations.length,1);assert.equal(o.combinations[0].key,'gravity');assert.equal(o.directions.length,2);
 near(SL.calculate({...slab,liveLoad:0}).load.gravity,12.78);
 for(const liveLoad of [-1,NaN,Infinity])assert.throws(()=>SL.calculate({...slab,liveLoad}));
 const limited=SL.calculate({...slab,liveLoad:100});assert.equal(limited.limits.ok,false);assert.ok(limited.directions.every(d=>d.rows.every(r=>r.suggestion===null)));
});
test('slab gravity face envelope covers asymmetric end span support sections',()=>{
 const o=SL.calculate({...slab,spanType:'end',endCase:2});
 for(const c of o.combinations)for(const d of c.directions)for(const r of d.rows){
  if(r.key!=='positive')near(r.Mu,Math.max(...d.support.filter(x=>x.strip===r.strip).map(x=>x.Mu)));
 }
});
test('circular column concrete block agrees with numerical area integration',()=>{
 const sec={shape:'circle',D:600,depth:600,dt:550,lay:[[1000,50],[1000,300],[1000,550]]};
 for(const c of [120,300,600]){
  const o=C.pmcCircle(sec,30,500,c,'tie'),dy=.002,depth=Math.min(.8*c,600);
  let P=0,M=0;
  for(let y=dy/2;y<depth;y+=dy){const width=2*Math.sqrt(300**2-(y-300)**2),f=25.5*width*dy;P+=f;M+=f*(300-y);}
  for(const [As,d] of sec.lay){let fs=Math.max(-500,Math.min(500,200000*.0033*(c-d)/c));if(d<=depth&&fs>0)fs-=25.5;P+=As*fs;M+=As*fs*(300-d);}
  near(P/1000,o.Pn,.02);near(M/1e6,o.Mn,.005);
 }
});
