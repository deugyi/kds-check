const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../rc-footing'),R=require('../rc-beam');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const base={mode:'pile',autoSize:true,pileCount:3,diameter:500,Ps:1500,Pu:2100};

test('three-pile envelope offsets footing only and preserves 1.25D on all four sides',()=>{
 const r=F.design(base),p=r.p,l=r.pileLayout;
 near(p.bx,2500);near(p.by,2350);near(p.footingX,0);near(p.footingY,1250/(4*Math.sqrt(3)));
 near(r.piles.reduce((s,v)=>s+v.x,0),0);near(r.piles.reduce((s,v)=>s+v.y,0),0);
 near(l.edgeLeft,625);near(l.edgeRight,625);near(l.edgeBottom,(2350-1250*Math.sqrt(3)/2)/2);near(l.edgeTop,l.edgeBottom);
 for(const key of ['edgeLeft','edgeRight','edgeBottom','edgeTop'])assert.ok(l[key]>=625);
 near(r.W,98.7);
});

test('independent three-pile self-weight distribution and both equilibrium sums',()=>{
 const r=F.design(base);
 for(const v of r.piles){const share=v.id===3?.5:.25;near(v.Rs,1500/3+98.7*share);near(v.Ru,2100/3+1.2*98.7*share);}
 near(r.piles.reduce((s,v)=>s+v.Rs,0),1500+98.7);
 near(r.piles.reduce((s,v)=>s+v.Ru,0),2100+1.2*98.7);
 near(r.piles.reduce((s,v)=>s+v.Rs*v.y,0),98.7*1.25/(4*Math.sqrt(3)));
 near(r.piles.reduce((s,v)=>s+v.Ru*v.y,0),1.2*98.7*1.25/(4*Math.sqrt(3)));
 near(r.punching.Mx,1.2*98.7*1.25/(4*Math.sqrt(3)));near(r.punching.My,0);
});

test('opposite column-face demands use their actual unequal self-weight projections',()=>{
 const r=F.design(base),y=r.rows.find(v=>v.axis==='Y'),offset=1.25/(4*Math.sqrt(3));
 const edgePlus=2.35/2+offset,edgeMinus=2.35/2-offset,yp=1.25/Math.sqrt(3),ym=1.25/(2*Math.sqrt(3)),q=1.2*.7*24;
 const pos=y.sides.find(v=>v.sign===1),neg=y.sides.find(v=>v.sign===-1);
 near(pos.M,759.22*(yp-.3)-q*2.5*(edgePlus-.3)**2/2);
 near(neg.M,2*729.61*(ym-.3)-q*2.5*(edgeMinus-.3)**2/2);
 const cut=.3+y.d/1000,partial=Math.max(0,Math.min(1,.5+(yp-cut)/.5));
 near(pos.V,759.22*partial-q*2.5*(edgePlus-cut));
 near(neg.V,-q*2.5*(edgeMinus-cut));
 near(y.Mu,Math.max(pos.M,neg.M)/2.5*(2*(2.5/2.35)/(2.5/2.35+1)));
});

test('reflecting pile envelope about column reverses self-weight moment without changing governing checks',()=>{
 const a=F.design(base),p=a.p;
 const b=F.calculate({...p,autoSize:false,footingY:-p.footingY,autoPoints:p.autoPoints.map(v=>({...v,y:-v.y}))});
 near(b.selfMoments.Mxu,-a.selfMoments.Mxu);
 for(let i=0;i<3;i++)near(b.piles[i].Ru,a.piles[i].Ru);
 for(let i=0;i<2;i++){near(b.rows[i].Mu,a.rows[i].Mu);near(b.rows[i].Vu,a.rows[i].Vu);}
 near(b.punching.ratio,a.punching.ratio);
});

test('shifted footing contains the full column and full punching perimeter',()=>{
 const p={mode:'pile',autoSize:true,pileCount:3,diameter:500};
 assert.throws(()=>F.calculate({...p,cy:2000}),/기둥은 기초보다/);
 // Fits a centred 2350 mm rectangle, but not the actual lower edge near -995.
 assert.throws(()=>F.calculate({...p,h:1800}),/위험둘레가 기초 밖/);
});

test('shear grids translate with footing while punching rings remain at column and inside nearest edge',()=>{
 const r=F.calculate({mode:'pile',autoSize:true,pileCount:3,diameter:500,gapFactor:4,h:650,Nu:3500}),s=r.reinforcement,pr=s.punching;
 assert.ok(pr.needed&&pr.ok);assert.ok(s.points.some(v=>v.type!=='P'));
 const margin=r.p.cover+R.BARS[r.p.shearBar].diameter/2,b=r.bounds;
 for(const v of s.points){assert.ok(v.x>=b.left+margin-1e-7&&v.x<=b.right-margin+1e-7);assert.ok(v.y>=b.bottom+margin-1e-7&&v.y<=b.top-margin+1e-7);}
 const grid=s.points.filter(v=>v.type==='Y');
 near((Math.min(...grid.map(v=>v.y))+Math.max(...grid.map(v=>v.y)))/2,r.p.footingY);
 assert.ok(-pr.outer.by/2>b.bottom+margin);assert.ok(pr.outer.by/2<b.top-margin);
 assert.ok(-pr.outer.bx/2>b.left+margin);assert.ok(pr.outer.bx/2<b.right-margin);
 for(const ring of pr.rings){near(ring.points.reduce((s,v)=>s+v.x,0),0);near(ring.points.reduce((s,v)=>s+v.y,0),0);}
 const inner=pr.inner,jx=r.d*(inner.bx*inner.by**2/2+inner.by**3/6);
 near(inner.vu,r.totalU*1000/(inner.b0*r.d)+Math.abs(r.selfMoments.Mxu)*1e6*inner.by/2/jx);
});
