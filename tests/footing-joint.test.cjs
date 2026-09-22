const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../footing-joint.js'),F=require('../rc-footing.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const base=()=>({...E.clone(E.defaults),strengthMode:'manual',strengths:{1:[30],2:[30,30]}});
test('additional dowel quantities count one vertical bar per grid point and use development length',()=>{
 const r=E.calculate({...base(),crossLegs:0}),q=r.quantities,v=q.rows[0];
 assert.equal(q.complete,true);assert.equal(v.status,'ready');assert.equal(v.spacing,600);assert.equal(v.nx,6);assert.equal(v.ny,6);assert.equal(v.count,36);
 near(v.sx,(3000-2*(80+15.9/2))/5);assert.ok(v.sx<=v.spacing&&v.sy<=v.spacing);
 const ld=E.development(r.p,'D16',500,30,Math.min(v.sx,v.sy),670).required;
 const leg=Math.ceil(ld/10)*10;near(v.length,2*leg);near(v.totalLength,36*2*leg/1000);
 near(v.kg,v.totalLength*198.6*.00785);near(v.tonf,v.kg/1000);near(q.total.tonf,v.tonf);
 assert.ok(v.lo<=670&&v.up<=670);
});
test('quantity uses actual automatic pile dimensions and full mat area, not the one metre analysis strip',()=>{
 const pile=E.calculate({...base(),mode:'pile',pileCount:3,crossLegs:0}),v=pile.quantities.rows[0];
 assert.equal(v.status,'ready');assert.equal(v.nx,Math.ceil((pile.g.bx-175.9)/v.spacing)+1);assert.equal(v.ny,Math.ceil((pile.g.by-175.9)/v.spacing)+1);
 const mat=E.calculate({...base(),mode:'mat',bx:6000,by:4000,crossLegs:0}),m=mat.quantities.rows[0];
 assert.equal(m.status,'ready');near(mat.quantities.area,24);assert.equal(m.count,m.nx*m.ny);assert.ok(m.count>121);
});
test('quantity envelopes stages once per interface and sums distinct interfaces only',()=>{
 const p={...base(),crossLegs:0,h:2250,strengths:{1:[30],2:[30,30],3:[30,30,30]}};
 p.stages=[...p.stages,E.clone(p.stages[1])];p.stages[1].load=50;
 const r=E.calculate(p),q=r.quantities;assert.equal(q.complete,true);assert.equal(q.rows.length,2);
 assert.ok(r.joints[0].all.length>1);assert.equal(q.total.count,q.rows[0].count+q.rows[1].count);
 near(q.total.totalLength,q.rows[0].totalLength+q.rows[1].totalLength);
});
test('unnecessary bars are zero but unknown or infeasible designs are not zero quantities',()=>{
 const zero=E.calculate(base()).quantities;assert.equal(zero.complete,true);assert.equal(zero.total.count,0);assert.equal(zero.rows[0].status,'none');
 for(const p of [{...base(),strengths:{}},{...base(),crossLegs:0,Pu:1e8}]){
  const q=E.calculate(p).quantities;assert.equal(q.complete,false);assert.equal(q.rows[0].status,'blocked');assert.equal(q.rows[0].count,null);assert.equal(q.rows[0].tonf,null);
 }
 const r=E.calculate({...base(),crossLegs:0});
 const q=E.quantities(r.p,r.g,[r.joints[0],{...r.joints[0],index:1,blocked:true}],r.phases);
 assert.equal(q.complete,false);near(q.total.tonf,r.quantities.total.tonf);
});
test('soil self-weight cancels from net strip forces, while total bearing grows with wet lift',()=>{
 const r=E.calculate(base()),a=r.phases[1],b=r.phases[2];
 near(a.axes[0].Mu,0);near(b.axes[0].Vu,0);near(a.W,162);near(b.W,324);near(a.bearing.value,18);near(b.bearing.value,36);
 assert.equal(b.H,750);assert.equal(b.loaded,1500);assert.equal(b.interfaces.length,0);near(a.checks[0].phiMn,b.checks[0].phiMn);
});
test('soil final forces match an independent uniform cantilever strip',()=>{
 const r=E.calculate(base()).phases.at(-1),q=2100/9,l=1.2;
 near(r.axes[0].Mu,q*l*l/2);near(r.axes[0].Vu,q*l);near(r.axes[0].Vd,0);
 near(r.totalS,1500+324);near(r.totalU,2100+1.2*324);
});
test('load release percentage uses previous cured stage during a pour',()=>{
 const p=base();p.stages[0].load=25;p.stages[1].load=80;const r=E.calculate(p);
 near(r.phases[1].Nu,525);near(r.phases[2].Nu,525);near(r.phases[3].Nu,1680);
});
test('three-pile reactions balance force and eccentric wet self-weight moments',()=>{
 const p={...base(),mode:'pile',pileCount:3};const o=E.calculate(p),r=o.phases[2];
 near(r.piles.reduce((a,v)=>a+v.Ru,0),r.totalU);
 near(r.piles.reduce((a,v)=>a+v.Ru*v.x,0),1.2*r.W*o.g.footingX/1000);
 near(r.piles.reduce((a,v)=>a+v.Ru*v.y,0),1.2*r.W*o.g.footingY/1000);
 assert.equal(o.g.bx,2500);assert.equal(o.g.by,2350);assert.ok(r.axes.some(a=>Math.abs(a.Mu)>0));
});
test('four-pile interface force uses the point-reaction envelope, not a d-cut shear reduction',()=>{
 const r=E.calculate({...base(),mode:'pile'}).phases.at(-1),axis=r.axes[0];
 // At the support line just inside the two far piles, their full reaction acts.
 const Ru=r.totalU/4,w=1.2*r.W/6.25;
 near(axis.Vu,2*Ru/2.5-w*(1.25-.625));
 assert.ok(axis.Vu>axis.Vd);
});
test('gross-section interface stress matches 6 V z(H-z)/H^3 in MPa',()=>{
 const p=base(),H=1500,z=500,V=400;
 const r=E.interfaceStress(p,H,z,[30,30],'X',V,300);near(r.gross,6*V*z*(H-z)/H**3);
});
test('uncracked stress uses the full section regardless of steel or moment sign',()=>{
 const p=base();p.stages[0].height=1000;p.stages[1].height=500;
 for(const axis of ['X','Y'])for(const Mu of [-300,0,300]){
  const r=E.interfaceStress({...p,barX:'D10',barY:'D32',spacing:300},1000,500,[30],axis,-400,Mu);
  near(r.tau,.6);near(r.gross,r.tau);assert.equal(r.model,'uncracked');assert.equal('cracked' in r,false);
 }
});
test('different lift stiffnesses match an independent two-rectangle transformed section',()=>{
 const p=base(),H=1500,z=750,V=400,n=Math.cbrt(44/34);
 // Bottom rectangle Ec30/Ec30=1, top rectangle Ec40/Ec30=n.
 const A1=1000*750,A2=n*A1,y=(A1*1125+A2*375)/(A1+A2);
 const I=(1+n)*1000*750**3/12+A1*(1125-y)**2+A2*(375-y)**2;
 const Q=A2*(y-375),r=E.interfaceStress(p,H,z,[30,40],'X',V,0);
 near(r.tau,V*Q/I);near(r.gross,r.tau);
});
test('mat inputs remain per metre, ignore plan area and are not charged self-weight twice',()=>{
 const p={...base(),mode:'mat',crossLegs:0};let r=E.calculate(p).phases.at(-1);
 near(r.axes[0].Mu,300);near(r.axes[0].Vu,400);near(r.interfaces[0].tau,.4);
 p.bx=12000;p.by=12000;const big=E.calculate(p).phases.at(-1);near(big.interfaces[0].tau,r.interfaces[0].tau);
});
test('biaxial friction demand and extra grid spacing match hand calculation',()=>{
 const r=E.calculate({...base(),mode:'mat',crossLegs:0}).phases.at(-1).interfaces[0];
 near(r.required,.4*1e6/(.75*500));assert.equal(r.proposal.spacing,430);
 near(r.proposal.provided,198.6*1e6/430**2);assert.ok(r.proposal.capacity>=r.tau);
});
test('rough and smooth interfaces use correct friction coefficient and concrete cap',()=>{
 const a=E.calculate({...base(),mode:'mat',crossLegs:0}).phases.at(-1).interfaces[0];
 const b=E.calculate({...base(),mode:'mat',surface:'smooth',crossLegs:0}).phases.at(-1).interfaces[0];
 near(b.required,a.required/.6);near(a.cap,.75*Math.min(6,5.7,11));near(b.cap,.75*5.5);
 assert.ok(b.proposal.spacing<a.proposal.spacing);
});
test('unanchored existing bars do not count despite their large gross area',()=>{
 const p={...base(),mode:'mat',crossBar:'D32',crossLegs:2};const j=E.calculate(p).phases.at(-1).interfaces[0];
 assert.ok(j.area>9000);assert.equal(j.lower.ok,false);assert.equal(j.existingArea,0);assert.equal(j.existing,0);assert.equal(j.status,'proposed');
});
test('thin adjacent pour blocks automatic dowel proposal on straight development length',()=>{
 const p={...base(),mode:'mat',crossLegs:0};p.stages[0].height=1250;p.stages[1].height=250;
 const r=E.calculate(p),j=r.phases.at(-1).interfaces[0];assert.equal(j.status,'anchorage');assert.equal(j.proposal,null);assert.equal(r.joints[0].blocked,true);
});
test('concrete cap cannot be overcome by unlimited existing reinforcement',()=>{
 const p={...base(),mode:'mat',crossLegs:6,crossBar:'D32',crossSX:100,crossSY:100};p.stages[1].cured.vx=100000;
 const j=E.calculate(p).phases.at(-1).interfaces[0];assert.equal(j.status,'cap');assert.equal(j.proposal,null);assert.equal(j.ok,false);
});
test('fresh and unknown-strength phases never become an adequacy result',()=>{
 const p=base();p.strengths[2]=[30,15];const r=E.calculate(p);assert.equal(r.phases[0].status,'fresh');assert.equal(r.phases[3].status,'missing');assert.equal(r.joints[0].missing,true);assert.equal(r.joints[0].blocked,true);
});
test('negative construction moment flags unavailable intermediate top reinforcement',()=>{
 const p={...base(),mode:'mat'};p.stages[0].cured.mx=-10;p.stages[1].cured.mx=-300;
 const r=E.calculate(p);assert.equal(r.phases[1].checks[0].reverseMissing,true);assert.equal(r.phases[3].checks[0].reverseMissing,false);
});
test('bearing exceedance is included in the phase status',()=>{const r=E.calculate({...base(),qa:50});assert.match(r.phases.at(-1).message,/허용지지력 초과/);});
test('invalid heights, units, steel grades and missing forces fail clearly',()=>{
 for(const patch of [{h:1490},{spacing:125},{fyd:600},{crossLegs:-1},{crossSX:0},{fck:NaN}])assert.throws(()=>E.calculate({...base(),...patch}));
 const p={...base(),mode:'mat'};p.stages[1].wet.vx=NaN;assert.throws(()=>E.calculate(p),/단위폭/);
});

