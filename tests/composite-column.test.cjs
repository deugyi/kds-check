const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../composite-column.js');
const p={type:'src',B:700,H:700,fck:30,Fy:355,Ec:30000,klx:4000,kly:4000,Pu:4000,Mux:300,Muy:200,sh:400,sb:300,tw:13,tf:21,fy:500,bar:'D25',tie:'D13',cover:40,tieSpacing:200,nb:4,nh:4,t:16};
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('SRC subtracts steel and rebar once and reproduces axial formula',()=>{
 const o=C.calculate(p),As=2*300*21+(400-42)*13,Ar=12*506.7,Ac=700*700-As-Ar;
 near(o.props.steel.A,As);near(o.props.bars.A,Ar);near(o.props.concrete.A,Ac);near(o.Pno,(355*As+500*Ar+.85*30*Ac)/1000);
 near(o.props.steel.Ix+o.props.bars.Ix+o.props.concrete.Ix,700**4/12);
 assert.equal(o.bars.length,12);assert.ok(o.supported&&o.ok);assert.ok(o.mx.phiMn>o.my.phiMn);
 assert.ok(Math.abs(o.mx.residual)<1e-6);assert.ok(Math.abs(o.my.residual)<1e-6);
});
test('rectangular CFT independent hand evaluation of Pno, EI and flexural buckling',()=>{
 const o=C.calculate({...p,type:'rect',B:400,H:600,t:20});
 near(o.props.steel.A,38400);near(o.props.concrete.A,201600);near(o.Pno,18772.8);near(o.C,.9);
 const Is=(400*600**3-360*560**3)/12,Ic=360*560**3/12,EI=210000*Is+.9*30000*Ic,Pe=Math.PI**2*EI/4000**2;
 near(o.axes[0].EI,EI);near(o.axes[0].Pe,Pe/1000);near(o.axes[0].phiPn,.75*18772.8*.658**(18772800/Pe));
 assert.equal(o.axialClass,'조밀');assert.equal(o.flexureClass,'조밀');
});
test('circular CFT uses confined axial coefficient and .95 fck for pure bending',()=>{
 const q={...p,type:'circle',B:600,H:600,t:20},o=C.calculate(q),As=Math.PI/4*(600**2-560**2),Ac=Math.PI/4*560**2;
 near(o.C2,.85*(1+1.56*355*20/(560*30)));near(o.Pno,(355*As+o.C2*30*Ac)/1000);
 near(o.mx.phiMn,o.my.phiMn);near(o.axes[0].phiPn,o.axes[1].phiPn);
 const explicit=C.plastic(o.steel,[],o.concrete,355,0,.95*30,600,'X');near(o.mx.phiMn,explicit.phiMn);
});
test('plastic circle moment agrees with independent fine strip integration',()=>{
 const q={...p,type:'circle',B:600,H:600,t:20},o=C.calculate(q),dy=.02,cut=o.mx.neutral;
 let N=0,M=0;
 for(let y=-300+dy/2;y<300;y+=dy){const outer=2*Math.sqrt(Math.max(0,300**2-y*y)),inner=2*Math.sqrt(Math.max(0,280**2-y*y));const steel=(outer-inner)*(y>cut?355:-355),conc=inner*(y>cut?.95*30:0);N+=(steel+conc)*dy;M+=(steel+conc)*y*dy;}
 near(.9*M/1e6,o.mx.phiMn,1e-4);assert.ok(Math.abs(N)<1500);
});
test('longer column reduces strength and elastic buckling branch is exercised',()=>{
 const a=C.calculate(p),b=C.calculate({...p,klx:40000,kly:40000});assert.ok(b.Pr<a.Pr);
 assert.ok(b.axes.every(v=>v.ratio>2.25));for(const v of b.axes)near(v.phiPn,.75*.877*v.Pe);
});
test('biaxial interaction uses the 0.2 axial transition and catches combined failure',()=>{
 const a=C.calculate(p),q={...p,Pu:a.Pr*.3,Mux:a.mx.phiMn*.5,Muy:a.my.phiMn*.5},b=C.calculate(q);assert.ok(!b.ok);near(b.combined.value,.3+8/9);
 const c=C.calculate({...p,Pu:a.Pr*.1,Mux:a.mx.phiMn*.2,Muy:0});near(c.combined.value,.05+.2);
 const neg=C.calculate({...q,Mux:-q.Mux,Muy:-q.Muy});near(neg.combined.value,b.combined.value);
});
test('thin CFT does not receive a compact flexural pass',()=>{
 const o=C.calculate({...p,type:'rect',B:700,H:700,t:8});assert.equal(o.flexureClass,'비조밀·세장');assert.equal(o.mx,null);assert.equal(o.combined,null);assert.equal(o.supported,false);assert.equal(o.ok,false);
 const extreme=C.calculate({...p,type:'rect',t:3});assert.ok(extreme.checks.some(c=>!c.ok));assert.equal(extreme.ok,false);
});
test('SRC detailing violations and unsupported materials cannot pass',()=>{
 assert.equal(C.calculate({...p,tieSpacing:1000}).ok,false);assert.equal(C.calculate({...p,bar:'D19',nb:2,nh:2}).ok,false);
 for(const q of [{B:NaN},{sh:0},{t:400,type:'rect'},{Fy:500},{Pu:-1},{fck:80},{nb:2.5},{Mux:NaN},{cover:500}])assert.throws(()=>C.calculate({...p,...q}));
});
