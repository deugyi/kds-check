const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../composite-column'),T=require('../composite-column-studs');
const base={type:'src',B:800,H:800,fck:30,Fy:355,klx:4000,kly:4000,Pu:4000,Mux:300,Muy:200,shapeMode:'rh',section:'H-400×400×13×21',fy:500,bar:'D25',tie:'D13',cover:40,tieSpacing:200,nb:4,nh:4,t:16};
const p={length:4000,diameter:19,head:32,height:100,Fu:450,perLevel:4,spacing:150,edge:200,loadPath:'steel',steelShare:50,introLoad:null,outsideFlow:null};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('load-introduction length, count and force match independent arithmetic',()=>{
 const o=C.calculate(base),t=T.calculate(o,p);near(t.Lin,4000/3);assert.equal(t.levels,8);assert.equal(t.count,32);
 assert.deepEqual(t.z,[200,350,500,650,800,950,1100,1250]);assert.ok(t.z.every(z=>z<=t.Lin));
 near(t.demand,4000*(1-355*o.props.steel.A/(o.Pno*1000)));
 near(t.phiQ,.65*450*Math.PI*19**2/4/1000);near(t.capacity,32*t.phiQ);
 assert.equal(t.required,Math.ceil(t.demand/t.phiQ));assert.equal(t.outside,null);
});
test('steel, concrete and split introduction use the correct force direction',()=>{
 const o=C.calculate(base),s=T.calculate(o,p),c=T.calculate(o,{...p,loadPath:'concrete'});
 near(s.demand+c.demand,4000);
 near(T.calculate(o,{...p,loadPath:'both',steelShare:s.ratio*100}).demand,0);
 near(T.calculate(o,{...p,introLoad:2000}).demand,s.demand/2);
});
test('zero/short zone counts, final boundary and doubled faces cannot overcount',()=>{
 const o=C.calculate(base);
 assert.equal(T.calculate(o,{...p,length:300}).count,0);
 const t=T.calculate(o,{...p,length:3000,spacing:200});assert.equal(t.levels,5);assert.equal(t.count,20);assert.equal(t.z.at(-1),1000);
});
test('4.8.3 length, spacing and placement limits block approval',()=>{
 const o=C.calculate(base);
 for(const change of [{spacing:70},{spacing:1000},{height:60},{height:180},{length:300}])assert.equal(T.calculate(o,{...p,...change}).ok,false);
 for(const change of [{spacing:0},{Fu:NaN},{perLevel:3},{length:0},{introLoad:-1},{outsideFlow:-1}])assert.throws(()=>T.calculate(o,{...p,...change}));
});
test('SRC studs are paired outwards and CFT anchors point into the concrete',()=>{
 const src=T.calculate(C.calculate(base),p);assert.ok(src.plan.every(q=>Math.abs(q.hy)>Math.abs(q.y)));
 const rect=T.calculate(C.calculate({...base,type:'rect'}),p);assert.ok(rect.plan.every(q=>Math.abs(q.hy)<Math.abs(q.y)));
 const circle=T.calculate(C.calculate({...base,type:'circle'}),{...p,perLevel:8});
 for(const q of circle.plan){near(Math.hypot(q.x,q.y),384);near(Math.hypot(q.hx,q.hy),284);}
 near(circle.plan.reduce((v,q)=>v+q.x,0),0);near(circle.plan.reduce((v,q)=>v+q.y,0),0);
});
test('outside-region flow has its own demand and cannot pass with invalid spacing',()=>{
 const o=C.calculate({...base,type:'circle'}),t=T.calculate(o,{...p,outsideFlow:10});assert.equal(t.outside.ok,true);
 assert.equal(T.calculate(o,{...p,outsideFlow:1e9}).outside.ok,false);
 assert.equal(T.calculate(o,{...p,outsideFlow:0,spacing:30}).outside.ok,false);
});
test('stud design shear follows 4.8.3.1 and does not depend on the concrete',()=>{
 const o=C.calculate(base),a=Math.PI*19**2/4;
 for(const Fu of [200,450,1200]){
  const t=T.calculate(o,{...p,Fu});
  near(t.Qnv,a*Fu/1000);near(t.phiQ,.65*a*Fu/1000);assert.equal(t.phi,.65);
  near(T.calculate(o,{...p,Fu,outsideFlow:1}).outside.capacity,p.perLevel*t.phiQ/(p.spacing/1000));
 }
 // Qnv = Fu·Asc has no concrete term, so fck does not change it.
 near(T.calculate(C.calculate({...base,fck:21}),p).phiQ,T.calculate(C.calculate({...base,fck:60}),p).phiQ);
 near(T.calculate(o,p).phiQ,.65*450*a/1000);
});
test('4.8.3.5 detailing replaces the composite-beam limits',()=>{
 const o=C.calculate(base),checks=change=>T.calculate(o,{...p,...change}).checks;
 const find=(list,k)=>list.find(c=>c.label.startsWith(k));
 // 4d longitudinal spacing is enough; the former 6d beam limit no longer applies.
 assert.equal(find(checks({spacing:80}),'길이방향 중심 간격').ok,true);
 assert.equal(find(checks({spacing:70}),'길이방향 중심 간격').ok,false);
 // No 200 mm edge-distance or head-diameter rule for shear-only embedded studs.
 assert.ok(!checks({}).some(c=>/머리 직경|단부 거리/.test(c.label)));
 assert.equal(find(checks({edge:50}),'도입부 내').ok,true);
 // A round CFT pitch above 32d fails the maximum spacing in any direction.
 const circle=C.calculate({...base,type:'circle'});
 assert.equal(find(T.calculate(circle,{...p,perLevel:2}).checks,'단면방향 중심 간격').ok,false);
 assert.equal(find(T.calculate(circle,{...p,perLevel:4}).checks,'단면방향 중심 간격').ok,true);
});
