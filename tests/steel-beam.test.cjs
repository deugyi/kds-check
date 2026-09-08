const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../steel-section.js'),B=require('../steel-beam.js');
const base={H:600,B:200,tw:11,tf:17,Fy:345,E:210000,rolled:true,J:null,
  Lb:3000,Cb:1.0,Mu:300,Vu:250};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

/* The hand check recorded in the README for SM355 H-600x200x11x17. */
test('the reference beam reproduces the recorded hand calculation',()=>{
  const o=B.calculate(base),m=o.flexure;
  near(S.yieldStrength('SM355',17),345);
  near(o.props.ry,41.77,.005);
  near(m.Lp,1813.9,.05);
  near(m.Lr,5321.8,.05);
  near(m.Mp,987.80,.005);
  near(m.Msr,599.07,.005);
  near(m.Mn,856.35,.005);
  near(m.phiMn,770.7,.05);
  assert.equal(o.supported,true);assert.equal(m.ok,true);
});
test('section properties follow the doubly symmetric formulas',()=>{
  const p=base,s=S.hProps(p.H,p.B,p.tw,p.tf,null),hw=p.H-2*p.tf;
  near(s.A,2*p.B*p.tf+hw*p.tw);
  near(s.Ix,(p.B*Math.pow(p.H,3)-(p.B-p.tw)*Math.pow(hw,3))/12);
  near(s.Sx,2*s.Ix/p.H);
  near(s.Zx,p.B*p.tf*(p.H-p.tf)+p.tw*hw*hw/4);
  near(s.ho,p.H-p.tf);near(s.Cw,s.Iy*s.ho*s.ho/4);
  near(s.rts,Math.sqrt(Math.sqrt(s.Iy*s.Cw)/s.Sx));
  // A supplied J overrides the thin-walled estimate.
  near(S.hProps(p.H,p.B,p.tw,p.tf,1.23e6).J,1.23e6);
});
test('the grade table drops Fy as the flange gets thicker',()=>{
  near(S.yieldStrength('SM355',16),355);
  near(S.yieldStrength('SM355',17),345);
  near(S.yieldStrength('SM355',80),325);
  near(S.yieldStrength('SM355',200),305);
  near(S.yieldStrength('SHN355',200),355,0);
  assert.equal(S.yieldStrength('없는강종',20),null);
});
test('width-to-thickness ratios classify against table 4.3-2',()=>{
  const o=B.calculate(base),c=o.cls,r=Math.sqrt(base.E/base.Fy);
  near(c.flange.ratio,base.B/(2*base.tf));
  near(c.flange.lp,.38*r);near(c.flange.lr,1.00*r);
  near(c.web.ratio,(base.H-2*base.tf)/base.tw);
  near(c.web.lp,3.76*r);near(c.web.lr,5.70*r);
  assert.equal(c.flange.grade,'조밀');assert.equal(c.web.grade,'조밀');
  // A thin flange drops out of the compact range.
  assert.equal(B.calculate({...base,tf:6,Fy:345}).cls.flange.grade,'비조밀');
});
test('the three lateral-torsional branches meet at Lp and Lr',()=>{
  const at=Lb=>B.calculate({...base,Lb}).flexure;
  const m=at(3000);
  near(at(m.Lp).ltb,m.Mp,1e-6);
  near(at(m.Lp*.5).ltb,m.Mp);
  // The inelastic line reaches 0.7 Fy Sx at Lr, and the elastic branch matches.
  near(at(m.Lr).ltb,m.Msr,1e-6);
  // The elastic branch picks up just past Lr within a fraction of a percent.
  const justOver=at(m.Lr*1.0000001);
  assert.ok(Math.abs(justOver.ltb-m.Msr)/m.Msr<.005);
  // Longer spans keep losing strength.
  assert.ok(at(m.Lr*2).ltb<at(m.Lr).ltb);
  // Cb scales the inelastic branch but never past Mp.
  const high=B.calculate({...base,Lb:4000,Cb:3}).flexure;
  near(high.ltb,high.Mp,1e-9);
});
test('a non-compact flange brings the local buckling limit in',()=>{
  const o=B.calculate({...base,tf:6,Lb:1000});
  const m=o.flexure;
  assert.equal(o.cls.flange.grade,'비조밀');
  assert.ok(m.flb!==null);
  near(m.flb,m.Mp-(m.Mp-m.Msr)*(o.cls.flange.ratio-o.cls.flange.lp)/(o.cls.flange.lr-o.cls.flange.lp));
  near(m.Mn,Math.min(m.ltb,m.flb));
  // A slender flange switches to the kc equation.
  const slender=B.calculate({...base,B:600,tf:6,Lb:1000});
  if(slender.supported&&slender.cls.flange.grade==='세장'){
    assert.ok(slender.flexure.kc>=.35&&slender.flexure.kc<=.76);
  }
});
test('shear follows the rolled-section exemption and the Cv branches',()=>{
  const o=B.calculate(base),v=o.shear;
  near(v.Aw,base.H*base.tw);
  near(v.phi,1.00);near(v.Cv,1.0);
  near(v.Vn,.6*base.Fy*v.Aw/1000);
  assert.equal(v.needsStiffener,false);
  // A welded section loses the exemption even with the same web.
  const welded=B.calculate({...base,rolled:false}).shear;
  near(welded.phi,.90);
  assert.ok(welded.phiVn<v.phiVn);
  // A slender web drops Cv below one and calls for stiffeners.
  const thin=B.calculate({...base,tw:4,rolled:false});
  if(thin.supported){assert.ok(thin.shear.Cv<1);assert.equal(thin.shear.needsStiffener,true);}
});
test('a non-compact web is reported rather than silently calculated',()=>{
  const o=B.calculate({...base,tw:4});
  assert.equal(o.supported,false);
  assert.match(o.message,/조밀단면이 아닙니다/);
  assert.equal(o.flexure,undefined);
  assert.equal(o.cls.web.grade!=='조밀',true);
});
test('rolled sections warn that J excludes the fillet',()=>{
  assert.ok(B.calculate(base).notes.some(n=>n.includes('필릿')));
  assert.deepEqual(B.calculate({...base,J:2.5e6}).notes,[]);
  assert.deepEqual(B.calculate({...base,rolled:false}).notes,[]);
});
test('invalid geometry and demands are rejected',()=>{
  for(const k of ['H','B','tw','tf','Fy','E','Lb','Cb'])
    for(const v of [0,-1,NaN,Infinity])assert.throws(()=>B.calculate({...base,[k]:v}));
  for(const k of ['Mu','Vu'])assert.throws(()=>B.calculate({...base,[k]:-1}));
  assert.throws(()=>B.calculate({...base,tf:300}));
  assert.throws(()=>B.calculate({...base,tw:250}));
  assert.throws(()=>B.calculate({...base,J:-5}));
});
