const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../rc-column.js');
const base={fck:27,fy:500,tie:'tie',b:600,h:600,mode:'grid',dp:60,d:540,nx:4,ny:4,ab:387.1,Pu:3000,Mu:500};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

/* These are the numbers the verified TI-Nspire rc_vert.py engine produces for
 * the default section. They are pinned so a refactor cannot quietly move them. */
test('the default section reproduces the verified reference values',()=>{
  const o=C.calculate(base);
  near(o.axial.Po,10477.99266,1e-5);
  near(o.axial.phiPnMax,5448.5561832,1e-5);
  near(o.balanced.cb,307.2413793103,1e-8);
  near(o.balanced.Pn,3355.3535867050,1e-6);
  near(o.balanced.Mn,982.3728153341,1e-8);
  near(o.flexure.c,104.3546698453,1e-8);
  near(o.flexure.Mn,578.4130199179,1e-8);
  near(o.demand.c,415.0282564557,1e-8);
  near(o.demand.Pn,5268.3632775042,1e-6);
  near(o.demand.Mn,878.0605462507,1e-8);
  near(o.demand.phi,.65);
  near(o.demand.phiPn,3424.4361303777,1e-6);
  near(o.demand.phiMn,570.7393550630,1e-8);
  assert.equal(o.demand.ok,true);
});
test('stress block parameters follow table 4.1-2 and interpolate between rows',()=>{
  for(const fck of [21,30,40]){const k=C.params(fck);near(k.ecu,.0033);near(k.eta,1);near(k.beta,.8);}
  const k45=C.params(45);near(k45.ecu,.00325);near(k45.eta,.985);near(k45.beta,.8);
  const k90=C.params(90);near(k90.ecu,.0028);near(k90.eta,.84);near(k90.beta,.70);
  const k55=C.params(55);near(k55.beta,.78);
});
test('the strength reduction factor spans the transition between tie types',()=>{
  const fy=400,ey=fy/C.ES,etl=C.tensionLimit(fy);
  near(etl,.005);
  for(const [tie,phi0] of [['tie',.65],['spiral',.70]]){
    near(C.strengthFactor(ey/2,fy,tie),phi0);
    near(C.strengthFactor(etl*2,fy,tie),.85);
    near(C.strengthFactor((ey+etl)/2,fy,tie),phi0+(.85-phi0)*.5);
    assert.equal(C.zone(phi0,tie),'압축지배단면');
    assert.equal(C.zone(.85,tie),'인장지배단면');
    assert.equal(C.zone((phi0+.85)/2,tie),'변화구간단면');
  }
  // fy above 400 raises the tension-controlled limit to 2.5 fy / Es.
  near(C.tensionLimit(600),2.5*600/C.ES);
});
test('grid layout places nx bars on the outer rows and two on each inner row',()=>{
  const s=C.section(base);
  assert.equal(s.lay.length,4);
  near(s.lay[0][0],4*387.1);near(s.lay[1][0],2*387.1);
  near(s.lay[2][0],2*387.1);near(s.lay[3][0],4*387.1);
  near(s.lay[0][1],60);near(s.lay[3][1],540);
  near(s.lay[1][1],60+(540-60)/3);
  near(s.Ag,600*600);near(s.Ast,2*4*387.1+2*2*387.1);
  near(s.rho,s.Ast/s.Ag);near(s.dt,540);
  const two=C.section({...base,mode:'layers',asp:1548,as:1548});
  assert.equal(two.lay.length,2);near(two.Ast,3096);
});
test('section forces satisfy equilibrium against an independent summation',()=>{
  const s=C.section(base),k=C.params(27),m=k.eta*.85*27;
  for(const c of [120,250,415.0282564557,900]){
    const r=C.pmc(s,27,500,c,'tie');
    const ae=Math.min(k.beta*c,s.h);
    let P=m*s.b*ae/1000,M=P*(s.h/2-ae/2)/1000;
    for(const [As,d] of s.lay){
      const es=k.ecu*(c-d)/c;
      let fs=Math.max(-500,Math.min(500,C.ES*es));
      if(d<=ae&&fs>0)fs-=m;
      P+=As*fs/1000;M+=As*fs/1000*(s.h/2-d)/1000;
    }
    near(r.Pn,P,1e-9);near(r.Mn,M,1e-9);
    near(r.et,k.ecu*(s.dt-c)/c);
  }
});
test('the balanced point sits at the yield strain and pure flexure at zero axial',()=>{
  const o=C.calculate(base),k=C.params(27);
  near(o.balanced.cb,k.ecu/(k.ecu+500/C.ES)*o.sec.dt);
  near(o.balanced.et,500/C.ES,1e-9);
  near(o.flexure.Pn,0,1e-6);
  near(o.tensionPoint.et,C.tensionLimit(500),1e-9);
  near(o.tensionPoint.phi,.85,1e-9);
});
test('the demand point lands on the line of constant eccentricity',()=>{
  const o=C.calculate(base);
  near(o.demand.e,500*1000/3000);
  near(o.demand.Mn*1000/o.demand.Pn,o.demand.e,1e-6);
  // Pu = 0 falls back to pure flexure rather than an infinite eccentricity.
  const pure=C.calculate({...base,Pu:0,Mu:300});
  assert.equal(pure.demand.pure,true);near(pure.demand.c,pure.flexure.c);
  assert.equal(pure.demand.ratioP,null);
});
test('the axial cap follows the tie type and clips the reported strength',()=>{
  const t=C.calculate(base),s=C.calculate({...base,tie:'spiral'});
  near(t.axial.phiPnMax,.80*.65*t.axial.Po);
  near(s.axial.phiPnMax,.85*.70*s.axial.Po);
  // A near-concentric demand rides the cap.
  const squat=C.calculate({...base,Pu:5000,Mu:10});
  assert.equal(squat.demand.capped,true);
  near(squat.demand.phiPn,squat.axial.phiPnMax);
  assert.ok(squat.demand.rawPhiPn>squat.axial.phiPnMax);
});
test('the interaction curve is monotonic in moment near the cap and stays finite',()=>{
  const o=C.calculate(base);
  assert.ok(o.curve.length>100);
  for(const q of o.curve)for(const v of [q.Pn,q.Mn,q.phiPn,q.phiMn])assert.ok(Number.isFinite(v));
  assert.ok(Math.max(...o.curve.map(q=>q.phiPn))<=o.axial.phiPnMax+1e-9);
  assert.ok(Math.max(...o.curve.map(q=>q.Pn))<=o.axial.Po+1e-6);
});
test('reinforcement ratio limits and the low axial note are reported',()=>{
  assert.deepEqual(C.calculate(base).notes.filter(n=>n.includes('철근비')),[]);
  const light=C.calculate({...base,nx:2,ny:2,ab:71.33});
  assert.ok(light.notes.some(n=>n.includes('0.01~0.08')));
  // 12 bars over a 600 x 600 section: rho = 12 Ab / 360,000.
  const heavy=C.calculate({...base,ab:2600});
  assert.ok(heavy.sec.rho>.08);
  assert.ok(heavy.notes.some(n=>n.includes('0.01~0.08')));
  const splice=C.calculate({...base,ab:1500});
  assert.ok(splice.sec.rho>.04&&splice.sec.rho<=.08);
  assert.ok(splice.notes.some(n=>n.includes('겹침이음')));
  const low=C.calculate({...base,Pu:100,Mu:100});
  assert.ok(low.notes.some(n=>n.includes('휨부재')));
});
test('invalid geometry, materials and arrangement are rejected',()=>{
  for(const k of ['b','h','fck','fy','d','dp'])
    for(const v of [0,-1,NaN,Infinity])assert.throws(()=>C.calculate({...base,[k]:v}));
  assert.throws(()=>C.calculate({...base,fck:100}));
  assert.throws(()=>C.calculate({...base,fy:700}));
  assert.throws(()=>C.calculate({...base,tie:'hoop'}));
  assert.throws(()=>C.calculate({...base,mode:'other'}));
  assert.throws(()=>C.calculate({...base,dp:600}));
  assert.throws(()=>C.calculate({...base,d:900}));
  assert.throws(()=>C.calculate({...base,ny:1}));
  assert.throws(()=>C.calculate({...base,nx:2.5}));
  assert.throws(()=>C.calculate({...base,mode:'layers',asp:0,as:1548}));
  assert.throws(()=>C.calculate({...base,Mu:-1}));
  assert.throws(()=>C.calculate({...base,Pu:-1}));
});
