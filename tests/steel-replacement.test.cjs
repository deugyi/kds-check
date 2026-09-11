const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../steel-replacement.js'),B=require('../steel-beam.js');
const p={mode:'capacity',bhGrade:'SM355',rhGrade:'SHN355',H:600,B:250,tw:12,tf:20,Lb:3000,Cb:1,Mu:700,Vu:300,maxH:null,maxB:null,keepStiffness:true};
test('capacity replacement satisfies BOTH strengths and stiffness, sorted by actual estimated mass',()=>{
  const o=R.calculate(p),r=o.recommended;assert.ok(r);
  assert.equal(o.target.M,B.calculate(o.bh).flexure.phiMn);
  for(const c of o.rows.filter(x=>x.eligible)){
    assert.ok(c.section.listed);assert.ok(c.out.flexure.phiMn>=o.target.M-1e-9);
    assert.ok(c.out.shear.phiVn>=o.target.V-1e-9);assert.ok(c.out.props.Ix>=o.base.props.Ix);assert.ok(c.mass>=r.mass);
  }
  assert.equal(o.bhMass,(2*250*20+560*12)*.00785);
  assert.ok(r.mass>r.out.props.A*.00785); // RH fillet included in quantities
});
test('load mode uses external demands, independently of BH capacity',()=>{
  const o=R.calculate({...p,mode:'load',Mu:100,Vu:40,keepStiffness:false});
  assert.deepEqual(o.target,{M:100,V:40});assert.ok(o.recommended);
  assert.ok(o.recommended.out.flexure.phiMn< R.calculate(p).target.M);
});
test('independent high moment and shear demands eliminate all candidates',()=>{
  for(const v of [{Mu:1e9,Vu:1},{Mu:1,Vu:1e9}])assert.equal(R.calculate({...p,...v,mode:'load'}).recommended,null);
});
test('unsupported BH does not produce equivalence recommendations but supports explicit load screening',()=>{
  const q={...p,tw:3};assert.equal(R.calculate(q).recommended,null);assert.equal(R.calculate(q).target,null);
  const o=R.calculate({...q,mode:'load',keepStiffness:false});assert.ok(o.recommended);assert.equal(o.base.supported,false);
  assert.equal(R.calculate({...p,B:800,tf:10}).recommended,null);
});
test('geometry and invalid loads do not silently become zero or stale recommendations',()=>{
  for(const q of [{H:0},{tw:300},{tf:400},{Lb:NaN},{maxH:-1},{mode:'load',Mu:NaN},{mode:'load',Mu:0,Vu:0}])assert.throws(()=>R.calculate({...p,...q}));
  assert.equal(R.calculate({...p,maxH:50}).recommended,null);
  assert.equal(R.calculate({...p,maxB:50}).recommended,null);
});
test('changing transverse support and material changes calculated strengths',()=>{
  const a=R.calculate(p),b=R.calculate({...p,Lb:9000});assert.ok(b.target.M<a.target.M);
  const c=R.calculate({...p,bhGrade:'SM275'});assert.ok(c.target.M<a.target.M);
});


test('alternative materials cannot differ from the BH common grade',()=>{
 const o=R.calculate({...p,bhGrade:'SM275',rhGrade:'SHN460'});
 const S=require('../steel-section.js');
 for(const r of o.rows)assert.equal(r.p.Fy,S.yieldStrength('SM275',Math.max(r.section.tf,r.section.tw)));
});
