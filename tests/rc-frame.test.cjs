const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('../rc-frame.js');
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const span=(L=6,loads=[{type:'uniform',a:0,b:L,value:20}])=>({L,b:400,h:600,loads});
const pin=()=>({type:'pin'}),col=end=>({L:3,b:600,h:600,end:end||'fixed'});
const model=(spans=[span()],supports=[pin(),pin()])=>({fck:30,spans,supports});
test('simply supported UDL has exact reactions, midspan moment and load-induced deflection',()=>{
 const o=F.calculate(model()),e=o.beams[0],EI=o.E*400*600**3/12;
 near(o.supports[0].Ry,60);near(o.supports[1].Ry,60);near(e.extrema.M.max.M,90);near(e.extrema.M.max.x,3);
 near(e.extrema.v.min.v,-5*20*6000**4/(384*EI));near(e.extrema.v.min.x,3);near(o.equilibrium.sumM,0);
});
test('fixed-fixed beam and cantilever match closed forms including end deflection',()=>{
 const fixed={type:'fixed'},free={type:'free'},L=6000,w=20,EI=F.modulus(30)*400*600**3/12;
 const a=F.calculate(model([span()],[fixed,fixed])).beams[0];near(F.at(a,0).M,-60);near(F.at(a,6000,'left').M,-60);near(F.at(a,3000).M,30);near(F.at(a,3000).v,-w*L**4/(384*EI));
 const b=F.calculate(model([span()],[fixed,free]));near(F.at(b.beams[0],0).M,-360);near(F.at(b.beams[0],L).v,-w*L**4/(8*EI));near(b.supports[0].RM,360);near(b.supports[0].Ry,120);
});
test('off-centre point load preserves shear jump and exact displacement',()=>{
 const P=100,a=1.7,b=4.3,o=F.calculate(model([span(6,[{type:'point',a,value:P}])])),e=o.beams[0],EI=o.E*e.I;
 near(o.supports[0].Ry,P*b/6);near(o.supports[1].Ry,P*a/6);near(F.at(e,a*1000,'right').V-F.at(e,a*1000,'left').V,-P);
 near(F.at(e,a*1000).v,-P*1000*(a*1000)**2*(b*1000)**2/(3*EI*6000));near(e.extrema.M.max.x,a);near(F.at(e,e.extrema.v.min.x*1000).theta,0);
});
test('applied moment preserves jump, signs and endpoint loads',()=>{
 const o=F.calculate(model([span(6,[{type:'moment',a:3,value:60}])])),e=o.beams[0];near(o.supports[0].Ry,10);near(o.supports[1].Ry,-10);near(F.at(e,3000,'left').M,30);near(F.at(e,3000,'right').M,-30);near(F.at(e,3000).v,0);
 const end=F.calculate(model([span(6,[{type:'moment',a:6,value:60},{type:'point',a:0,value:100}])])) ;near(end.supports[0].Ry,110);near(end.supports[1].Ry,-10);near(F.at(end.beams[0],6000,'left').M,60);
});
test('asymmetric trapezoid retains area and centroid; zero ramps and triangular limits work',()=>{
 const o=F.calculate(model([span(6,[{type:'trapezoid',a:0,b:6,rise:1,fall:2,value:20}])]));near(o.supports[1].Ry,250/6);near(o.supports[0].Ry,90-250/6);
 const triangle=F.calculate(model([span(6,[{type:'trapezoid',a:0,b:6,rise:3,fall:3,value:20}])]));near(triangle.supports[0].Ry,30);near(triangle.beams[0].extrema.M.max.M,60);
 const rectangular=F.calculate(model([span(6,[{type:'trapezoid',a:0,b:6,rise:0,fall:0,value:20}])]));near(rectangular.beams[0].extrema.v.min.v,F.calculate(model()).beams[0].extrema.v.min.v);
});
test('partial distributed load and superposition preserve reactions and internal forces',()=>{
 const a={type:'uniform',a:1,b:4,value:20},b={type:'point',a:5,value:50};
 const oa=F.calculate(model([span(6,[a])])),ob=F.calculate(model([span(6,[b])])),sum=F.calculate(model([span(6,[a,b])]));near(oa.supports[1].Ry,25);near(sum.supports[0].Ry,oa.supports[0].Ry+ob.supports[0].Ry);
 for(const x of [0,1700,3900,5000,6000])for(const k of ['M','V','v'])near(F.at(sum.beams[0],x)[k],F.at(oa.beams[0],x)[k]+F.at(ob.beams[0],x)[k]);
});
test('two equal continuous spans and hinge releases recover standard support moment',()=>{
 const o=F.calculate(model([span(),span()],[pin(),pin(),pin()]));near(F.at(o.beams[0],6000,'left').M,-90);near(o.supports[0].Ry,45);near(o.supports[1].Ry,150);
 const hinges=F.calculate(model([{...span(),hingeJ:true},{...span(),hingeI:true}],[pin(),pin(),pin()]));near(F.at(hinges.beams[0],6000,'left').M,0);near(hinges.beams[1].extrema.M.max.M,90);
});
test('frame columns transmit bending with correct stiffness and shorten axially',()=>{
 const support=()=>({type:'both',upper:col(),lower:col()}),o=F.calculate(model([span()],[support(),support()])),e=o.beams[0];
 const kb=2*o.E*e.I/e.L,kc=8*o.E*600*600**3/12/3000;
 near(F.at(e,0).M,-20*6000**2/12*kc/(kb+kc)/1e6);assert.ok(o.supports[0].uy<0);near(o.supports[0].ux,0);near(o.equilibrium.sumX,0);near(o.equilibrium.sumY,0);near(o.equilibrium.sumM,0);
 const hinged=F.calculate(model([span()],[{type:'lower',lower:col('hinged')},{type:'lower',lower:col('hinged')}]));for(const c of hinged.columns)near(c.r[5],0,.000001);
});
test('ten-element free intermediate nodes match single-span solution without false supports',()=>{
 const spans=Array.from({length:10},()=>span(.6)),supports=Array.from({length:11},(_,i)=>i===0||i===10?pin():{type:'free'});
 const o=F.calculate(model(spans,supports)),one=F.calculate(model());near(o.supports[0].Ry,60);near(o.supports[5].uy,one.beams[0].extrema.v.min.v);near(F.at(o.beams[4],600,'left').M,90);near(o.equilibrium.sumM,0);
});
test('unstable, invalid and unloaded cases are distinguished',()=>{
 assert.throws(()=>F.calculate(model([span()],[pin(),{type:'free'}])),/불안정/);
 assert.throws(()=>F.calculate(model([span()],[{type:'free'},{type:'free'}])),/불안정/);
 assert.throws(()=>F.calculate(model([span(6,[{type:'point',a:7,value:10}])])));
 assert.throws(()=>F.calculate(model([span(6,[{type:'trapezoid',a:0,b:6,rise:4,fall:4,value:10}])])));
 assert.throws(()=>F.calculate(model(Array(11).fill(span()),Array(12).fill(pin()))));
 const o=F.calculate(model([span(6,[])]));near(o.beams[0].extrema.M.max.M,0);near(o.beams[0].extrema.v.min.v,0);
});
