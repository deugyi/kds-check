/* RC column P-M interaction by strain compatibility.
 * Units: mm, MPa for the section; kN and kN.m for reported strength.
 * Rectangular columns are checked about each axis in turn with the solver
 * carried over unchanged from the verified TI-Nspire rc_vert.py engine.
 * Circular columns are axisymmetric and use a circular-segment block.
 * Clauses, limits and omissions: docs/rc-column.md.
 */
(function(root){
'use strict';
const ES=200000;                       // KDS 14 20 10, 4.3.3(2)
const BARS={D10:{d:9.53,a:71.33},D13:{d:12.7,a:126.7},D16:{d:15.9,a:198.6},
  D19:{d:19.1,a:286.5},D22:{d:22.2,a:387.1},D25:{d:25.4,a:506.7},D29:{d:28.6,a:642.4},
  D32:{d:31.8,a:794.2},D35:{d:34.9,a:956.6},D38:{d:38.1,a:1140},D41:{d:41.3,a:1340}};
const HOOPS=['D10','D13','D16'];
const TIES={tie:{label:'띠철근',phi0:.65,k:.80,clause:'식 (4.1-17)',minBars:4},
            spiral:{label:'나선철근',phi0:.70,k:.85,clause:'식 (4.1-16)',minBars:6}};
const STEEL_DENSITY=7.85e-6;           // 7,850 kg/m3 as tonf per mm3 of length 1 m
// 표 4.1-2. Values between the tabulated strengths are linearly interpolated.
function params(fck){
  let ecu,eta,beta,t;
  if(fck<=40){ecu=.0033;eta=1.00;beta=.80;}
  else if(fck<=50){t=(fck-40)/10;ecu=.0033-.0001*t;eta=1.00-.03*t;beta=.80;}
  else if(fck<=60){t=(fck-50)/10;ecu=.0032-.0001*t;eta=.97-.02*t;beta=.80-.04*t;}
  else if(fck<=70){t=(fck-60)/10;ecu=.0031-.0001*t;eta=.95-.04*t;beta=.76-.02*t;}
  else if(fck<=80){t=(fck-70)/10;ecu=.0030-.0001*t;eta=.91-.04*t;beta=.74-.02*t;}
  else if(fck<=90){t=(fck-80)/10;ecu=.0029-.0001*t;eta=.87-.03*t;beta=.72-.02*t;}
  else {ecu=.0028;eta=.84;beta=.70;}
  return {ecu,eta,beta};
}
function tensionLimit(fy){return fy<=400?.005:2.5*fy/ES;}
function strengthFactor(et,fy,tie){
  const ey=fy/ES,etl=tensionLimit(fy),phi0=TIES[tie].phi0;
  if(et<=ey)return phi0;
  if(et>=etl)return .85;
  return phi0+(.85-phi0)*(et-ey)/(etl-ey);
}
function zone(phi,tie){
  const phi0=TIES[tie].phi0;
  if(phi>=.8499)return '인장지배단면';
  if(phi<=phi0+.0001)return '압축지배단면';
  return '변화구간단면';
}
function positive(v,name){if(!Number.isFinite(v)||v<=0)throw Error(`${name}은 0보다 큰 숫자여야 합니다.`);}
function validate(p){
  for(const [k,n] of [['fck','콘크리트 강도'],['fy','주철근 강도'],['fyt','횡보강근 강도'],['cover','피복두께'],['spacing','횡보강근 간격']])positive(p[k],n);
  if(!TIES[p.tie])throw Error('횡보강 형식을 선택해 주세요.');
  if(!BARS[p.bar])throw Error('주철근 규격을 선택해 주세요.');
  if(!HOOPS.includes(p.hoop))throw Error('횡보강근 규격은 D10·D13·D16 중에서 선택해 주세요.');
  if(p.fck<21||p.fck>90)throw Error('콘크리트 강도 지원 범위는 21–90 MPa입니다.');
  if(p.fy>600)throw Error('주철근의 설계기준항복강도는 600 MPa 이하입니다. (KDS 14 20 10, 4.2.4)');
  if(p.tie==='spiral'&&p.fyt>700)throw Error('나선철근의 설계기준항복강도는 700 MPa 이하입니다. (KDS 14 20 20, 4.3.2(3))');
  if(!Number.isInteger(p.n)||p.n<TIES[p.tie].minBars)
    throw Error(`주철근 개수는 ${TIES[p.tie].minBars}개 이상의 정수여야 합니다. (KDS 14 20 20, 4.3.2(2))`);
  if(p.shape==='rect'){
    positive(p.b,'단면 폭 b');positive(p.h,'단면 깊이 h');
    if(!Number.isInteger(p.rows)||p.rows<2)throw Error('주철근 행 수는 2 이상의 정수여야 합니다.');
    if(p.n%2)throw Error('둘레 배근에서는 주철근 개수가 짝수여야 합니다.');
    const perRow=(p.n-2*p.rows+4)/2;
    if(perRow<2)throw Error(`주철근 ${p.n}개를 ${p.rows}행으로 배치할 수 없습니다. 개수를 늘리거나 행 수를 줄여 주세요.`);
  }else if(p.shape==='circle')positive(p.D,'단면 지름 D');
  else throw Error('단면 형상을 선택해 주세요.');
  if(p.Pu!==null&&(!Number.isFinite(p.Pu)||p.Pu<0))throw Error('소요축력 Pu는 0 이상의 숫자여야 합니다.');
  for(const [k,n] of [['Mux','소요휨모멘트 Mux'],['Muy','소요휨모멘트 Muy']])
    if(p[k]!==undefined&&(!Number.isFinite(p[k])||p[k]<0))throw Error(`${n}은 0 이상의 숫자여야 합니다.`);
}
/* Bars are laid out in real 2D coordinates about the centroid so the same
 * arrangement can be regrouped into layers for either axis. */
function layout(p){
  const bar=BARS[p.bar],hoop=BARS[p.hoop];
  const inset=p.cover+hoop.d+bar.d/2,bars=[];
  if(p.shape==='circle'){
    const r=p.D/2-inset;
    if(r<=0)throw Error('피복과 철근 지름이 단면 지름을 초과합니다.');
    for(let i=0;i<p.n;i++){
      const t=2*Math.PI*i/p.n;
      bars.push({As:bar.a,x:r*Math.cos(t),y:r*Math.sin(t)});
    }
    return {bars,inset,bar,hoop,barRadius:r};
  }
  const x0=p.b/2-inset,y0=p.h/2-inset;
  if(x0<=0||y0<=0)throw Error('피복과 철근 지름이 단면 치수를 초과합니다.');
  const perRow=(p.n-2*p.rows+4)/2;
  for(let i=0;i<p.rows;i++){
    const y=y0-2*y0*i/(p.rows-1),count=(i===0||i===p.rows-1)?perRow:2;
    for(let j=0;j<count;j++)bars.push({As:bar.a,x:count===1?0:-x0+2*x0*j/(count-1),y});
  }
  return {bars,inset,bar,hoop,perRow,x0,y0};
}
// Depth measured from the compression face, so the rectangular solver can be
// reused unchanged for either axis by swapping which coordinate is the depth.
function layersAlong(bars,axis,depth){
  const map=new Map();
  for(const b of bars){
    const d=Math.round((depth/2-(axis==='y'?b.y:b.x))*1e6)/1e6;
    map.set(d,(map.get(d)||0)+b.As);
  }
  return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([d,As])=>[As,d]);
}
/* Rectangular block. Unchanged from the verified engine. */
function pmcRect(sec,fck,fy,c,tie){
  const k=params(fck),m=k.eta*.85*fck,h=sec.h;
  const a=k.beta*c,ae=Math.min(a,h);
  const Cc=m*sec.b*ae/1000,arm=h/2-ae/2;
  let Pn=Cc,Mn=Cc*arm/1000;
  const rows=[];
  for(const [As,d] of sec.lay){
    const es=k.ecu*(c-d)/c;
    let fs=Math.max(-fy,Math.min(fy,ES*es));
    if(d<=ae&&fs>0)fs-=m;
    const F=As*fs/1000;
    Pn+=F;Mn+=F*(h/2-d)/1000;
    rows.push({d,As,es,fs,F});
  }
  const et=k.ecu*(sec.dt-c)/c;
  return {c,a,ae,Cc,arm,Pn,Mn,et,phi:strengthFactor(et,fy,tie),rows,m,params:k};
}
/* Circular segment of depth a from the compression face of a circle of radius R.
 * Returns the area and the centroid distance from the section centre. */
function segment(R,a){
  if(a<=0)return {A:0,arm:0};
  if(a>=2*R)return {A:Math.PI*R*R,arm:0};
  const dist=R-a,A=R*R*Math.acos(dist/R)-dist*Math.sqrt(R*R-dist*dist);
  return {A,arm:A>0?2/3*Math.pow(R*R-dist*dist,1.5)/A:0};
}
function pmcCircle(sec,fck,fy,c,tie){
  const k=params(fck),m=k.eta*.85*fck,R=sec.D/2;
  const a=k.beta*c,seg=segment(R,Math.min(a,2*R));
  const Cc=m*seg.A/1000;
  let Pn=Cc,Mn=Cc*seg.arm/1000;
  const rows=[];
  for(const [As,d] of sec.lay){
    const es=k.ecu*(c-d)/c;
    let fs=Math.max(-fy,Math.min(fy,ES*es));
    if(d<=Math.min(a,2*R)&&fs>0)fs-=m;
    const F=As*fs/1000;
    Pn+=F;Mn+=F*(R-d)/1000;
    rows.push({d,As,es,fs,F});
  }
  const et=k.ecu*(sec.dt-c)/c;
  return {c,a,ae:Math.min(a,2*R),Cc,arm:seg.arm,Pn,Mn,et,phi:strengthFactor(et,fy,tie),rows,m,params:k};
}
const solverFor=sec=>sec.shape==='circle'?pmcCircle:pmcRect;
function bisect(sec,fck,fy,tie,goesUp){
  const pm=solverFor(sec);
  let lo=.01*sec.dt,hi=12*sec.depth;
  for(let i=0;i<160;i++){const c=.5*(lo+hi);if(goesUp(pm(sec,fck,fy,c,tie)))lo=c;else hi=c;}
  return pm(sec,fck,fy,.5*(lo+hi),tie);
}
const pureFlexure=(sec,fck,fy,tie)=>bisect(sec,fck,fy,tie,r=>r.Pn<0);
const atEccentricity=(sec,fck,fy,tie,e)=>bisect(sec,fck,fy,tie,r=>r.Mn*1000-e*r.Pn>0);
// KDS 14 20 20, 4.1.2(7) and 식 (4.1-16)(4.1-17).
function axial(Ag,Ast,fck,fy,tie){
  const t=TIES[tie],Po=(.85*fck*(Ag-Ast)+fy*Ast)/1000;
  return {Po,k:t.k,phi0:t.phi0,clause:t.clause,phiPnMax:t.k*t.phi0*Po};
}
function curve(sec,fck,fy,tie,phiPnMax,steps){
  const pm=solverFor(sec),n=steps||220,cmax=6*sec.depth,lo=.02*sec.dt,pts=[];
  for(let i=0;i<=n;i++){
    const c=lo+(cmax-lo)*Math.pow(i/n,1.6),r=pm(sec,fck,fy,c,tie);
    pts.push({c,Mn:r.Mn,Pn:r.Pn,phiMn:r.phi*r.Mn,phiPn:Math.min(r.phi*r.Pn,phiPnMax)});
  }
  return pts;
}
// One uniaxial check: builds the layer model for this axis and solves it.
function checkAxis(p,geo,name,label,width,depth,axis,Mu){
  const lay=layersAlong(geo.bars,axis,depth);
  const dt=lay.reduce((m,L)=>Math.max(m,L[1]),0);
  const sec=p.shape==='circle'
    ?{shape:'circle',D:p.D,depth,lay,dt}
    :{shape:'rect',b:width,h:depth,depth,lay,dt};
  const Ag=p.shape==='circle'?Math.PI*p.D*p.D/4:p.b*p.h;
  const Ast=geo.bars.reduce((s,b)=>s+b.As,0);
  const ax=axial(Ag,Ast,p.fck,p.fy,p.tie);
  const k=params(p.fck),ey=p.fy/ES,etl=tensionLimit(p.fy);
  const cb=k.ecu/(k.ecu+ey)*dt,ct=k.ecu/(k.ecu+etl)*dt;
  const pm=solverFor(sec);
  const balanced=pm(sec,p.fck,p.fy,cb,p.tie),tensionPoint=pm(sec,p.fck,p.fy,ct,p.tie);
  const flexure=pureFlexure(sec,p.fck,p.fy,p.tie);
  const Pu=p.Pu===null?0:p.Pu,pure=Pu<=0,e=pure?null:Mu*1000/Pu;
  const r=pure?flexure:atEccentricity(sec,p.fck,p.fy,p.tie,e);
  const raw=r.phi*r.Pn,capped=raw>ax.phiPnMax;
  const demand={...r,e,pure,Mu,zone:zone(r.phi,p.tie),
    phiPn:capped?ax.phiPnMax:raw,rawPhiPn:raw,capped,phiMn:r.phi*r.Mn};
  demand.ratioP=pure?null:Pu/demand.phiPn;
  demand.ratioM=demand.phiMn>0?Mu/demand.phiMn:Infinity;
  demand.ok=pure?Mu<=demand.phiMn:(Pu<=demand.phiPn&&Mu<=demand.phiMn);
  return {name,label,width,depth,axis,sec,lay,dt,Ag,Ast,axial:ax,ey,etl,
    balanced:{...balanced,cb,eb:balanced.Pn>0?balanced.Mn*1000/balanced.Pn:null},
    tensionPoint:{...tensionPoint,ct},flexure,demand,
    curve:curve(sec,p.fck,p.fy,p.tie,ax.phiPnMax)};
}
/* Transverse reinforcement detailing. KDS 14 20 50, 4.4.2 and KDS 14 20 20,
 * 4.3.2(3). Confinement is not credited to the P-M strength. */
function transverse(p,geo,Ag){
  const bar=geo.bar,hoop=geo.hoop,reasons=[];
  const minHoop=bar.d>31.8+1e-9?'D13':'D10';
  if(BARS[p.hoop].d<BARS[minHoop].d-1e-9)
    reasons.push(`${p.bar} 주철근에는 ${minHoop} 이상의 띠철근이 필요합니다 (KDS 14 20 50, 4.4.2(3)①)`);
  let maxSpacing=null,limits=null;
  if(p.tie==='tie'){
    const least=p.shape==='circle'?p.D:Math.min(p.b,p.h);
    limits=[{v:16*bar.d,why:'축방향 철근지름의 16배'},{v:48*hoop.d,why:'띠철근 지름의 48배'},{v:least,why:'단면 최소 치수'}];
    maxSpacing=Math.min(...limits.map(l=>l.v));
    if(p.spacing>maxSpacing+1e-9)reasons.push('띠철근 수직간격이 최대 간격을 초과합니다 (KDS 14 20 50, 4.4.2(3)②)');
  }
  let spiral=null;
  if(p.tie==='spiral'){
    if(p.shape!=='circle')throw Error('나선철근은 원형 단면에만 적용합니다.');
    const Dch=p.D-2*p.cover,Ach=Math.PI*Dch*Dch/4;
    const required=.45*(Ag/Ach-1)*p.fck/p.fyt;                 // 식 (4.3-1)
    const provided=4*hoop.a/(Dch*p.spacing);
    spiral={Dch,Ach,required,provided,ok:provided>=required-1e-9};
    if(!spiral.ok)reasons.push('나선철근비가 식 (4.3-1)의 하한에 미달합니다');
    if(p.spacing<25||p.spacing>75)reasons.push('나선철근 순간격은 25~75 mm입니다 (KDS 14 20 50, 4.4.2(2)④)');
    if(hoop.d<10)reasons.push('현장치기 나선철근의 지름은 10 mm 이상입니다 (KDS 14 20 50, 4.4.2(2)③)');
  }
  return {hoop:p.hoop,spacing:p.spacing,minHoop,maxSpacing,limits,spiral,reasons,ok:!reasons.length};
}
/* Quantities and cost for one metre of column. Preliminary takeoff only:
 * hooks, laps, splices and bends are not included. */
function quantities(p,geo,Ag,Ast){
  const hoop=geo.hoop;
  let cut;
  if(p.shape==='circle'){
    const Dch=p.D-2*p.cover-hoop.d;
    cut=Math.PI*Dch;                    // one turn of the spiral or one circular tie
  }else{
    const W=p.b-2*p.cover-hoop.d,H=p.h-2*p.cover-hoop.d;
    if(W<=0||H<=0)throw Error('횡보강근을 배치할 내부 단면 공간이 없습니다.');
    cut=2*(W+H)+2*Math.max(6*hoop.d,75);
  }
  const stations=1000/p.spacing;
  const concrete=Ag/1e6,main=Ast*STEEL_DENSITY;
  const hoopWeight=hoop.a*cut/1000*stations*STEEL_DENSITY;
  const net=main+hoopWeight,steel=net*(1+p.wastePercent/100);
  const concreteCost=concrete*p.concretePrice,steelCost=steel*p.steelPrice;
  return {concrete,main,hoop:hoopWeight,net,steel,cut,stations,
    concreteCost,steelCost,totalCost:concreteCost+steelCost};
}
function calculate(p){
  validate(p);
  const geo=layout(p);
  const Ag=p.shape==='circle'?Math.PI*p.D*p.D/4:p.b*p.h;
  const Ast=geo.bars.reduce((s,b)=>s+b.As,0),rho=Ast/Ag;
  const axes=p.shape==='circle'
    ?[checkAxis(p,geo,'axis','축대칭 (모든 방향)',p.D,p.D,'y',Math.max(p.Mux||0,p.Muy||0))]
    :[checkAxis(p,geo,'x','X축 휨 Mux (깊이 h)',p.b,p.h,'y',p.Mux||0),
      checkAxis(p,geo,'y','Y축 휨 Muy (깊이 b)',p.h,p.b,'x',p.Muy||0)];
  const notes=[];
  if(rho<.01||rho>.08)notes.push(`철근비 ρ = ${rho.toFixed(5)}가 0.01~0.08 범위를 벗어납니다 (4.3.2(1))`);
  else if(rho>.04)notes.push('겹침이음 구간의 철근비는 0.04 이하로 하여야 합니다 (4.3.2(1))');
  const Pu=p.Pu===null?0:p.Pu,lowAxial=.10*p.fck*Ag/1000;
  if(Pu<lowAxial)notes.push(`Pu가 0.10·fck·Ag = ${lowAxial.toFixed(1)} kN보다 작아 4.1.2(5)에 따라 휨부재로 취급할 수 있습니다`);
  return {geo,Ag,Ast,rho,axes,params:params(p.fck),ES,notes,
    transverse:transverse(p,geo,Ag),quantities:quantities(p,geo,Ag,Ast),
    ok:axes.every(a=>a.demand.ok)};
}
root.RCColumn={ES,BARS,HOOPS,TIES,params,tensionLimit,strengthFactor,zone,layout,
  layersAlong,pmcRect,pmcCircle,segment,pureFlexure,atEccentricity,axial,curve,
  transverse,quantities,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCColumn;
})(typeof globalThis!=='undefined'?globalThis:this);
