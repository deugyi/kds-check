const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../rc-column.js');
const base={shape:'rect',tie:'tie',fck:30,fy:600,fyt:500,b:600,h:600,n:12,rows:4,
  bar:'D25',hoop:'D13',cover:40,spacing:200,Pu:3000,Mux:500,Muy:300,
  concretePrice:120000,steelPrice:1300000,wastePercent:0};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

/* The verified TI-Nspire rc_vert.py engine's numbers for its reference section.
 * Pinned against the solver directly so input plumbing can change freely. */
const REF={b:600,h:600,depth:600,shape:'rect',dt:540,
  lay:[[1548.4,60],[774.2,220],[774.2,380],[1548.4,540]]};
test('the solver reproduces the verified reference values',()=>{
  const balanced=C.pmcRect(REF,27,500,307.2413793103448,'tie');
  near(balanced.Pn,3355.3535867050,1e-6);near(balanced.Mn,982.3728153341,1e-8);
  const flexure=C.pureFlexure(REF,27,500,'tie');
  near(flexure.c,104.3546698453,1e-8);near(flexure.Mn,578.4130199179,1e-8);
  const demand=C.atEccentricity(REF,27,500,'tie',500*1000/3000);
  near(demand.c,415.0282564557,1e-8);near(demand.Pn,5268.3632775042,1e-6);
  near(demand.Mn,878.0605462507,1e-8);near(demand.phi,.65);
  near(demand.phi*demand.Pn,3424.4361303777,1e-6);
  near(demand.phi*demand.Mn,570.7393550630,1e-8);
  const Ast=REF.lay.reduce((s,L)=>s+L[0],0);
  const ax=C.axial(600*600,Ast,27,500,'tie');
  near(ax.Po,10477.99266,1e-5);near(ax.phiPnMax,5448.5561832,1e-5);
});
test('the same section reached through the input layer gives the same numbers',()=>{
  // D22 with a D10 hoop puts the outer bars at d = 60 mm, matching the reference.
  const p={...base,fck:27,fy:500,bar:'D22',hoop:'D10',cover:60-9.53-22.2/2,n:12,rows:4};
  const x=C.calculate(p).axes[0];
  assert.deepEqual(x.lay,REF.lay);
  near(x.demand.phiPn,3424.4361303777,1e-6);
  near(x.demand.phiMn,570.7393550630,1e-8);
});
test('stress block parameters follow table 4.1-2 and interpolate between rows',()=>{
  for(const fck of [21,30,40]){const k=C.params(fck);near(k.ecu,.0033);near(k.eta,1);near(k.beta,.8);}
  const k45=C.params(45);near(k45.ecu,.00325);near(k45.eta,.985);near(k45.beta,.8);
  near(C.params(90).beta,.70);near(C.params(55).beta,.78);
});
test('the strength reduction factor spans the transition between tie types',()=>{
  const fy=400,ey=fy/C.ES,etl=C.tensionLimit(fy);
  near(etl,.005);near(C.tensionLimit(600),2.5*600/C.ES);
  for(const [tie,phi0] of [['tie',.65],['spiral',.70]]){
    near(C.strengthFactor(ey/2,fy,tie),phi0);
    near(C.strengthFactor(etl*2,fy,tie),.85);
    near(C.strengthFactor((ey+etl)/2,fy,tie),phi0+(.85-phi0)*.5);
    assert.equal(C.zone(phi0,tie),'압축지배단면');
    assert.equal(C.zone(.85,tie),'인장지배단면');
  }
});
test('perimeter layout places the bars from the total count and row count',()=>{
  const o=C.calculate(base),g=o.geo;
  assert.equal(g.bars.length,12);
  assert.equal(g.perRow,(12-2*4+4)/2);
  const inset=base.cover+C.BARS.D13.d+C.BARS.D25.d/2;
  near(g.inset,inset);
  const ys=[...new Set(g.bars.map(b=>b.y))].sort((a,b)=>b-a);
  assert.equal(ys.length,4);
  near(ys[0],300-inset);near(ys[3],-(300-inset));
  // Outer rows carry perRow bars, inner rows two.
  for(const y of [ys[0],ys[3]])assert.equal(g.bars.filter(b=>b.y===y).length,g.perRow);
  for(const y of [ys[1],ys[2]])assert.equal(g.bars.filter(b=>b.y===y).length,2);
  near(o.Ast,12*C.BARS.D25.a);near(o.rho,o.Ast/(600*600));
});
test('circular layout spreads the bars evenly around one circle',()=>{
  const o=C.calculate({...base,shape:'circle',tie:'spiral',D:700,n:8,spacing:60});
  assert.equal(o.geo.bars.length,8);
  const r=350-o.geo.inset;
  near(o.geo.barRadius,r);
  for(const b of o.geo.bars)near(Math.hypot(b.x,b.y),r,1e-9);
  near(o.Ag,Math.PI*700*700/4);
  assert.equal(o.axes.length,1,'축대칭이므로 한 방향만 검토한다');
});
test('each axis regroups the same bars along its own depth direction',()=>{
  const o=C.calculate({...base,b:600,h:800});
  const [x,y]=o.axes;
  assert.equal(x.depth,800);assert.equal(x.width,600);
  assert.equal(y.depth,600);assert.equal(y.width,800);
  for(const a of [x,y]){
    near(a.lay.reduce((s,L)=>s+L[0],0),o.Ast,1e-9);
    near(a.dt,Math.max(...a.lay.map(L=>L[1])));
  }
  // A section deeper in one direction is stronger about that axis.
  assert.ok(x.demand.phiMn>y.demand.phiMn);
  // A square section gives the same answer either way.
  const sq=C.calculate({...base,b:600,h:600,Muy:500});
  near(sq.axes[0].demand.phiMn,sq.axes[1].demand.phiMn,1e-9);
});
test('the circular segment matches its closed form',()=>{
  const R=300;
  near(C.segment(R,0).A,0);
  near(C.segment(R,R).A,Math.PI*R*R/2,1e-6);
  near(C.segment(R,R).arm,4*R/(3*Math.PI),1e-9);
  const full=C.segment(R,2*R);
  near(full.A,Math.PI*R*R,1e-6);near(full.arm,0);
  // Area and first moment grow monotonically with the block depth.
  let prev=-1;
  for(let a=0;a<=2*R;a+=R/10){const s=C.segment(R,a);assert.ok(s.A>=prev);prev=s.A;}
});
test('section forces satisfy equilibrium against an independent summation',()=>{
  const k=C.params(27),m=k.eta*.85*27;
  for(const c of [120,250,415.0282564557,900]){
    const r=C.pmcRect(REF,27,500,c,'tie');
    const ae=Math.min(k.beta*c,REF.h);
    let P=m*REF.b*ae/1000,M=P*(REF.h/2-ae/2)/1000;
    for(const [As,d] of REF.lay){
      let fs=Math.max(-500,Math.min(500,C.ES*k.ecu*(c-d)/c));
      if(d<=ae&&fs>0)fs-=m;
      P+=As*fs/1000;M+=As*fs/1000*(REF.h/2-d)/1000;
    }
    near(r.Pn,P,1e-9);near(r.Mn,M,1e-9);
  }
});
test('key points and the axial cap follow their definitions',()=>{
  const o=C.calculate(base),a=o.axes[0],k=C.params(base.fck);
  near(a.balanced.cb,k.ecu/(k.ecu+base.fy/C.ES)*a.dt);
  near(a.balanced.et,base.fy/C.ES,1e-9);
  near(a.flexure.Pn,0,1e-6);
  near(a.tensionPoint.et,C.tensionLimit(base.fy),1e-9);
  near(a.axial.phiPnMax,.80*.65*a.axial.Po);
  const sp=C.calculate({...base,shape:'circle',tie:'spiral',D:700,n:8,spacing:60});
  near(sp.axes[0].axial.phiPnMax,.85*.70*sp.axes[0].axial.Po);
  near(a.demand.e,base.Mux*1000/base.Pu);
  near(a.demand.Mn*1000/a.demand.Pn,a.demand.e,1e-6);
  const squat=C.calculate({...base,Pu:5000,Mux:10,Muy:10});
  assert.equal(squat.axes[0].demand.capped,true);
  near(squat.axes[0].demand.phiPn,squat.axes[0].axial.phiPnMax);
  const pure=C.calculate({...base,Pu:0,Mux:300,Muy:300});
  assert.equal(pure.axes[0].demand.pure,true);
  near(pure.axes[0].demand.c,pure.axes[0].flexure.c);
});
test('tie detailing follows the diameter and spacing limits',()=>{
  const t=C.calculate(base).transverse;
  // min(16 db, 48 dt, least dimension)
  near(t.maxSpacing,Math.min(16*C.BARS.D25.d,48*C.BARS.D13.d,600));
  assert.equal(t.ok,true);
  const wide=C.calculate({...base,spacing:500}).transverse;
  assert.ok(wide.reasons.some(r=>r.includes('최대 간격')));
  // D35 main bars need at least a D13 tie.
  const thin=C.calculate({...base,bar:'D35',hoop:'D10'}).transverse;
  assert.equal(thin.minHoop,'D13');
  assert.ok(thin.reasons.some(r=>r.includes('D13')));
  assert.equal(C.calculate({...base,bar:'D32',hoop:'D10'}).transverse.minHoop,'D10');
});
test('spiral columns check the volumetric ratio and its own limits',()=>{
  const p={...base,shape:'circle',tie:'spiral',D:700,n:8,hoop:'D13',spacing:60};
  const s=C.calculate(p).transverse;
  const Dch=700-2*p.cover,Ach=Math.PI*Dch*Dch/4;
  near(s.spiral.required,.45*(Math.PI*700*700/4/Ach-1)*p.fck/p.fyt);
  near(s.spiral.provided,4*C.BARS.D13.a/(Dch*60));
  assert.equal(s.spiral.ok,true);assert.equal(s.ok,true);
  const sparse=C.calculate({...p,hoop:'D10',spacing:75}).transverse;
  assert.equal(sparse.spiral.provided<sparse.spiral.required,!sparse.spiral.ok);
  assert.ok(C.calculate({...p,spacing:90}).transverse.reasons.some(r=>r.includes('25~75')));
  assert.throws(()=>C.calculate({...p,fyt:800}));
});
test('quantities and cost per metre match independent arithmetic',()=>{
  const o=C.calculate(base),q=o.quantities,hoop=C.BARS.D13;
  near(q.concrete,600*600/1e6);
  near(q.main,12*C.BARS.D25.a*7.85e-6);
  const W=600-2*40-hoop.d,cut=2*(W+W)+2*Math.max(6*hoop.d,75);
  near(q.cut,cut);near(q.stations,1000/200);
  near(q.hoop,hoop.a*cut/1000*(1000/200)*7.85e-6);
  near(q.steel,q.net);
  near(q.totalCost,q.concrete*120000+q.steel*1300000);
  const waste=C.calculate({...base,wastePercent:5}).quantities;
  near(waste.steel,waste.net*1.05);
  // A circular tie is one turn of the core perimeter.
  const circ=C.calculate({...base,shape:'circle',tie:'spiral',D:700,n:8,spacing:60}).quantities;
  near(circ.cut,Math.PI*(700-2*40-hoop.d));
});
test('reinforcement ratio limits and the low axial note are reported',()=>{
  assert.deepEqual(C.calculate(base).notes.filter(n=>n.includes('철근비')),[]);
  const light=C.calculate({...base,bar:'D13',n:4,rows:2});
  assert.ok(light.notes.some(n=>n.includes('0.01~0.08')));
  const splice=C.calculate({...base,bar:'D41',n:20,rows:4,b:800,h:800});
  assert.ok(splice.rho>.04);
  assert.ok(splice.notes.some(n=>n.includes('겹침이음')));
  assert.ok(C.calculate({...base,Pu:100}).notes.some(n=>n.includes('휨부재')));
});
test('invalid geometry, materials and arrangement are rejected',()=>{
  for(const k of ['b','h','fck','fy','fyt','cover','spacing'])
    for(const v of [0,-1,NaN,Infinity])assert.throws(()=>C.calculate({...base,[k]:v}));
  assert.throws(()=>C.calculate({...base,fck:100}));
  assert.throws(()=>C.calculate({...base,fy:700}));
  assert.throws(()=>C.calculate({...base,shape:'oval'}));
  assert.throws(()=>C.calculate({...base,tie:'hoop'}));
  assert.throws(()=>C.calculate({...base,bar:'D50'}));
  assert.throws(()=>C.calculate({...base,hoop:'D19'}));
  assert.throws(()=>C.calculate({...base,n:3}),/4개 이상/);
  assert.throws(()=>C.calculate({...base,shape:'circle',tie:'spiral',D:700,n:5}),/6개 이상/);
  assert.throws(()=>C.calculate({...base,n:11}),/짝수/);
  assert.throws(()=>C.calculate({...base,n:8,rows:5}),/배치할 수 없습니다/);
  assert.throws(()=>C.calculate({...base,rows:1}));
  assert.throws(()=>C.calculate({...base,cover:400}));
  assert.throws(()=>C.calculate({...base,Pu:-1}));
  assert.throws(()=>C.calculate({...base,Mux:-1}));
  // A spiral outside a circular section is a detailing contradiction.
  assert.throws(()=>C.calculate({...base,tie:'spiral',n:12}),/원형 단면/);
});
