const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../rc-beam.js'),S=require('../rc-slab-uplift.js');
const base={l1:8000,l2:8000,footing:2500,h:400,hw:3,gammaW:9.81,gammaC:24,qsd:1.5,
  fck:30,fy:500,coverTop:40,coverBottom:75,bar:'D16',spacing:200,spanType:'interior',endCase:0};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('net upward load follows the specified combination and ignores live load',()=>{
  const w=S.load(base);
  near(w.uplift,9.81*3);near(w.selfWeight,24*.4);near(w.dead,9.6+1.5);
  near(w.qu,1.6*9.81*3-0.9*(9.6+1.5));
  // Resisting dead load only ever reduces the demand.
  assert.ok(S.load({...base,qsd:0}).qu>w.qu);
  assert.ok(S.load({...base,h:800}).qu<w.qu);
});
test('clear span is measured between footing faces and floored at 0.65 l',()=>{
  const wide=S.clearSpan(8000,2500);
  near(wide.ln,5500);assert.equal(wide.floored,false);
  const tight=S.clearSpan(8000,7000);
  near(tight.ln,5200);assert.equal(tight.floored,true);near(tight.raw,1000);
});
test('static moment and interior distribution match independent arithmetic',()=>{
  const o=S.calculate(base),qu=o.load.qu,d=o.directions[0];
  near(d.Mo,qu*8*Math.pow(5.5,2)/8);
  const neg=d.rows.filter(r=>r.key==='negative'),pos=d.rows.filter(r=>r.key==='positive');
  near(neg.reduce((s,r)=>s+r.total,0),.65*d.Mo);
  near(pos.reduce((s,r)=>s+r.total,0),.35*d.Mo);
  // Beamless slab: column strip takes 75% of negative and 60% of positive.
  near(neg.find(r=>r.strip==='column').total,.75*.65*d.Mo);
  near(pos.find(r=>r.strip==='column').total,.60*.35*d.Mo);
});
test('design strips split the transverse span and moments per metre follow the width',()=>{
  const o=S.calculate({...base,l1:8000,l2:6000}),d=o.directions[0];
  near(d.columnWidth,2*Math.min(.25*8000,.25*6000));
  near(d.middleWidth,6000-d.columnWidth);
  for(const r of d.rows)near(r.Mu,r.total/(r.width/1000));
});
test('uplift inverts the tension face against a gravity slab',()=>{
  for(const r of S.calculate(base).directions[0].rows){
    assert.equal(r.face,r.key==='positive'?'top':'bottom');
    // Bottom bars sit under the larger ground-cast cover, so d is smaller.
    near(r.check.d,base.h-(r.face==='top'?base.coverTop:base.coverBottom)-R.BARS[base.bar].diameter/2);
  }
});
test('flexural capacity agrees with the independent singly reinforced formula',()=>{
  const o=S.calculate(base),r=o.directions[0].rows.find(x=>x.key==='positive'&&x.strip==='column').check;
  const As=1000/200*R.BARS.D16.area,k=R.concrete(30);
  near(r.As,As);
  const a=As*500/(.85*k.eta*30*1000);
  near(r.a,a);near(r.Mn,As*500*(r.d-a/2)/1e6);
  assert.ok(r.et>r.etl);near(r.phi,.85);near(r.phiMn,.85*r.Mn);
});
test('end span uses the selected table 4.1-1 case and adds the exterior section',()=>{
  for(let endCase=0;endCase<S.END_CASES.length;endCase++){
    const c=S.END_CASES[endCase],o=S.calculate({...base,spanType:'end',endCase}),d=o.directions[0];
    assert.equal(d.rows.length,6);
    for(const key of ['exterior','positive','interior'])
      near(d.rows.filter(r=>r.key===key).reduce((s,r)=>s+r.total,0),c[key]*d.Mo);
    near(d.rows.find(r=>r.key==='exterior'&&r.strip==='column').total,c.exterior*d.Mo);
  }
});
test('shrinkage and temperature steel sets the floor and is capped per metre',()=>{
  near(S.minimumRatio(400),.0020);near(S.minimumRatio(500),.0020*400/500);
  near(S.minimumRatio(600),.0014);
  near(S.minimumSteel({fy:500,h:400}),.0016*1000*400);
  assert.equal(S.minimumSteel({fy:400,h:1200}),1800);
  assert.equal(S.maxSpacing({h:400}),300);
  assert.equal(S.maxSpacing({h:120}),240);
});
test('a section fails when capacity, minimum steel or spacing is short',()=>{
  const heavy=S.calculate(base).directions[0].rows.find(x=>x.key==='negative'&&x.strip==='column');
  assert.equal(heavy.check.ok,false);
  assert.ok(heavy.check.reasons.includes('설계휨강도 부족'));
  assert.ok(heavy.check.phiMn<heavy.Mu);
  const sparse=S.check({...base,h:400},1,'top','D10',300);
  assert.ok(sparse.As<sparse.AsMin);assert.ok(sparse.reasons.includes('최소철근량 미달'));
  const wide=S.check({...base,h:120},1,'top','D16',300);
  assert.ok(wide.reasons.includes('위험단면 철근 최대간격 초과'));
});
test('suggested spacing is the widest one that clears every condition',()=>{
  for(const r of S.calculate(base).directions[0].rows){
    const s=r.suggestion;assert.ok(s,'제안이 있어야 함');
    assert.equal(s.ok,true);assert.ok(s.phiMn>=r.Mu);assert.ok(s.As>=s.AsMin);assert.ok(s.spacing<=s.sMax);
    const tighter=S.SPACINGS.filter(x=>x>s.spacing);
    for(const x of tighter)assert.equal(S.check(base,r.Mu,r.face,base.bar,x).ok,false,`${x} should fail`);
  }
});
test('no net uplift returns a message instead of fabricated moments',()=>{
  const o=S.calculate({...base,hw:.2});
  assert.ok(o.load.qu<=0);assert.equal(o.directions.length,0);assert.match(o.message,/순 상향하중/);
});
test('aspect ratio beyond the direct design method limit is reported',()=>{
  assert.equal(S.calculate(base).limits.ok,true);
  const skew=S.calculate({...base,l1:14000,l2:5000});
  assert.equal(skew.limits.ok,false);assert.match(skew.limits.notes[0],/장변\/단변/);
  assert.ok(skew.directions.length,'제한 이탈이어도 결과는 계산한다');
});
test('invalid geometry, materials and arrangement are rejected',()=>{
  for(const k of ['l1','l2','footing','h','fck','fy','spacing'])
    for(const v of [0,-1,NaN,Infinity])assert.throws(()=>S.calculate({...base,[k]:v}));
  for(const k of ['hw','qsd','coverTop','coverBottom'])
    for(const v of [-1,NaN])assert.throws(()=>S.calculate({...base,[k]:v}));
  assert.throws(()=>S.calculate({...base,footing:8000}));
  assert.throws(()=>S.calculate({...base,coverTop:200,coverBottom:250}));
  assert.throws(()=>S.calculate({...base,bar:'D35'}));
  assert.throws(()=>S.calculate({...base,fck:100}));
  assert.throws(()=>S.calculate({...base,spanType:'middle'}));
  assert.throws(()=>S.calculate({...base,endCase:9}));
});