test('one installed dowel grid satisfies every demanding phase including anchorage',()=>{
 const p={...base(),mode:'mat',crossLegs:0,h:2250};p.stages.push(E.clone(p.stages[1]));p.strengths[3]=[40,35,30];
 p.stages[2].cured.vx=1600;p.stages[2].cured.vy=1600;
 const r=E.calculate(p),j=r.joints[0];assert.equal(j.blocked,false);assert.ok(j.spacing<300);
 for(const v of j.all.filter(v=>v.required>0)){
  const ph=r.phases.find(a=>a.stage===v.stage&&a.wet===v.wet);
  const lo=E.development(p,p.dowel,p.fyd,ph.values[0],j.spacing,670);
  const up=E.development(p,p.dowel,p.fyd,ph.values[1],j.spacing,670);
  assert.ok(lo.ok&&up.ok);assert.ok(j.lo>=lo.required&&j.up>=up.required);
  assert.ok(198.6*1e6/j.spacing**2>=v.required);
 }
});

test('permanent normal compression gives phi mu sigma credit without treating Pu/A as permanent',()=>{
 const p={...base(),mode:'mat',crossLegs:0};
 const a=E.calculate(p).phases.at(-1).interfaces[0];
 const b=E.calculate({...p,compressionMode:'manual',compression:233}).phases.at(-1).interfaces[0];
 near(b.compressionCapacity,.75*.233);near(a.required-b.required,.233*1e6/500);
 near(b.cap,a.cap);near(b.tau,a.tau);assert.equal(b.existingArea,0);
 const off=E.calculate({...p,compression:999999}).phases.at(-1).interfaces[0];near(off.required,a.required);
 const smooth=E.calculate({...p,surface:'smooth',compressionMode:'manual',compression:233}).phases.at(-1).interfaces[0];near(smooth.compressionCapacity,.75*.6*.233);
});
test('compression can remove extra dowels but cannot raise the concrete interface cap',()=>{
 const p={...base(),mode:'mat',crossLegs:0,compressionMode:'manual',compression:1000};
 const a=E.calculate(p).phases.at(-1).interfaces[0];assert.equal(a.required,0);assert.equal(a.status,'existing');
 p.stages[1].cured.vx=100000;p.compression=1e9;
 const b=E.calculate(p).phases.at(-1).interfaces[0];assert.equal(b.status,'cap');assert.equal(b.ok,false);
 for(const compression of [-1,NaN,Infinity])assert.throws(()=>E.calculate({...p,compression}));
});
test('joint page reports direct punching separately and does not pass eccentric moment transfer',()=>{
 const r=E.calculate({...base(),mode:'pile',pileCount:3}),ph=r.phases.at(-1),j=ph.punching;
 assert.equal(j.status,'eccentric');assert.equal(j.ok,false);assert.ok(j.Mx>0);
 near(j.vu,j.Vu*1000/(2*(j.px+j.py)*j.d));
 const rho=ph.checks.reduce((a,c)=>a+c.As/(1000*c.d),0)/2;
 near(j.phiV,.75*F.punch(ph.fc,j.d,j.px,j.py,rho).vc);
 assert.match(ph.message,/4.11.7/);
});

