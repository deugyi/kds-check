const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../composite-beam-loads.js'),CB=require('../composite-beam.js'),S=require('../steel-section.js');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const base={H:600,B:200,tw:11,tf:17,Fy:345,E:210000,rolled:true,J:null,
  span:9000,spacing:3000,edge:null,ts:150,hr:0,fck:30,wc:2300,
  stud:'D19',Fu:400,studsPerRow:2,studSpacing:200,studTransverseSpacing:100,studLength:100,
  Mu:1200,Vu:400,MuConstruction:300,LbConstruction:3000,CbConstruction:1,
  loadMode:'auto',loadWidth:3,concreteWeight:24,finishLoad:1.5,liveLoad:3,
  includeSelfWeight:true,formLoad:.4,constructionMaterialLoad:.2,constructionLiveLoad:2.5,pointLoads:[]};
const props=S.hProps(base.H,base.B,base.tw,base.tf);

test('uniform load reproduces the closed form and equilibrium',()=>{
  const o=L.analyze(10,4);near(o.RA,20);near(o.RB,20);near(o.Mu,50);near(o.Vu,20);near(o.xM,5);
});
test('eccentric point load and mirrored load reproduce Pab/L',()=>{
  for(const x of [2,6]){const o=L.analyze(8,0,[{x,P:80}]);near(o.RA,80*(8-x)/8);near(o.RB,80*x/8);near(o.Mu,120);near(o.Vu,60);near(o.xM,x);}
});
test('mixed uniform and concentrated loads find the interior zero-shear root',()=>{
  const o=L.analyze(10,10,[{x:3,P:40}]);near(o.RA,78);near(o.RB,62);near(o.xM,3.8);near(o.Mu,192.2);near(o.Vu,78);
});
test('multiple loads including coincident loads preserve equilibrium and a flat maximum',()=>{
  const flat=L.analyze(10,0,[{x:3,P:100},{x:7,P:100}]);near(flat.Mu,300);near(flat.Vu,100);
  const a=L.analyze(10,2,[{x:3,P:20},{x:3,P:60},{x:8,P:15}]);
  const b=L.analyze(10,2,[{x:3,P:80},{x:8,P:15}]);near(a.RA+a.RB,115);near(a.Mu,b.Mu);near(a.Vu,b.Vu);near(a.xM,b.xM);
});
test('the piecewise maximum exceeds or equals an independent fine equilibrium sweep',()=>{
  const ps=[{x:1.7,P:41},{x:4.25,P:37},{x:7.3,P:93}],w=7.2,len=9;
  const o=L.analyze(len,w,ps),RA=(w*len*len/2+ps.reduce((s,q)=>s+q.P*(len-q.x),0))/len;
  let sampled=0;for(const x of [...Array.from({length:10001},(_,i)=>len*i/10000),...ps.map(p=>p.x)])sampled=Math.max(sampled,RA*x-w*x*x/2-ps.reduce((s,q)=>s+q.P*Math.max(x-q.x,0),0));
  assert.ok(o.Mu>=sampled-1e-8);assert.ok(o.Mu-sampled<.0001);
});
test('surface loads use tributary width, section self weight and two completed combinations',()=>{
  const d=L.calculate(base,props),steel=props.A*1e-6*7850*9.80665/1000;
  near(d.line.slab,10.8);near(d.line.steel,steel);near(d.D,10.8+4.5+steel);near(d.L,9);
  near(d.cases[0].w,1.4*d.D);near(d.cases[1].w,1.2*d.D+1.6*9);
  near(d.Mu,(1.2*d.D+14.4)*81/8);
  const wide=L.calculate({...base,loadWidth:6},props);near(wide.line.slab,21.6);near(wide.line.steel,steel);
});
test('turning off self weight prevents automatic double counting',()=>{
  const d=L.calculate({...base,includeSelfWeight:false},props);near(d.line.slab,0);near(d.line.steel,0);near(d.D,4.5);near(d.CD,0);near(d.CM,1.8);
});
test('construction uses 1.2CD + 1.4CM + 1.6CP with wet concrete and formwork',()=>{
  const d=L.calculate(base,props);near(d.CD,d.line.steel);near(d.CM,10.8+1.2+.6);near(d.CP,7.5);
  near(d.construction.w,1.2*d.line.steel+1.4*12.6+1.6*7.5);
  near(d.MuConstruction,d.construction.w*81/8);
  const changed=L.calculate({...base,finishLoad:50,liveLoad:40},props);near(changed.MuConstruction,d.MuConstruction);
});
test('point loads are factored by type without multiplying by tributary width',()=>{
  const pointLoads=[{kind:'D',P:20,x:2},{kind:'L',P:30,x:4},{kind:'CM',P:40,x:6},{kind:'CP',P:50,x:7},{kind:'CD',P:10,x:8}];
  const d=L.calculate({...base,pointLoads},props);
  assert.deepEqual(d.cases[0].points.map(q=>q.P),[28]);assert.deepEqual(d.cases[1].points.map(q=>q.P),[24,48]);
  assert.deepEqual(d.construction.points.map(q=>q.P),[56,80,12]);
  const wide=L.calculate({...base,pointLoads,loadWidth:6},props);assert.deepEqual(wide.cases.map(q=>q.points),d.cases.map(q=>q.points));
});
test('the shear envelope includes construction loads even if completed loads are small',()=>{
  const d=L.calculate({...base,finishLoad:0,liveLoad:0,constructionLiveLoad:20},props);assert.equal(d.shearCase.phase,'construction');near(d.Vu,d.VuConstruction);
});
test('bad surface loads, missing numbers, bad kinds and out-of-span positions are rejected',()=>{
  for(const key of ['finishLoad','liveLoad','formLoad','constructionMaterialLoad','constructionLiveLoad'])for(const v of [-1,NaN,Infinity])assert.throws(()=>L.calculate({...base,[key]:v},props));
  for(const key of ['loadWidth','concreteWeight'])for(const v of [0,-1,NaN])assert.throws(()=>L.calculate({...base,[key]:v},props));
  for(const p of [{kind:'Q',P:1,x:2},{kind:'L',P:-1,x:2},{kind:'L',P:NaN,x:2},{kind:'L',P:1,x:0},{kind:'L',P:1,x:9},{kind:'L',P:1,x:10},{kind:'L',P:1,x:NaN}])assert.throws(()=>L.calculate({...base,pointLoads:[p]},props));
  assert.throws(()=>L.calculate({...base,pointLoads:Array(51).fill({kind:'L',P:1,x:2})},props));
});
test('a zero point load is allowed and does not change demand or produce a point check',()=>{
  const d=L.calculate({...base,pointLoads:[{kind:'L',P:0,x:2}]},props),plain=L.calculate(base,props);near(d.Mu,plain.Mu);near(d.Vu,plain.Vu);assert.equal(d.cases[1].pointMoments.length,0);
});
test('automatic mode ignores obsolete directly entered Mu/Vu and returns the used inputs',()=>{
  const o=CB.calculate({...base,Mu:NaN,Vu:NaN,MuConstruction:NaN});near(o.inputs.Mu,o.demand.Mu);near(o.inputs.Vu,o.demand.Vu);near(o.inputs.MuConstruction,o.demand.MuConstruction);assert.ok(o.checks.length);
});
test('direct mode remains compatible and ignores hidden automatic input errors',()=>{
  const o=CB.calculate({...base,loadMode:'direct',finishLoad:NaN,pointLoads:[{kind:'bad'}]});assert.equal(o.demand,null);near(o.inputs.Mu,1200);near(o.inputs.Vu,400);assert.equal(o.connectionCount,44);assert.throws(()=>CB.calculate({...base,loadMode:'bad'}));
});
test('physical stud counts on unequal segments and an exact boundary do not double count',()=>{
  const l=CB.studLayout(base);assert.equal(CB.studsBetween(l,0,4500),44);assert.equal(CB.studsBetween(l,4500,9000),44);
  assert.equal(CB.studsBetween(l,0,2250),22);assert.equal(CB.studsBetween(l,2250,9000),66);
  assert.equal(CB.studsBetween(l,0,2350),22);assert.equal(CB.studsBetween(l,2350,9000),64);assert.equal(CB.studsBetween(l,0,1),0);
});
test('eccentric point load uses actual moment location and available studs, not L/2 capacity',()=>{
  const p={...base,includeSelfWeight:false,finishLoad:0,liveLoad:0,formLoad:0,constructionMaterialLoad:0,constructionLiveLoad:0,pointLoads:[{kind:'L',P:400,x:2.25}]};
  const o=CB.calculate(p),g=o.checks.filter(q=>q.caseId==='gravity');assert.ok(g.some(q=>q.why==='집중하중 1'));
  const a=g.find(q=>q.why==='최대모멘트'&&q.side==='left'),b=g.find(q=>q.why==='최대모멘트'&&q.side==='right');
  near(a.x,2.25);assert.equal(a.count,22);assert.equal(b.count,66);assert.ok(a.phiMn<b.phiMn);
  const old=CB.calculate({...p,loadMode:'direct',Mu:0,Vu:0,MuConstruction:0});assert.ok(a.phiMn<old.phiMn);
});
test('near-end concentrated load can fail its connector check even with enough total studs',()=>{
  const p={...base,includeSelfWeight:false,finishLoad:0,liveLoad:0,formLoad:0,constructionMaterialLoad:0,constructionLiveLoad:0,pointLoads:[{kind:'L',P:10000,x:.5}]};
  const o=CB.calculate(p);assert.equal(o.okM,false);assert.ok(o.checks.some(q=>q.why==='집중하중 1'&&!q.ok));assert.equal(o.ok,false);
});
test('minimum required stud count develops demand and the previous integer is insufficient',()=>{
  const o=CB.calculate({...base,pointLoads:[{kind:'L',P:300,x:2.1}]});
  for(const q of o.checks.filter(q=>q.required>0)){
    const cap=n=>.9*CB.plasticMoment(base,props,o.ew.be,CB.horizontalShear({...base,studCount:n},props,o.Ac,o.stud.Qn).V).Mn;
    assert.ok(cap(q.required)>=q.M-1e-7);assert.ok(cap(q.required-1)<q.M+1e-7);
  }
});
test('automatic section search includes self weight and plate-dependent grade and finds the smallest passing area',()=>{
  const p={...base,grade:'SM355'},o=CB.recommendSection(p);assert.ok(o.selected);assert.ok(o.selected.result.ok);assert.equal(o.searched,95);
  near(o.selected.Fy,S.yieldStrength('SM355',o.selected.section.tf));
  for(const s of S.SECTIONS.filter(s=>s.A<o.selected.section.A)){
    try{assert.equal(CB.calculate({...p,...s,J:s.J,rolled:true,Fy:S.yieldStrength('SM355',s.tf)}).ok,false,s.name);}catch(e){if(e.code==='ERR_ASSERTION')throw e;}
  }
});
test('unachievable loading does not invent a passing automatic section',()=>{
  const o=CB.recommendSection({...base,liveLoad:10000});assert.equal(o.selected,null);assert.equal(o.count,0);
});
