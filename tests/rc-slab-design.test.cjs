const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../rc-slab-design'),P=require('../rc-slab-plate'),O=require('../rc-slab-oneway'),S=require('../rc-slab-uplift'),R=require('../rc-beam'),N=require('../new-programs');
const edges={left:'simple',right:'simple',bottom:'simple',top:'simple'};
const p={fck:30,fy:500,h:200,cover:20,L:3,lx:5,ly:6,mode:'auto',environment:'dry',support:'simple',dead:5,live:3,point:0,pointX:1.5,...edges};
function near(a,b,tol=1e-7){assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}, tol ${tol}`);}
// Independent Navier series (M=0 membrane force); differentiated analytically.
// Itasca official verification: CombinedLoad/CombinedLoad.html, eq. (1).
function navier(a,b,x,y){let u=0,Mx=0,My=0,Mxy=0;for(let m=1;m<100;m+=2)for(let n=1;n<100;n+=2){const ax=m/a,by=n/b,d=(ax*ax+by*by)**2,ss=Math.sin(Math.PI*ax*x)*Math.sin(Math.PI*by*y),cc=Math.cos(Math.PI*ax*x)*Math.cos(Math.PI*by*y);u+=16/Math.PI**6*ss/(m*n*d);Mx+=16/Math.PI**4*(ax*ax+.2*by*by)*ss/(m*n*d);My+=16/Math.PI**4*(by*by+.2*ax*ax)*ss/(m*n*d);Mxy-=.8*16/Math.PI**4*cc/(a*b*d);}return {u,Mx,My,Mxy};}
test('plate agrees with independent Navier displacement, both moments and corner twisting',()=>{
 for(const b of [1,1.5,2]){const r=P.solve(1,b,edges,32);for(const [i,j] of [[16,16],[8,8],[0,0]]){const v=r.points[i*33+j],ref=navier(1,b,v.x,v.y);near(v.u,ref.u,Math.max(2e-5,ref.u*.012));for(const k of ['Mx','My','Mxy'])near(v[k],ref[k],.0015);}}
});
test('clamped square matches classical uniform-load benchmark and zero edge slope',()=>{
 const r=P.solve(1,1,Object.fromEntries(P.EDGES.map(k=>[k,'fixed'])),48),center=r.points[24*49+24],mid=r.points[24];
 // Classical plate reference: wD/(qa^4)=.00126 and edge Mn/(qa^2)=-.0513.
 near(r.maxU,.00126,.00002);near(mid.Mx,-.0513,.0004);near(center.Mx,.0231*1.2/1.3,.0003);
 near(mid.My,.2*mid.Mx,1e-9);near(mid.Mxy,0,1e-9);
});
test('all 16 restraint combinations converge; rotations and dimensional scaling are consistent',()=>{
 for(let mask=0;mask<16;mask++){const e=Object.fromEntries(P.EDGES.map((k,i)=>[k,(mask>>i)&1?'fixed':'simple'])),r=P.analyse(1,1.7,e);assert.ok(r.convergence<=.05);assert.ok(r.residual<1e-9);assert.ok(Object.values(r.envelope).every(v=>Number.isFinite(v)&&v>=0));}
 const e={...edges,right:'fixed',top:'fixed'},r=P.analyse(1,1.5,e),rot=P.analyse(1.5,1,{left:e.bottom,right:e.top,bottom:e.left,top:e.right}),big=P.analyse(2,3,e);
 near(r.envelope.bX,rot.envelope.bY,1e-7);near(r.envelope.tX,rot.envelope.tY,1e-7);near(big.envelope.bX,4*r.envelope.bX,1e-7);near(big.maxU,16*r.maxU,1e-7);near(big.shear.X,2*r.shear.X,1e-6);
});
test('two-way load combinations, direct-input isolation, zero load and corner top demand',()=>{
 const r=C.twoWay(p),d=C.twoWay({...p,dead:10,live:0});assert.equal(d.load.governing.name,'1.4D');near(r.load.governing.q,10.8);assert.ok(r.load.MtX>0);assert.ok(r.load.MtY>0);
 assert.ok(r.load.VX>=10.8*5/2);assert.ok(r.load.VY>=10.8*6/2);
 const direct=C.twoWay({...p,mode:'direct',dead:NaN,live:NaN,MbX:15,MbY:12,MtX:25,MtY:10,VX:25,VY:30});near(direct.load.MtX,25);assert.equal(direct.load.plate,null);
 const zero=C.twoWay({...p,dead:0,live:0});near(zero.load.MbX,0);assert.ok(zero.rows.every(v=>v.As>=v.AsMin&&v.spacing===zero.commonSpacing));
});
test('one-way automatic designs independently pass existing checks with identical face spacing',()=>{
 for(const support of ['simple','fixed','propped','proppedReverse','cantilever','cantileverReverse'])for(const fy of [400,500,600]){
  const r=C.oneWay({...p,h:300,support,fy,point:10}),v=O.calculate(r.p);assert.equal(r.p.bottomSpacing,r.p.topSpacing);assert.ok(v.bottom.ok&&v.top.ok&&v.temp.ok);assert.ok(r.bottom.As>=r.bottom.AsMin);assert.ok(r.top.As>=r.top.AsMin);
 }
 const low=C.oneWay(p),high=C.oneWay({...p,live:35});assert.ok(high.steelArea>low.steelArea);
 // No hidden nominal loads affect direct mode; no self weight is added.
 const direct=C.oneWay({...p,mode:'direct',dead:NaN,live:NaN,point:NaN,Mp:20,Mn:25,V:30});near(direct.load.Mp,20);
 const zero=C.oneWay({...p,dead:0,live:0});near(zero.load.Mp,0);near(zero.load.V,0);
});
test('mirroring the restrained end and point-load position preserves demands and rebar',()=>{
 for(const [support,mirror] of [['propped','proppedReverse'],['cantilever','cantileverReverse']]){
  const a=C.oneWay({...p,h:300,support,point:10,pointX:1}),b=C.oneWay({...p,h:300,support:mirror,point:10,pointX:2});
  for(const k of ['Mp','Mn','V'])near(a.load[k],b.load[k]);near(a.steelArea,b.steelArea);near(a.commonSpacing,b.commonSpacing);
 }
});
test('automatic slab reinforcement passes independent manual checker and all-face spacing constraint',()=>{
 const r=C.twoWay({...p,dead:10,live:15,left:'fixed',right:'fixed'}),manual={...r.p,...r.load};
 for(const row of r.rows){manual['bar'+row.key]=row.bar;manual['s'+row.key]=row.spacing;assert.equal(row.spacing,r.commonSpacing);assert.ok(row.flexOK&&row.detailOK);assert.ok(row.spacing<=row.maxSpacing);}
 const v=N.slab(manual);for(let i=0;i<v.rows.length;i++){near(v.rows[i].phiMn,r.rows[i].phiMn);near(v.rows[i].phiVc,r.rows[i].phiVc);}
 const b=r.rows.filter(v=>v.face==='b'),t=r.rows.filter(v=>v.face==='t');const inside=r.p.h-2*r.p.cover-[...b,...t].reduce((s,v)=>s+R.BARS[v.bar].diameter,0);assert.ok(inside>=100/3);
});
test('candidate ranking has no lighter feasible one-way combination in the discrete search',()=>{
 const r=C.oneWay({...p,mode:'direct',Mp:30,Mn:20,V:20}),q=r.p,min=S.minimumSteel(q);
 for(const s of C.SPACINGS)for(const a of C.BARS)for(const b of C.BARS){const bot=O.face({...q,bottomBar:a},'bottom',30,s),top=O.face({...q,topBar:b},'top',20,s);if(!bot.ok||!top.ok||Math.min(bot.As,top.As)<min)continue;for(const t of C.BARS)for(let st=75;st<=450;st+=25){const temp=2*R.BARS[t].area*1000/st;if(temp<min||st>5*q.h||st-R.BARS[t].diameter<Math.max(100/3,R.BARS[t].diameter)||q.h-2*q.cover-R.BARS[a].diameter-R.BARS[b].diameter-2*R.BARS[t].diameter<100/3)continue;assert.ok(bot.As+top.As+temp>=r.steelArea-1e-7);}}
});
test('shear failures are not hidden by successful automatic flexural design',()=>{
 const one=C.oneWay({...p,mode:'direct',Mp:20,Mn:20,V:1000});assert.equal(one.shear.ok,false);assert.equal(one.ok,false);
 const two=C.twoWay({...p,mode:'direct',MbX:20,MbY:20,MtX:20,MtY:20,VX:1000,VY:1000});assert.equal(two.ok,false);assert.ok(two.rows.every(v=>v.flexOK&&!v.shearOK));
 const thin=C.oneWay({...p,L:6});assert.equal(thin.thickness.referenceOk,false);assert.equal(thin.ok,false);
});
test('impossible demands, unsupported supports and invalid values cannot produce proposals',()=>{
 assert.throws(()=>C.oneWay({...p,mode:'direct',Mp:10000,Mn:20,V:20}),/자동 배근 설계 미달/);
 for(const patch of [{dead:-1},{live:NaN},{left:'free'},{h:80},{cover:150},{lx:0},{ly:11},{fy:700},{h:600}])assert.throws(()=>C.twoWay({...p,...patch}));
 assert.throws(()=>C.twoWay({...p,mode:'direct',MbX:10000,MbY:20,MtX:20,MtY:20,VX:20,VY:20}),/자동 배근 설계 미달/);
});
