const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../rc-footing'),R=require('../rc-beam'),S=require('../rc-slab-uplift'),O=require('../rc-slab-oneway');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('soil and pile automatically select common 10 mm pitch and recheck final bar depths',()=>{
 assert.deepEqual(F.AUTO_BARS,O.BARS);assert.deepEqual(F.AUTO_SPACINGS,O.SPACINGS);
 for(const mode of ['soil','pile']){
  const r=F.design({mode,Ps:1500,Pu:2100,autoSize:mode==='pile',pileCount:4});
  assert.equal(r.automatic,true);assert.equal(r.p.spacingX,r.p.spacingY);
  for(const v of r.rows){assert.ok(v.flexOK&&v.steelOK);assert.ok(v.spacing>=100&&v.spacing<=300&&v.spacing%10===0);assert.ok(F.AUTO_BARS.includes(v.bar));}
  const dx=r.p.h-r.p.cover-R.BARS[r.p.shearBar].diameter-R.BARS[r.p.barX].diameter/2;
  const dy=dx-R.BARS[r.p.barX].diameter/2-R.BARS[r.p.barY].diameter/2;
  close(r.dx,dx);close(r.dy,dy);
  const manual=F.calculate(r.p);
  assert.deepEqual(r.rows,manual.rows);assert.deepEqual(r.punching,manual.punching);assert.deepEqual(r.reinforcement,manual.reinforcement);
 }
});

test('Ps controls service bearing while Pu controls footing moments, with no transferred column moments',()=>{
 const a=F.design({Ps:1500,Pu:2100}),b=F.design({Ps:3000,Pu:2100,Mxs:1000,Mys:-500,Mxu:600,Myu:400,Ns:1,Nu:1,weightFactor:9});
 close(b.bearing.max-a.bearing.max,1500/9);close(b.bearing.min,b.bearing.max);
 for(const key of ['Mxs','Mys','Mxu','Myu'])assert.equal(b.p[key],0);
 close(b.totalS,3000+b.W);close(b.totalU,2100+1.2*b.W);
 assert.equal(b.punching.hasMoment,false);assert.deepEqual(a.rows,b.rows);
 // Independent uniform-reaction cantilever moment at a 600 mm column face.
 close(a.rows[0].Mu,(2100/9)*1.2**2/2);
 const c=F.design({Ps:1500,Pu:5000});assert.ok(c.steelArea>a.steelArea);
});

test('selected soil reinforcement is minimum-area feasible common-pitch pair, including unequal directional depth',()=>{
 const r=F.design({Ps:1800,Pu:4600,bx:3500,by:4000,h:600,fy:500});
 const p=r.p;
 // Independent section demand and rectangular stress block for fck = 30 MPa.
 for(const bx of F.AUTO_BARS)for(const by of F.AUTO_BARS)for(let spacing=100;spacing<=300;spacing+=10){
  const asx=R.BARS[bx].area*1000/spacing,asy=R.BARS[by].area*1000/spacing;
  const dx=p.h-p.cover-R.BARS[p.shearBar].diameter-R.BARS[bx].diameter/2,dy=dx-R.BARS[bx].diameter/2-R.BARS[by].diameter/2;
  const check=(As,d,axis)=>{
   const along=axis==='X'?p.bx:p.by,width=axis==='X'?p.by:p.bx,col=axis==='X'?p.cx:p.cy;
   const beta=Math.max(p.bx,p.by)/Math.min(p.bx,p.by),band=along<width?2*beta/(beta+1):1;
   const Mu=p.Pu/(p.bx*p.by/1e6)*((along-col)/2000)**2/2*band;
   const a=As*p.fy/(.85*p.fck*1000),c=a/R.concrete(p.fck).beta,et=R.concrete(p.fck).ecu*(d-c)/c,ey=p.fy/200000;
   const phi=et>=2.5*ey?.85:.65+.2*(et-ey)/(1.5*ey);
   return As>=S.minimumRatio(p.fy)*1000*p.h&&et>=2*ey&&phi*As*p.fy*(d-a/2)/1e6>=Mu;
  };
  if(check(asx,dx,'X')&&check(asy,dy,'Y')){
   assert.ok(asx+asy>=r.steelArea-1e-8);
   if(Math.abs(asx+asy-r.steelArea)<1e-8)assert.ok(spacing<=r.commonSpacing);
  }
 }
});

test('automatic rebar preserves total-count pile layout and equal axial reactions',()=>{
 for(const pileCount of [3,5,7,8,12,36]){
  const r=F.design({mode:'pile',autoSize:true,pileCount,diameter:500,Ps:3000,Pu:4200,h:1000});
  assert.equal(r.piles.length,pileCount);assert.ok(r.pileLayout.ok);
  close(r.piles.reduce((s,v)=>s+v.Rs,0),r.totalS);close(r.piles.reduce((s,v)=>s+v.Ru,0),r.totalU);
  for(const v of r.piles)close(v.Ru,r.totalU/pileCount);
 }
});

test('automatic main steel is followed by shear reinforcement design and is not an overall adequacy verdict',()=>{
 const r=F.design({Ps:3000,Pu:3000,bx:4500,by:4500,h:450});
 assert.ok(r.rows.every(v=>v.flexOK&&v.steelOK));
 assert.ok(r.reinforcement.oneway.every(v=>v.needed&&v.ok));
 assert.ok(r.reinforcement.punching.needed&&r.reinforcement.punching.ok);
 assert.ok(r.reinforcement.points.length>0);
 const bearing=F.design({Ps:10000,Pu:2100});
 assert.ok(bearing.rows.every(v=>v.flexOK));assert.ok(bearing.bearing.max>bearing.bearing.limit);
});

test('no feasible design and invalid axial loads do not return a fallback passing arrangement',()=>{
 assert.throws(()=>F.design({Ps:1500,Pu:1e7}),/자동 배근 설계 미달/);
 for(const key of ['Ps','Pu'])for(const value of [0,-1,NaN,Infinity,undefined])assert.throws(()=>F.design({Ps:1500,Pu:2100,[key]:value}),new RegExp(key));
 assert.throws(()=>F.design({Ps:1500,Pu:2100,cx:3000}),/기둥은 기초보다/);
 assert.throws(()=>F.design({Ps:1500,Pu:2100,fck:NaN}),/fck/);
});
