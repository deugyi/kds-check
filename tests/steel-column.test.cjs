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
