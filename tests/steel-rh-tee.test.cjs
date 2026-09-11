const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../steel-section.js'),B=require('../steel-beam.js'),I=require('../steel-builtup-i.js'),T=require('../steel-rh-tee.js'),R=require('../steel-replacement.js');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const p={scheme:'tee',mode:'capacity',bhGrade:'SM355',rhGrade:'SHN355',teeGrade:'SHN355',H:600,B:250,tw:12,tf:20,Lb:3000,Cb:1,Mu:700,Vu:300,maxH:null,maxB:null,keepStiffness:true,topSection:'H-350×350×12×19',cutMode:'half',cutHeight:300,bending:'positive'};
test('asymmetric I properties agree with independent through-depth numerical integration',()=>{
  const q={H:730,bt:300,tt:20,bb:250,tb:30,tw:12},o=I.properties(q),dy=.01;
  let A=0,Q=0,I0=0,Z=0;
  for(let y=dy/2;y<q.H;y+=dy){const b=y<q.tt?q.bt:y>q.H-q.tb?q.bb:q.tw;A+=b*dy;Q+=b*y*dy;I0+=b*y*y*dy;Z+=b*Math.abs(y-o.pna)*dy;}
  near(o.A,A,1e-6);near(o.y,Q/A,1e-6);near(o.Ix,I0-Q*Q/A,1e-6);near(o.Zx,Z,1e-6);
  near(o.St,o.Ix/o.y);near(o.Sb,o.Ix/(q.H-o.y));
});
test('symmetric compact I reproduces shared yield, shear and reversal invariance',()=>{
  const q={H:600,bt:200,tt:20,bb:200,tb:20,tw:12,Fy:355,E:210000,Lb:100,Cb:1};
  const o=I.calculate(q),old=B.calculate({H:600,B:200,tf:20,tw:12,Fy:355,E:210000,Lb:100,Cb:1,Mu:0,Vu:0,rolled:false});
  near(o.positive.phiMn,old.flexure.phiMn);near(o.shear.phiVn,old.shear.phiVn);near(o.positive.phiMn,o.negative.phiMn);
});
test('reversing the unequal flanges swaps positive and negative capacity',()=>{
  const q={H:800,bt:200,tt:16,bb:200,tb:17,tw:10,Fy:355,E:210000,Lb:3000,Cb:1};
  const a=I.calculate(q),b=I.calculate({...q,bt:q.bb,tt:q.tb,bb:q.bt,tb:q.tt});
  assert.ok(a.positive.supported&&a.negative.supported);near(a.positive.phiMn,b.negative.phiMn);near(a.negative.phiMn,b.positive.phiMn);
  // Independent hand evaluation of KDS 4.3-12 for this specimen (docs).
  near(a.positive.phiMn,1038.2238516470138);
  assert.ok(I.calculate({...q,Lb:9000}).positive.phiMn<a.positive.phiMn);
});
test('F4 LTB branches remain finite and match within code coefficient rounding at J=0',()=>{
  const q={H:650,bt:200,tt:15,bb:300,tb:20,tw:12,Fy:355,E:210000,Lb:3000,Cb:1};
  const d=I.calculate(q).positive;assert.ok(d.ratio>.1&&d.ratio<=.23);assert.ok(d.supported);assert.ok(Number.isFinite(d.Lr));
  near(I.calculate({...q,Lb:d.Lp*(1-1e-7)}).positive.phiMn,I.calculate({...q,Lb:d.Lp*(1+1e-7)}).positive.phiMn,1e-6);
  // Rounded coefficients 1.95 and 6.76 in KDS Lr give a 0.171% junction difference.
  near(I.calculate({...q,Lb:d.Lr*(1-1e-7)}).positive.phiMn,I.calculate({...q,Lb:d.Lr*(1+1e-7)}).positive.phiMn,.002);
});
test('slender web uses F5 reduction, and extreme sections are not approved',()=>{
  const q={H:1000,bt:250,tt:20,bb:250,tb:22,tw:6,Fy:355,E:210000,Lb:2000,Cb:1};
  const d=I.calculate(q).positive;assert.ok(d.supported);assert.equal(d.clause,'4.3.2.1.1.5');assert.ok(d.Rpg>0&&d.Rpg<1);assert.ok(d.phiMn<.9*d.Myc);
  assert.equal(I.calculate({...q,tw:2}).positive.supported,false);
  assert.throws(()=>I.calculate({...q,tw:0}));
});
test('intermediate flange is excluded from properties, included in actual weight',()=>{
  const top=S.findSection(p.topSection),tee=S.findSection('H-600×200×11×17'),a=T.assembly(top,tee,300,p),e=a.effective;
  assert.equal(e.tw,11);assert.equal(e.H,650);
  near(a.out.props.A,top.B*top.tf+tee.B*tee.tf+(650-top.tf-tee.tf)*11);
  assert.ok(a.mass/.00785>a.out.props.A);
  near(a.teeMass,(tee.B*tee.tf+(300-tee.tf)*tee.tw+2*tee.r**2*(1-Math.PI/4))*.00785);
  const half=T.assembly(top,tee,tee.H/2,p);near(half.teeMass,(tee.A+4*tee.r**2*(1-Math.PI/4))*.00785/2);
});
test('two grades reduce to the lower Fy and unsupported cut heights are rejected',()=>{
  const top=S.findSection(p.topSection),tee=S.findSection('H-600×200×11×17');
  const a=T.assembly(top,tee,300,{...p,teeGrade:'SS235'});assert.equal(a.effective.Fy,225);
  assert.throws(()=>T.assembly(top,tee,20,p));assert.throws(()=>T.assembly(top,tee,599,p));assert.throws(()=>R.calculate({...p,cutMode:'custom',cutHeight:NaN}));
});
test('candidate screening includes both moment signs, combined height, real mass and weld line demand',()=>{
  const o=R.calculate({...p,bending:'both'});assert.ok(o.recommended);
  for(const r of o.rows.filter(r=>r.eligible)){
    assert.ok(r.out.positive.phiMn>=o.target.M-1e-7);assert.ok(r.out.negative.phiMn>=o.target.M-1e-7);assert.ok(r.out.shear.phiVn>=o.target.V-1e-7);
    assert.ok(r.mass>=o.recommended.mass);assert.ok(r.out.props.Ix>=o.base.props.Ix-1e-7);
    near(r.flow,o.target.V*1000*r.assembly.Q/r.out.props.Ix);
  }
  assert.equal(R.calculate({...p,maxH:300}).recommended,null);
  const low=R.calculate({...p,mode:'load',Mu:200,Vu:50,keepStiffness:false});assert.deepEqual(low.target,{M:200,V:50});assert.ok(low.recommended);
  assert.equal(R.calculate({...p,cutMode:'custom',cutHeight:9999}).rows.length,0);
});
