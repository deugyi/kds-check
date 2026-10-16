const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../composite-column.js'),T=require('../composite-column-studs.js');
const base={type:'src',steelLayout:'cross',crossConnected:true,B:800,H:800,fck:30,Fy:355,klx:4000,kly:4000,Pu:4000,Mux:300,Muy:200,
 shapeMode:'bh',sh:500,sb:200,tw:10,tf:16,shapeMode2:'bh',sh2:500,sb2:200,tw2:10,tf2:16,
 fy:500,bar:'D25',tie:'D13',cover:40,tieSpacing:200,nb:4,nh:4,t:16};
const stud={length:4000,diameter:19,head:32,height:100,Fu:450,perLevel:4,spacing:150,edge:200,loadPath:'steel',steelShare:50,introLoad:null,outsideFlow:null};
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hProps=(h,b,tw,tf)=>({A:2*b*tf+(h-2*tf)*tw,Ix:(b*h**3-(b-tw)*(h-2*tf)**3)/12,Iy:2*tf*b**3/12+(h-2*tf)*tw**3/12});

test('equal orthogonal H shapes subtract the web crossing and swap principal inertias',()=>{
 const o=C.calculate(base),h=hProps(500,200,10,16);
 near(o.overlap,100);near(o.props.steel.A,2*h.A-100);near(o.props.steel.Ix,h.Ix+h.Iy-10**4/12);near(o.props.steel.Ix,o.props.steel.Iy);
 near(o.mx.phiMn,o.my.phiMn);near(o.axes[0].EI,o.axes[1].EI);assert.equal(o.steelMembers.length,2);assert.ok(o.ok&&o.supported);
});
test('unequal H shapes use axis-dependent web intersection inertia',()=>{
 const o=C.calculate({...base,sh2:450,sb2:180,tw2:9,tf2:14}),a=hProps(500,200,10,16),b=hProps(450,180,9,14);
 near(o.overlap,90);near(o.props.steel.A,a.A+b.A-90);
 near(o.props.steel.Ix,a.Ix+b.Iy-10*9**3/12);near(o.props.steel.Iy,a.Iy+b.Ix-9*10**3/12);assert.notEqual(o.props.steel.Ix,o.props.steel.Iy);
});
test('wide flange intersections include four corner overlaps as well as the web intersection',()=>{
 const o=C.calculate({...base,sh:400,sb:400,tw:13,tf:21,sh2:400,sb2:400,tw2:13,tf2:21}),h=hProps(400,400,13,21);
 near(o.overlap,13**2+4*21**2);near(o.props.steel.A,2*h.A-1933);
});
test('union cells never overlap and preserve centroid symmetry',()=>{
 const o=C.calculate({...base,sh2:450,sb2:180,tw2:9,tf2:14});
 for(let i=0;i<o.steel.length;i++)for(let j=i+1;j<o.steel.length;j++){
  const a=o.steel[i],b=o.steel[j];assert.ok(Math.min(a.x+a.b/2,b.x+b.b/2)-Math.max(a.x-a.b/2,b.x-b.b/2)<=1e-8||Math.min(a.y+a.h/2,b.y+b.h/2)-Math.max(a.y-a.h/2,b.y-b.h/2)<=1e-8);
 }
 near(o.steel.reduce((v,q)=>v+q.b*q.h*q.x,0),0);near(o.steel.reduce((v,q)=>v+q.b*q.h*q.y,0),0);
});
test('gross area/inertia are conserved and axial resistance uses the union area once',()=>{
 const o=C.calculate(base),s=o.props.steel,r=o.props.bars,c=o.props.concrete;
 near(s.A+r.A+c.A,800**2);near(s.Ix+r.Ix+c.Ix,800**4/12);near(s.Iy+r.Iy+c.Iy,800**4/12);
 near(o.Pno,(355*s.A+500*r.A+.85*30*c.A)/1000);near(o.mass,(s.A+r.A)*.00785);near(o.concreteVolume,c.A/1e6);
 const coefficient=Math.min(.3,.1+2*s.A/(c.A+s.A));near(o.axes[0].EI,210000*s.Ix+.5*200000*r.Ix+coefficient*(8500*Math.cbrt(34))*c.Ix);
});
test('swapping the two H shapes exchanges axes, flexure capacities and effective lengths consistently',()=>{
 const p={...base,sh2:450,sb2:180,tw2:9,tf2:14,klx:3500,kly:5000},a=C.calculate(p);
 const b=C.calculate({...p,sh:p.sh2,sb:p.sb2,tw:p.tw2,tf:p.tf2,sh2:p.sh,sb2:p.sb,tw2:p.tw,tf2:p.tf,klx:p.kly,kly:p.klx,Mux:p.Muy,Muy:p.Mux});
 near(a.props.steel.Ix,b.props.steel.Iy);near(a.mx.phiMn,b.my.phiMn);near(a.Pr,b.Pr);near(a.combined.value,b.combined.value);
});
test('cross-section bending agrees with independent union-of-intervals strip integration on both axes',()=>{
 const p={...base,sh2:450,sb2:180,tw2:9,tf2:14},o=C.calculate(p);
 const raw=(h,b,tw,tf)=>[[b,tf,0,(h-tf)/2],[tw,h-2*tf,0,0],[b,tf,0,-(h-tf)/2]];
 const shapes=[...raw(p.sh,p.sb,p.tw,p.tf),...raw(p.sh2,p.sb2,p.tw2,p.tf2).map(([b,h,x,y])=>[h,b,-y,x])];
 for(const axis of ['X','Y']){
  const result=axis==='X'?o.mx:o.my,depth=axis==='X'?p.H:p.B,width=axis==='X'?p.B:p.H,dy=.02;let N=0,M=0;
  for(let z=-depth/2+dy/2;z<depth/2;z+=dy){
   const intervals=shapes.map(([b,h,x,y])=>axis==='X'?{center:y,depth:h,a:x-b/2,b:x+b/2}:{center:x,depth:b,a:y-h/2,b:y+h/2}).filter(q=>Math.abs(z-q.center)<q.depth/2).sort((a,b)=>a.a-b.a);
   let steelWidth=0,end=-Infinity;for(const q of intervals){steelWidth+=Math.max(0,q.b-Math.max(q.a,end));end=Math.max(end,q.b);}
   const barWidth=o.bars.reduce((sum,q)=>{const v=z-(axis==='X'?q.y:q.x);return sum+(Math.abs(v)<q.r?2*Math.sqrt(q.r*q.r-v*v)*q.w:0);},0);
   const stress=(z>result.neutral?1:-1)*(355*steelWidth+500*barWidth)+(z>result.neutral?.85*30*(width-steelWidth-barWidth):0);
   N+=stress*dy;M+=stress*z*dy;
  }
  assert.ok(Math.abs(N)<4000,`axial equilibrium ${axis}: ${N}`);near(.9*Math.abs(M)/1e6,result.phiMn,5e-4);
 }
});
test('a material sign reversal leaves biaxial demand ratios unchanged',()=>{
 const a=C.calculate(base),b=C.calculate({...base,Mux:-300,Muy:-200});near(a.combined.value,b.combined.value);
});
test('both RH shapes resolve independently and BH dimensions remain independently editable',()=>{
 const o=C.calculate({...base,shapeMode:'rh',section:'H-500×200×10×16',shapeMode2:'rh',section2:'H-450×200×9×14',sh2:1,tf2:1});
 assert.equal(o.p.sh,500);assert.equal(o.p.sh2,450);assert.equal(o.p.tf2,14);
 assert.equal(C.calculate({...base,sh2:470}).p.sh2,470);assert.throws(()=>C.calculate({...base,shapeMode2:'rh',section2:'unknown'}));
});
test('unknown connection details retain computed results but cannot receive an overall pass',()=>{
 for(const connected of [undefined,false,'confirmed']){const o=C.calculate({...base,crossConnected:connected});assert.ok(o.Pr>0);assert.equal(o.ok,false);assert.equal(o.supported,false);assert.ok(o.checks.some(c=>/独立|독립좌굴/.test(c.label)&&!c.ok));}
 assert.ok(C.calculate(base).supported);
});
test('built-up bare-steel torsional buckling is not mistaken for a single-H lower bound',()=>{
 const o=C.calculate({...base,klx:100000,kly:100000});assert.equal(o.steelPr,null);assert.equal(o.ok,false);assert.ok(o.checks.some(q=>q.label==='순강재 압축강도 하한'&&!q.ok));
});
test('rotated size bounds, missing dimensions and steel/rebar interference cannot pass',()=>{
 for(const change of [{sh2:NaN},{sb2:0},{tw2:-1},{tf2:300},{sh2:800},{sb2:800},{steelLayout:'bad'}])assert.throws(()=>C.calculate({...base,...change}));
 assert.throws(()=>C.calculate({...base,B:600,sh2:650}),/90°/);
 assert.throws(()=>C.calculate({...base,sh2:680,sb2:750}),/겹칩니다/);
});
test('single-H and CFT ignore unused secondary H input',()=>{
 const single=C.calculate({...base,steelLayout:'single',sh2:NaN,section2:'bad'});near(single.props.steel.A,hProps(500,200,10,16).A);assert.equal(single.overlap,0);
 for(const type of ['rect','circle'])assert.ok(C.calculate({...base,type,sh2:NaN,section2:'bad',crossConnected:false}).Pr>0);
});
test('four-face stud placement uses the total per level, not four times the total',()=>{
 const t=T.calculate(C.calculate(base),stud);assert.equal(t.plan.length,4);assert.equal(t.count,32);assert.equal(new Set(t.plan.map(q=>q.face)).size,4);
 assert.equal(t.plan.filter(q=>q.member===1).length,2);assert.equal(t.plan.filter(q=>q.member===2).length,2);
 for(const q of t.plan)assert.ok(Math.hypot(q.hx,q.hy)>Math.hypot(q.x,q.y));
 near(t.capacity,32*t.phiQ);assert.ok(t.checks.find(q=>q.label==='직교 철골과 스터드 간섭').ok);
});
test('cross studs reject nonmultiples of four and check the thinner welded flange',()=>{
 const o=C.calculate(base);for(const perLevel of [2,6,10])assert.throws(()=>T.calculate(o,{...stud,perLevel}),/4의 배수/);
 const thin=C.calculate({...base,tf2:6}),t=T.calculate(thin,stud);assert.equal(t.checks.find(q=>q.label.startsWith('용접 모재')).ok,false);
});
test('studs clashing with the other H shape or lacking connection verification cannot pass',()=>{
 const o=C.calculate({...base,sh:400,sb:400,tw:13,tf:21,sh2:400,sb2:400,tw2:13,tf2:21});
 const blocked=T.calculate(o,{...stud,perLevel:8});assert.equal(blocked.checks.find(q=>q.label==='직교 철골과 스터드 간섭').ok,false);assert.equal(blocked.ok,false);
 const pending=T.calculate(C.calculate({...base,crossConnected:false}),stud);assert.equal(pending.ok,false);assert.equal(pending.checks.find(q=>q.label==='조립 형강 연결 확인').ok,false);
});
