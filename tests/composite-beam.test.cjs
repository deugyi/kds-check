const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../steel-section.js'),CB=require('../composite-beam.js');
const base={H:600,B:200,tw:11,tf:17,Fy:345,E:210000,rolled:true,J:null,
  span:9000,spacing:3000,edge:null,ts:150,hr:0,fck:30,wc:2300,
  stud:'D19',Fu:400,studCount:40,studLength:100,
  Mu:1200,Vu:400,MuConstruction:300,LbConstruction:3000,CbConstruction:1.0};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('effective width takes the least of the three limits on each side',()=>{
  const w=CB.effectiveWidth(base);
  near(w.each,Math.min(9000/8,3000/2));near(w.be,2*w.each);
  assert.equal(w.governs,'보경간의 1/8');
  // A close neighbour governs instead.
  const tight=CB.effectiveWidth({...base,spacing:1600});
  near(tight.each,800);assert.equal(tight.governs,'인접보 중심간 거리의 1/2');
  // An edge beam adds the third limit.
  const edge=CB.effectiveWidth({...base,edge:500});
  near(edge.each,500);assert.equal(edge.governs,'슬래브 가장자리까지의 거리');
});
test('stud strength is the lesser of concrete bearing and the steel cap',()=>{
  const s=CB.studStrength(base),a=CB.STUDS.D19.a;
  near(s.Ec,.043*Math.pow(2300,1.5)*Math.sqrt(30));
  near(s.push,.5*a*Math.sqrt(30*s.Ec));
  near(s.cap,1.0*.75*a*400);
  near(s.Qn,Math.min(s.push,s.cap));
  assert.equal(s.governs,'스터드 강재강도');
  // Weak concrete brings the bearing term below the cap.
  const weak=CB.studStrength({...base,fck:21,Fu:800});
  assert.equal(weak.governs,'콘크리트 지압');
  near(weak.Qn,weak.push);
});
test('horizontal shear is the smallest of the three limit states',()=>{
  const o=CB.calculate(base),h=o.shearFlow;
  near(h.concrete,.85*30*o.Ac/1000);
  near(h.steel,345*o.props.A/1000);
  near(h.studs,40*o.stud.Qn/1000);
  near(h.V,Math.min(h.concrete,h.steel,h.studs));
  assert.equal(h.governs,'강재 전단연결재');
  assert.equal(h.partial,true);
  near(h.degree,h.V/Math.min(h.concrete,h.steel));
  // Enough studs make it fully composite and the steel yield governs.
  const full=CB.calculate({...base,studCount:200}).shearFlow;
  assert.equal(full.partial,false);
  assert.equal(full.governs,'강재단면 인장항복');
  near(full.degree,1);
});
test('the plastic moment satisfies equilibrium and an independent summation',()=>{
  const o=CB.calculate(base),pm=o.plastic;
  const C=o.shearFlow.V*1000,T=345*o.props.A,Cs=(T-C)/2;
  near(pm.a,C/(.85*30*o.ew.be));
  assert.ok(pm.a<=base.ts);
  assert.equal(pm.case,'강재 상부 플랜지 내 소성중립축');
  near(pm.pna,Cs/(base.B*345));
  // Compression and tension balance across the plastic neutral axis.
  near(345*pm.comp.A,Cs,1e-6);
  near(345*pm.comp.A+C,345*pm.tens.A,1e-6);
  // Moments about the plastic neutral axis, summed independently.
  const slabArm=base.hr+base.ts-pm.a/2;
  const Mn=(C*(pm.pna+slabArm)+345*pm.comp.A*(pm.pna-pm.comp.y)+345*pm.tens.A*(pm.tens.y-pm.pna))/1e6;
  near(pm.Mn,Mn,1e-9);
  near(o.phiMn,.90*pm.Mn);
});
test('full composite action puts the neutral axis in the slab',()=>{
  const o=CB.calculate({...base,studCount:200}),pm=o.plastic;
  assert.equal(pm.case,'슬래브 내 소성중립축');
  assert.equal(pm.compSteel,0);assert.equal(pm.pna,null);
  const C=o.shearFlow.V*1000;
  near(C,345*o.props.A,1e-6);
  near(pm.Mn,C*(base.ts-pm.a/2+base.H/2)/1e6);
  // More studs than needed cannot raise the strength past full composite.
  near(CB.calculate({...base,studCount:400}).phiMn,o.phiMn);
});
test('more shear connection never lowers the moment strength',()=>{
  let prev=0;
  for(const studCount of [20,30,40,60,80,120,200]){
    const o=CB.calculate({...base,studCount});
    assert.ok(o.phiMn>=prev-1e-9,`${studCount}개에서 감소`);
    prev=o.phiMn;
  }
});
test('the required stud count matches full composite action',()=>{
  const o=CB.calculate(base);
  near(o.requiredStuds,Math.ceil(o.shearFlow.full*1000/o.stud.Qn),0);
  // Providing exactly that many reaches full composite.
  const exact=CB.calculate({...base,studCount:o.requiredStuds});
  assert.equal(exact.shearFlow.partial,false);
});
test('construction stage and shear reuse the bare steel section',()=>{
  const o=CB.calculate(base),b=o.steel;
  assert.equal(b.supported,true);
  near(b.flexure.phiMn,770.7,.05);          // same as the steel beam screen
  near(b.flexure.ratio,base.MuConstruction/b.flexure.phiMn);
  near(b.shear.ratio,base.Vu/b.shear.phiVn);
  assert.equal(o.okConstruction,b.flexure.ok);
  assert.equal(o.okV,b.shear.ok);
});
test('stud detailing limits are checked',()=>{
  assert.equal(CB.calculate(base).detail.ok,true);
  // Diameter over 2.5 tf.
  const fat=CB.calculate({...base,tf:6,stud:'D22'});
  assert.ok(fat.detail.reasons.some(r=>r.includes('2.5배')));
  // Too short a stud.
  const short=CB.calculate({...base,studLength:50});
  assert.ok(short.detail.reasons.some(r=>r.includes('4배')));
  // Spacing beyond min(8 ts, 900).
  const sparse=CB.calculate({...base,studCount:5});
  near(sparse.detail.maxSpacing,Math.min(8*base.ts,900));
  assert.ok(sparse.detail.reasons.some(r=>r.includes('최대 간격')));
});
test('inputs outside the composite provisions are rejected',()=>{
  for(const k of ['H','B','tw','tf','Fy','E','span','spacing','ts','fck','Fu','studCount'])
    for(const v of [0,-1,NaN])assert.throws(()=>CB.calculate({...base,[k]:v}));
  assert.throws(()=>CB.calculate({...base,fck:80}),/21–70/);
  assert.throws(()=>CB.calculate({...base,fck:15}),/21–70/);
  assert.throws(()=>CB.calculate({...base,stud:'D10'}));
  assert.throws(()=>CB.calculate({...base,studCount:12.5}));
  assert.throws(()=>CB.calculate({...base,Mu:-1}));
  // A non-compact web falls outside 4.5.2(2)'s plastic branch.
  assert.throws(()=>CB.calculate({...base,tw:4}),/3\.76/);
  // A thin slab simply caps the horizontal shear at concrete crushing instead.
  const thin=CB.calculate({...base,ts:55,studCount:200});
  assert.equal(thin.shearFlow.governs,'콘크리트 압괴');
  near(thin.plastic.a,55,1e-6);
});
