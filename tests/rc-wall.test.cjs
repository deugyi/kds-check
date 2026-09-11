const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../rc-wall.js');
const base={fck:30,fyv:500,fyh:500,t:300,lw:3000,hw:3000,cover:50,sv:200,sh:200,bv:'D16',bh:'D16',outer:'horizontal',wallType:'general',method:'detail',outMethod:'detail',N:1000,M:3000,V:500,Nv:null,Mv:40,Vv:60,Nh:0,Mh:30,Vh:40};
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('wall detailed shear independently matches both KDS equations and whole-wall units',()=>{
 const o=W.calculate(base),d=2400,bd=300*d;
 const first=(.28*Math.sqrt(30)*bd+1e6*d/(4*3000))/1000;
 const second=(.05*Math.sqrt(30)+3000*(.1*Math.sqrt(30)+.2*1e6/(3000*300))/(3e9/5e5-1500))*bd/1000;
 near(o.s.vc1,first);near(o.s.vc2,second);near(o.s.Vc,Math.min(first,second));
 near(o.s.Vs,2*198.6*500*d/200/1000);near(o.s.phiVn,.75*(o.s.Vc+o.s.Vs));near(o.Nv,1000/3);
});
test('wall detailed expression is excluded at nonpositive denominator; zero shear falls back explicitly',()=>{
 for(const M of [0,749,750]){const o=W.calculate({...base,M});assert.equal(o.s.vc2,null);near(o.s.Vc,o.s.vc1);assert.match(o.s.note,/適用|적용/);}
 assert.notEqual(W.calculate({...base,M:750.001}).s.vc2,null);
 const zero=W.calculate({...base,V:0,M:0});near(zero.s.Vc,Math.sqrt(30)*300*2400/6000);assert.match(zero.s.note,/Vu = 0/);
});
test('axial tension cannot produce negative concrete shear and nominal wall limit cannot be bypassed with steel',()=>{
 const tension=W.calculate({...base,N:-5000,Nv:0});assert.equal(tension.s.Vc,0);assert.ok(tension.s.phiVn>=0);
 const heavy=W.calculate({...base,bh:'D35',sh:50});near(heavy.s.Vn,5*Math.sqrt(30)*300*2400/6000);assert.equal(heavy.s.capReached,true);
 const high=W.calculate({...base,fck:90});near(high.s.sqrt,8.4);
});
test('out-of-plane strip uses one face for rho and no wall-grid shear contribution',()=>{
 const p={...base,N:0,Nv:0,outMethod:'detail'},o=W.calculate(p);
 const d=300-50-15.9-15.9/2,As=198.6*1000/200;
 const vc=Math.min((.16*Math.sqrt(30)+17.6*As/(1000*d)*Math.min(1,60000*d/40000000))*1000*d,.29*Math.sqrt(30)*1000*d)/1000;
 near(o.vertical.shear.Vc,vc);near(o.vertical.shear.phiVn,.75*vc);assert.equal(o.vertical.shear.Vs,0);
 const compression=W.calculate({...p,Nv:1000,Mv:0}).vertical.shear;
 near(compression.Vc,.29*Math.sqrt(30)*1000*d*Math.sqrt(1+1e6/(3.5*300000))/1000);
 assert.match(compression.used,/4.2-5/);
 assert.equal(W.calculate({...p,Nv:-1100}).vertical.shear.Vc,0);
});
test('simple and detail selections are independent; zero loads and signed demands stay finite',()=>{
 const p={...base,N:0,Nv:0,M:0,V:0,Mv:0,Vv:0,Mh:0,Vh:0};
 const o=W.calculate(p);assert.ok(Number.isFinite(o.horizontal.shear.phiVn));
 const simple=W.calculate({...base,method:'simple',outMethod:'simple'});assert.equal(simple.s.vc1,null);assert.match(simple.vertical.shear.used,/4.2-2/);
 const neg=W.calculate({...base,M:-base.M,V:-base.V,Mv:-base.Mv,Vv:-base.Vv});near(neg.s.phiVn,W.calculate(base).s.phiVn);near(neg.vertical.shear.phiVn,W.calculate(base).vertical.shear.phiVn);
});
test('changing outer direction changes effective depths; bar areas and grade affect correct directions',()=>{
 const a=W.calculate({...base,Nv:0,Nh:0,Mv:0,Mh:0,bv:'D16',bh:'D16',fyv:500,fyh:500});
 const b=W.calculate({...base,Nv:0,Nh:0,Mv:0,Mh:0,outer:'vertical'});
 near(a.g.dv,b.g.dh);near(a.vertical.flexure.phiMn,b.horizontal.flexure.phiMn);
 const c=W.calculate({...base,sv:100});near(c.g.Av,2*a.g.Av);near(c.s.Vs,a.s.Vs);
});
test('strain section agrees with independent numerical area integration including displaced steel',()=>{
 const p={...base,t:300},As=993,z=60,db=15.9,c=110,fy=500;
 const actual=W.sectionAt(p,As,z,db,fy,c),a=.8*c,stress=.85*30,r=db/2;
 let force=0,moment=0;const n=50000,dy=300/n;
 for(let i=0;i<n;i++){
  const y=(i+.5)*dy;let width=0;
  for(const d of [z,300-z])if(Math.abs(y-d)<r)width+=2*Math.sqrt(r*r-(y-d)**2)*As/(Math.PI*r*r);
  if(y<a){const F=stress*(1000-width)*dy;force+=F;moment+=F*(150-y);}
 }
 for(const d of [z,300-z]){const fs=Math.max(-fy,Math.min(fy,200000*.0033*(c-d)/c)),F=As*fs;force+=F;moment+=F*(150-d);}
 near(actual.Pn,force/1000,.06);near(actual.Mn,moment/1e6,.01);
});
test('out-of-plane flexure solves design axial equilibrium and blocks axial overload',()=>{
 for(const Nv of [-200,0,300,1500]){
  const f=W.calculate({...base,Nv}).vertical.flexure;
  assert.equal(f.available,true);near(f.phi*f.Pn,Nv,1e-6);near(f.phi*f.Mn,f.phiMn);assert.ok(f.phi>=.65&&f.phi<=.85);
 }
 for(const Nv of [-1e5,1e5]){const o=W.calculate({...base,Nv});assert.equal(o.vertical.flexure.available,false);assert.equal(o.ok,false);assert.equal(o.vertical.flexure.phiMn,0);}
});
test('minimum reinforcement switches at shear threshold and cannot silently approve inadequate bars',()=>{
 const low=W.calculate({...base,V:0,M:0,bh:'D10',bv:'D10',sh:400,sv:400});assert.equal(low.s.high,false);assert.equal(low.detailOK,false);
 const high=W.calculate({...base,V:10000,hw:2000});assert.equal(high.s.high,true);assert.equal(high.ipOK,false);assert.ok(high.s.minH>=.002);
 const excessive=W.calculate({...base,bv:'D35',sv:40});assert.equal(excessive.detailOK,false);
 assert.equal(W.calculate({...base,Nh:4000}).detailOK,false);
});
test('invalid values reject before any successful result is returned',()=>{
 for(const patch of [{t:0},{lw:NaN},{V:NaN},{Nv:NaN},{sv:0},{t:100},{fyh:600},{fck:91},{outer:'invalid'},{lw:200},{Nh:Infinity}])assert.throws(()=>W.calculate({...base,...patch}));
});
