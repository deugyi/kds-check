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
  const top=d.rows.filter(r=>r.face==='top'),bottom=d.rows.filter(r=>r.face==='bottom');
  near(top.reduce((s,r)=>s+r.total,0),.35*d.Mo);
  near(bottom.reduce((s,r)=>s+r.total,0),.65*d.Mo);
  // Beamless slab: column strip takes 60% of positive and 75% of negative.
  near(top.find(r=>r.strip==='column').total,.60*.35*d.Mo);
  near(bottom.find(r=>r.strip==='column').total,.75*.65*d.Mo);
});
test('design strips split the transverse span and moments per metre follow the width',()=>{
  const o=S.calculate({...base,l1:8000,l2:6000}),d=o.directions[0];
  near(d.columnWidth,2*Math.min(.25*8000,.25*6000));
  near(d.middleWidth,6000-d.columnWidth);
  for(const r of [...d.rows,...d.support])near(r.Mu,r.total/(r.width/1000));
});
test('each face takes the moment that puts it in tension',()=>{
  const d=S.calculate(base).directions[0];
  const db=R.BARS[base.bar].diameter;
  for(const r of d.rows){
    // Midspan sags upward under uplift, so the top face carries the positive
    // moment and the footing-face negative moment lands on the bottom.
    assert.equal(r.face,r.key==='positive'?'top':'bottom');
    near(r.check.d,base.h-(r.face==='top'?base.coverTop:base.coverBottom)-db/2);
  }
  assert.equal(d.rows.filter(r=>r.face==='top').length,2);
  assert.equal(d.rows.filter(r=>r.face==='bottom').length,2);
});
test('the footing-face moment sizes the bottom mat',()=>{
  const d=S.calculate(base).directions[0];
  const bottom=d.rows.find(r=>r.face==='bottom'&&r.strip==='column');
  near(bottom.Mu,.75*.65*d.Mo/(d.columnWidth/1000));
  assert.ok(bottom.suggestion.phiMn>=bottom.Mu,'제안 배근이 부모멘트를 견딘다');
  // Raising the head raises that moment, so the bottom mat has to tighten.
  const pick=hw=>S.calculate({...base,hw}).directions[0].rows.find(r=>r.face==='bottom'&&r.strip==='column');
  const deeper=pick(4);
  assert.ok(deeper.Mu>bottom.Mu);
  assert.ok(deeper.suggestion.spacing<bottom.suggestion.spacing);
  // Past what the chosen bar can carry at any spacing there is no suggestion.
  const extreme=pick(9);
  assert.equal(extreme.suggestion,null);assert.equal(extreme.check.ok,false);
});
test('the shrinkage minimum is a section total, not a per-face requirement',()=>{
  const d=S.calculate(base).directions[0];
  assert.equal(d.minimums.length,2);
  for(const m of d.minimums){
    near(m.AsMin,S.minimumSteel(base));
    near(m.total,m.AsTop+m.AsBottom);near(m.ratio,m.total/(1000*base.h));
    assert.equal(m.ok,true);
  }
  // Half the requirement on each face passes as a section but fails alone.
  const half=S.minimumSteel(base)/2;
  assert.equal(S.sectionMinimum(base,half,half).ok,true);
  assert.equal(S.sectionMinimum(base,half,0).ok,false);
});
test('the bottom mat also closes the gap left by the top mat',()=>{
  const p={...base,h:700,fy:400},AsMin=S.minimumSteel(p);
  near(AsMin,.0020*1000*700);
  // With no moment the spacing is driven purely by the section minimum.
  const tight=S.suggestBottom(p,0,'D16',200);
  assert.ok(tight.As+200>=AsMin);
  for(const x of S.SPACINGS.filter(v=>v>tight.spacing))
    assert.ok(R.BARS.D16.area*1000/x+200<AsMin,`${x}은 너무 넓다`);
  // A generous top mat lets the bottom relax to the spacing cap.
  const loose=S.suggestBottom(p,0,'D16',AsMin);
  assert.equal(loose.spacing,Math.max(...S.SPACINGS.filter(v=>v<=loose.sMax)));
});
test('flexural capacity agrees with the independent singly reinforced formula',()=>{
  const o=S.calculate(base),r=o.directions[0].rows.find(x=>x.strip==='column'&&x.face==='top').check;
  const As=1000/200*R.BARS.D16.area,k=R.concrete(30);
  near(r.As,As);
  const a=As*500/(.85*k.eta*30*1000);
  near(r.a,a);near(r.Mn,As*500*(r.d-a/2)/1e6);
  assert.ok(r.et>r.etl);near(r.phi,.85);near(r.phiMn,.85*r.Mn);
});
test('end span uses the selected table 4.1-1 case and adds the exterior section',()=>{
  for(let endCase=0;endCase<S.END_CASES.length;endCase++){
    const c=S.END_CASES[endCase],o=S.calculate({...base,spanType:'end',endCase}),d=o.directions[0];
    assert.equal(d.rows.length,4);assert.equal(d.support.length,4);
    near(d.rows.filter(r=>r.face==='top').reduce((s,r)=>s+r.total,0),c.positive*d.Mo);
    for(const key of ['exterior','interior'])
      near(d.support.filter(r=>r.key===key).reduce((s,r)=>s+r.total,0),c[key]*d.Mo);
    // Exterior support sends its whole moment to the column strip.
    near(d.support.find(r=>r.key==='exterior'&&r.strip==='column').total,c.exterior*d.Mo);
    // Two negative sections, and the heavier one sizes the bottom mat.
    for(const strip of ['column','middle']){
      const worst=Math.max(...d.support.filter(r=>r.strip===strip).map(r=>r.Mu));
      near(d.rows.find(r=>r.face==='bottom'&&r.strip===strip).Mu,worst);
    }
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
test('a section fails when capacity or spacing is short',()=>{
  const heavy=S.calculate({...base,hw:9,h:250,spacing:300}).directions[0].rows.find(x=>x.strip==='column');
  assert.equal(heavy.check.ok,false);
  assert.ok(heavy.check.reasons.includes('설계휨강도 부족'));
  assert.ok(heavy.check.phiMn<heavy.Mu);
  const wide=S.check({...base,h:120},1,'top','D16',300);
  assert.ok(wide.reasons.includes('위험단면 철근 최대간격 초과'));
  // A single sparse face is fine on its own; only the section total can fail.
  const sparse=S.check({...base,h:400},1,'top','D10',300);
  assert.equal(sparse.ok,true);
  assert.equal(S.sectionMinimum({...base,h:400},sparse.As,0).ok,false);
});
test('suggested spacing is the widest one that carries its moment',()=>{
  const d=S.calculate(base).directions[0];
  for(const r of d.rows){
    const s=r.suggestion;assert.ok(s,'제안이 있어야 함');
    assert.equal(s.ok,true);assert.ok(s.phiMn>=r.Mu);assert.ok(s.spacing<=s.sMax);
    for(const x of S.SPACINGS.filter(v=>v>s.spacing))
      assert.equal(S.check(base,r.Mu,r.face,base.bar,x).ok,false,`${x} should fail`);
  }
  // Every suggested pair still clears the section minimum.
  for(const strip of ['column','middle']){
    const pair=d.rows.filter(r=>r.strip===strip);
    assert.equal(S.sectionMinimum(base,...pair.map(r=>r.suggestion.As)).ok,true);
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