test('low interface demand reaches the 600 mm cap and quantity follows the wider grid',()=>{
 const p={...base(),mode:'mat',crossLegs:0};
 p.stages[1].cured.vx=50;p.stages[1].cured.vy=50;
 const r=E.calculate(p),j=r.phases.at(-1).interfaces[0],q=r.quantities.rows[0];
 assert.equal(j.proposal.spacing,600);assert.ok(j.proposal.capacity>=j.tau);
 assert.equal(q.nx,6);assert.equal(q.ny,6);assert.equal(q.count,36);
 assert.ok(q.sx<=600&&q.sy<=600);assert.ok(q.lo<=670&&q.up<=670);
 assert.ok(j.proposal.provided>=j.required);
});
test('intermediate interface demand chooses the widest adequate 10 mm candidate below 600',()=>{
 const r=E.calculate({...base(),mode:'mat',crossLegs:0}).phases.at(-1).interfaces[0];
 const exact=Math.sqrt(198.6*1e6/r.required);
 assert.equal(r.proposal.spacing,Math.floor(exact/10)*10);
 assert.ok(198.6*1e6/(r.proposal.spacing+10)**2<r.required);
});

test('soil distance-average shear halves the face demand without reducing vertical checks',()=>{
 const r=E.calculate({...base(),crossLegs:0}).phases.at(-1);
 for(const a of r.axes){near(a.Vu,280);near(a.Vavg,140);near(a.Vd,0);}
 near(r.interfaces[0].tau,.14);near(r.interfaces[0].required,.14*1e6/375);
 assert.ok(r.interfaces[0].stresses.every(s=>s.source==='distance-average'));
});
test('four-pile average integrates both positive inner and negative outer shear areas',()=>{
 const r=E.calculate({...base(),mode:'pile'}).phases.at(-1),w=43.2,R=r.totalU/4;
 const area=(.625-.3)*(2*R/2.5-w*(.95+.625)/2)+w*.625**2/2;
 near(r.axes[0].Vavg,area/.95);
 assert.ok(r.axes[0].Vavg<r.axes[0].Vu);
});
test('asymmetric pile strips use the greater side average and agree with midpoint integration',()=>{
 const p={...base(),mode:'pile',pileCount:3,Pu:20},out=E.calculate(p),ph=out.phases.at(-1),N=20000;
 for(const a of ph.axes){
  const width=a.axis==='X'?out.g.L:out.g.B,face=(a.axis==='X'?p.cx:p.cy)/2000;
  for(const side of a.sides){
   const end=face+side.length;let sum=0;
   for(let i=0;i<N;i++){
    const x=face+side.length*(i+.5)/N;
    const V=ph.piles.reduce((s,v)=>s+(side.sign*(a.axis==='X'?v.x:v.y)>x?v.Ru:0),0)/width-ph.wu*(end-x);
    sum+=Math.abs(V)/N;
   }
   assert.ok(Math.abs(sum-side.Vavg)<.005,`${sum} vs ${side.Vavg}`);
  }
  near(a.Vavg,Math.max(...a.sides.map(s=>s.Vavg)));
 }
});
test('directional demand takes the larger stress without a vector sum or mat spatial reduction',()=>{
 const p={...base(),mode:'mat',crossLegs:0};p.stages[1].cured.vx=-300;p.stages[1].cured.vy=400;
 const r=E.calculate(p).phases.at(-1),j=r.interfaces[0];
 near(j.stresses[0].tau,.3);near(j.stresses[1].tau,.4);near(j.tau,.4);
 assert.ok(j.stresses.every(s=>s.source==='input'));near(r.axes[0].Vu,300);near(r.axes[1].Vu,400);
});
