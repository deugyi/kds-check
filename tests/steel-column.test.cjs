const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../steel-column.js');
const p={H:400,B:400,tw:13,tf:21,Fy:345,E:210000,klx:4000,kly:4000,Pu:3000};
test('column retains the legacy default compression calculation',()=>{
  const o=C.calculate(p),A=2*400*21+(400-42)*13;
  const Iy=2*21*400**3/12+358*13**3/12,ry=Math.sqrt(Iy/A);
  const Fe=Math.PI**2*210000/(4000/ry)**2;
  const expected=.9*Math.pow(.658,345/Fe)*345*A/1000;
  assert.ok(Math.abs(o.phiPn-expected)<1e-7);assert.equal(o.governing.key,'Y');assert.equal(o.ok,true);
});
test('longer X length changes governing axis and elastic branch',()=>{
  const o=C.calculate({...p,klx:40000});assert.equal(o.governing.key,'X');assert.equal(o.governing.inelastic,false);
  assert.ok(Math.abs(o.phiPn-.9*.877*o.governing.Fe*o.props.A/1000)<1e-7);assert.equal(o.ok,false);
});
test('slender plate suppresses strength and invalid inputs are rejected',()=>{
  const o=C.calculate({...p,tf:5});assert.equal(o.phiPn,null);assert.equal(o.ratio,null);assert.equal(o.ok,false);
  for(const patch of [{Pu:-1},{Pu:NaN},{H:42},{tw:400},{kly:0},{Fy:Infinity}])assert.throws(()=>C.calculate({...p,...patch}));
});
test('demand changes utilization but not resistance',()=>{
  const a=C.calculate(p),b=C.calculate({...p,Pu:0}),c=C.calculate({...p,Pu:2*a.phiPn});
  assert.equal(a.phiPn,b.phiPn);assert.equal(b.ratio,0);assert.equal(c.ratio,2);assert.equal(c.ok,false);
});

test('KDS interaction switches at 0.2 and is continuous at the boundary',()=>{
  const hi=C.interaction(200,1000,30,100,20,100),lo=C.interaction(199.999,1000,30,100,20,100);
  assert.equal(hi.clause,'4.4-1');assert.equal(lo.clause,'4.4-2');
  assert.ok(Math.abs(hi.value-(.2+8/9*.5))<1e-12);
  assert.ok(Math.abs(lo.value-(.199999/2+.5))<1e-12);
  // The utilization expressions differ; the limiting x+y is continuous (0.9).
  assert.ok(Math.abs(hi.limit-lo.limit)<1e-6);
});
test('simultaneous bending can fail despite all individual checks passing',()=>{
  const o=C.calculate(p),m={...p,Pu:.4*o.phiPn,Mux:.4*o.flexure.strong.phiMn,Muy:.4*o.flexure.weak.phiMn};
  const both=C.calculate(m);assert.ok(both.combined.x<1&&both.combined.y<1&&both.combined.axial<1);assert.equal(both.combined.ok,false);
  assert.equal(C.calculate({...m,Mux:-m.Mux,Muy:-m.Muy}).combined.value,both.combined.value);
});
test('zero axial load reduces to biaxial moment ratios and no moments retain axial acceptance',()=>{
  const o=C.calculate({...p,Pu:0,Mux:0,Muy:0});assert.equal(o.combined.value,0);
  const a=C.calculate(p);assert.equal(a.combined.ok,a.ok);
  assert.equal(C.interaction(0,100,25,100,75,100).value,1);
});
test('weak-axis yield cap and noncompact interpolation follow independent arithmetic',()=>{
  const o=C.calculate(p),s=o.props,sy=2*s.Iy/p.B,lambda=p.B/(2*p.tf),lp=.38*Math.sqrt(p.E/p.Fy),lr=Math.sqrt(p.E/p.Fy);
  const mp=Math.min(p.Fy*s.Zy,1.6*p.Fy*sy)/1e6;
  const mn=mp-(mp-.7*p.Fy*sy/1e6)*(lambda-lp)/(lr-lp);
  assert.equal(o.flexure.weak.grade,'비조밀');assert.ok(Math.abs(o.flexure.weak.phiMn-.9*mn)<1e-8);
  const compact=C.calculate({...p,tf:30});assert.equal(compact.flexure.weak.grade,'조밀');
  assert.equal(compact.flexure.weak.phiMn,.9*compact.flexure.weak.Mp);
});
test('longer lateral unbraced length lowers strong strength but not weak strength',()=>{
  const short=C.calculate({...p,Lb:100}),long=C.calculate({...p,Lb:15000});
  assert.ok(long.flexure.strong.phiMn<short.flexure.strong.phiMn);
  assert.equal(long.flexure.weak.phiMn,short.flexure.weak.phiMn);
});
test('unsupported columns cannot return a combined pass and bad moments are rejected',()=>{
  for(const patch of [{rolled:false},{tf:5}]){const o=C.calculate({...p,...patch});assert.equal(o.combined,null);assert.equal(o.supported,false);}
  for(const patch of [{Mux:NaN},{Muy:Infinity},{Lb:0},{Cb:0}])assert.throws(()=>C.calculate({...p,...patch}));
});
