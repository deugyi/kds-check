/* Basement slab spanning between isolated footings, resisting groundwater
 * uplift. Direct design method; flexural reinforcement only.
 * Units: mm, MPa for the section; kN, m for loads; reported moment kN.m/m.
 * Assumptions, clauses and deliberate omissions: docs/rc-slab-uplift.md.
 */
(function(root){
'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const BARS=['D10','D13','D16','D19','D22','D25'];
const SPACINGS=[100,125,150,175,200,250,300];
// KDS 14 20 70 표 4.1-1. Column order follows the standard end-span cases.
const END_CASES=[
  {name:'구속되지 않은 외부 받침부',interior:.75,positive:.63,exterior:0},
  {name:'모든 받침부 사이에 보가 있는 슬래브',interior:.70,positive:.57,exterior:.16},
  {name:'보 없는 슬래브 · 테두리보 없음',interior:.70,positive:.52,exterior:.26},
  {name:'보 없는 슬래브 · 테두리보 있음',interior:.70,positive:.50,exterior:.30},
  {name:'완전 구속된 외부 받침부',interior:.65,positive:.35,exterior:.65}
];
// Beamless slab, so alpha1 = 0 and betaT = 0 collapse 표 4.1-2/3/4 to constants.
const COLUMN_STRIP={interior:.75,positive:.60,exterior:1.00};
const ES=200000;

function positive(value,name){if(!Number.isFinite(value)||value<=0)throw Error(`${name}은 0보다 큰 숫자여야 합니다.`);}
function nonnegative(value,name){if(!Number.isFinite(value)||value<0)throw Error(`${name}은 0 이상의 숫자여야 합니다.`);}
function validate(p){
  for(const [k,n] of [['l1','장변방향 그리드 경간'],['l2','단변방향 그리드 경간'],['footing','기초 크기'],['h','슬래브 두께'],['fck','콘크리트 강도'],['fy','철근 강도'],['spacing','철근 간격'],['gammaW','물 단위중량'],['gammaC','콘크리트 단위중량']])positive(p[k],n);
  for(const [k,n] of [['hw','지하수위 수두'],['qsd','고정 상재하중'],['coverTop','상부 피복'],['coverBottom','하부 피복']])nonnegative(p[k],n);
  if(!BARS.includes(p.bar))throw Error('지원하는 철근 규격을 선택해 주세요.');
  if(!R.FY.includes(p.fy))throw Error('지원하는 철근 강도를 선택해 주세요.');
  if(p.fck<21||p.fck>90)throw Error('콘크리트 강도 지원 범위는 21–90 MPa입니다.');
  if(p.footing>=Math.min(p.l1,p.l2))throw Error('기초 크기가 그리드 경간 이상입니다.');
  if(p.coverTop+p.coverBottom>=p.h)throw Error('상하 피복의 합이 슬래브 두께 이상입니다.');
  if(!['interior','end'].includes(p.spanType))throw Error('경간 위치를 선택해 주세요.');
  if(!Number.isInteger(p.endCase)||p.endCase<0||p.endCase>=END_CASES.length)throw Error('단부 경간 조건을 선택해 주세요.');
}
// User-specified combination: uplift is driving, resisting dead load is reduced.
function load(p){
  nonnegative(p.liveLoad??0,'활하중');
  const selfWeight=p.gammaC*p.h/1000,uplift=p.gammaW*p.hw,dead=selfWeight+p.qsd;
  return {selfWeight,uplift,dead,live:p.liveLoad??0,qu:1.6*uplift-0.9*dead,gravity:1.2*dead+1.6*(p.liveLoad??0)};
}
// Clear span is measured between footing faces, floored at 0.65 l1 by 4.1.3.2(5).
function clearSpan(span,footing){
  const raw=span-footing,floor=.65*span;
  return {ln:Math.max(raw,floor),raw,floor,floored:raw<floor};
}
function moment(qu,span,transverse,footing){
  const c=clearSpan(span,footing);
  return {...c,Mo:qu*(transverse/1000)*Math.pow(c.ln/1000,2)/8};
}
function minimumRatio(fy){
  // KDS 14 20 50, 4.6.2(1): 0.0020 for fy <= 400, else 0.0020 x 400/fy; never below 0.0014.
  return Math.max(fy<=400?.0020:.0020*400/fy,.0014);
}
function minimumSteel(p){
  // 4.6.2(2) caps the requirement at 1,800 mm2 per metre of width.
  return Math.min(minimumRatio(p.fy)*1000*p.h,1800);
}
function maxSpacing(p){
  // KDS 14 20 70, 4.1.5.1(2) at critical sections.
  return Math.min(2*p.h,300);
}
function capacity(p,d,As){
  const k=R.concrete(p.fck),stress=.85*k.eta*p.fck,b=1000;
  const force=c=>{
    const a=Math.min(k.beta*c,p.h),strain=k.ecu*(d-c)/c;
    const fs=Math.max(-p.fy,Math.min(p.fy,ES*strain));
    return stress*b*a-As*fs;
  };
  let lo=1e-9,hi=p.h*2;
  if(force(lo)>=0||force(hi)<=0)throw Error('슬래브 단면 평형해를 찾을 수 없습니다.');
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(force(mid)<0)lo=mid;else hi=mid;}
  const c=(lo+hi)/2,a=Math.min(k.beta*c,p.h);
  const et=k.ecu*(d-c)/c,ey=p.fy/ES,etl=p.fy<=400?.005:2.5*ey,emin=p.fy<=400?.004:2*ey;
  const phi=et<=ey?.65:et>=etl?.85:.65+.20*(et-ey)/(etl-ey);
  const Mn=stress*b*a*(d-a/2)/1e6;
  return {c,a,et,ey,etl,emin,phi,Mn,phiMn:phi*Mn,ductile:et>=emin-1e-12};
}
function arrangement(p,bar,spacing,face){
  const area=R.BARS[bar].area,db=R.BARS[bar].diameter;
  const cover=face==='top'?p.coverTop:p.coverBottom;
  return {bar,spacing,db,As:1000/spacing*area,d:p.h-cover-db/2,cover};
}
function check(p,Mu,face,bar,spacing){
  const a=arrangement(p,bar,spacing,face);
  if(a.d<=0)throw Error('피복과 철근 지름이 슬래브 두께를 초과합니다.');
  const r=capacity(p,a.d,a.As),sMax=maxSpacing(p),reasons=[];
  if(r.phiMn<Mu-1e-9)reasons.push('설계휨강도 부족');
  if(spacing>sMax+1e-9)reasons.push('위험단면 철근 최대간격 초과');
  if(!r.ductile)reasons.push('최소허용변형률 미달');
  return {...a,...r,Mu,sMax,face,reasons,ok:!reasons.length};
}
// 4.6.2 defines the ratio against the whole concrete section, so the two faces
// are summed rather than each being asked to carry the full amount.
function sectionMinimum(p,AsTop,AsBottom){
  const AsMin=minimumSteel(p),total=AsTop+AsBottom;
  return {AsMin,AsTop,AsBottom,total,ratio:total/(1000*p.h),ok:total>=AsMin-1e-9};
}
// Widest spacing of the chosen bar that carries the moment within the spacing cap.
function suggest(p,Mu,face,bar){
  for(const spacing of [...SPACINGS].sort((x,y)=>y-x)){
    let r;try{r=check(p,Mu,face,bar,spacing);}catch(e){continue;}
    if(r.ok)return r;
  }
  return null;
}
// A strip is detailed with one spacing top and bottom for buildability, so the
// heavier face sets it. The pair must also close the section minimum.
function suggestPair(p,MuTop,MuBottom,bar){
  const AsMin=minimumSteel(p);
  for(const spacing of [...SPACINGS].sort((x,y)=>y-x)){
    let top,bottom;
    try{top=check(p,MuTop,'top',bar,spacing);bottom=check(p,MuBottom,'bottom',bar,spacing);}catch(e){continue;}
    if(top.ok&&bottom.ok&&top.As+bottom.As>=AsMin-1e-9)return {spacing,top,bottom};
  }
  return null;
}
function sections(p,qu,dir,combo='uplift'){
  const isUp=combo==='uplift';
  const span=dir==='l1'?p.l1:p.l2,transverse=dir==='l1'?p.l2:p.l1;
  const m=moment(qu,span,transverse,p.footing);
  const columnWidth=Math.min(2*Math.min(.25*p.l1,.25*p.l2),transverse);
  const middleWidth=transverse-columnWidth;
  const ends=END_CASES[p.endCase],interior=p.spanType==='interior';
  const positive={key:'positive',label:'중앙부 정모멘트',face:'top',
    coef:interior?.35:ends.positive,column:COLUMN_STRIP.positive};
  // 4.1.3.3(1) places the negative moment at the face of the support, and the
  // support here is the footing, so that section is slab and this slab's bottom
  // mat carries it. What happens inside the footing footprint is the footing's.
  const negatives=interior
    ?[{key:'negative',label:'기초면 부모멘트',face:'bottom',coef:.65,column:COLUMN_STRIP.interior}]
    :[{key:'exterior',label:'외부 기초면 부모멘트',face:'bottom',coef:ends.exterior,column:COLUMN_STRIP.exterior},
      {key:'interior',label:'내부 기초면 부모멘트',face:'bottom',coef:ends.interior,column:COLUMN_STRIP.interior}];
  const split=(part,strip)=>{
    const width=strip==='column'?columnWidth:middleWidth;
    const share=strip==='column'?part.column:1-part.column;
    const total=part.coef*m.Mo*share;
    return {dir,strip,width,share,total,Mu:width>0?total/(width/1000):0,...part};
  };
  if(!isUp){positive.face='bottom';negatives.forEach(r=>r.face='top');}
  const support=negatives.flatMap(part=>['column','middle'].map(strip=>split(part,strip)));
  const rows=[],minimums=[];
  for(const strip of ['column','middle']){
    const centre=split(positive,strip);
    // An end span has two negative sections; the heavier one sizes the mat.
    const worst=negatives.map(part=>split(part,strip)).reduce((a,b)=>b.Mu>a.Mu?b:a);
    const top=isUp?centre:worst,bottom=isUp?worst:centre;
    const live=top.width>0,pair=live?suggestPair(p,top.Mu,bottom.Mu,p.bar):null;
    const topRow={...top,check:live?check(p,top.Mu,'top',p.bar,p.spacing):null,
      suggestion:pair?pair.top:null};
    const botRow={...bottom,check:live?check(p,bottom.Mu,'bottom',p.bar,p.spacing):null,
      suggestion:pair?pair.bottom:null};
    rows.push(topRow,botRow);
    if(live)minimums.push({strip,...sectionMinimum(p,topRow.check.As,botRow.check.As)});
  }
  rows.forEach(r=>{r.combo=combo;});
  return {dir,combo,span,transverse,columnWidth,middleWidth,...m,positive,negatives,rows,support,minimums};
}
function limits(p){
  const ratio=Math.max(p.l1,p.l2)/Math.min(p.l1,p.l2),notes=[];
  if(ratio>2)notes.push(`장변/단변 비 ${ratio.toFixed(2)} > 2 (4.1.3.1(3))`);
  return {ratio,notes,ok:!notes.length};
}
function calculate(p){
  validate(p);
  const w=load(p),mode=p.loadCase??'uplift';
  if(!['uplift','gravity','both'].includes(mode))throw Error('하중조합을 선택해 주세요.');
  const combinations=[];
  if(mode!=='gravity'&&w.qu>0)combinations.push({key:'uplift',label:'양압력 1.6H − 0.9D',qu:w.qu});
  if(mode!=='uplift')combinations.push({key:'gravity',label:'중력 1.2D + 1.6L',qu:w.gravity});
  const scope=limits(p);
  if(mode!=='uplift'&&w.live>2*w.dead){scope.notes.push('활하중 L > 2D: 직접설계법 하중 제한을 벗어나 별도 해석 필요 (4.1.3.1)');scope.ok=false;}
  if(!combinations.length)return {load:w,combinations,directions:[],limits:scope,
    message:'저항 자중이 계수 양압력 이상이라 순 상향하중이 없습니다. 이 조합에서는 휨 검토 대상이 아닙니다.'};
  combinations.forEach(c=>{c.directions=['l1','l2'].map(dir=>sections(p,c.qu,dir,c.key));});
  const directions=['l1','l2'].map(dir=>{
    const cases=combinations.map(c=>c.directions.find(d=>d.dir===dir));
    const d={...cases[0],combo:mode,Mo:Math.max(...cases.map(d=>d.Mo)),rows:[]};
    for(const strip of ['column','middle']){
      const selected=['top','bottom'].map(face=>cases.flatMap(c=>c.rows).filter(r=>r.strip===strip&&r.face===face).reduce((a,b)=>!a||b.Mu>a.Mu?b:a,null));
      const pair=suggestPair(p,selected[0].Mu,selected[1].Mu,p.bar);
      selected.forEach((r,i)=>d.rows.push({...r,suggestion:scope.ok&&pair?(i?pair.bottom:pair.top):null}));
    }
    return d;
  });
  return {load:w,combinations,limits:scope,message:w.qu<=0&&mode==='both'?'순 상향하중이 없어 중력하중 조합으로 검토합니다.':'',directions,
    AsMin:minimumSteel(p),maxSpacing:maxSpacing(p),minimumRatio:minimumRatio(p.fy)};
}
root.RCSlabUplift={BARS,SPACINGS,END_CASES,COLUMN_STRIP,load,clearSpan,moment,
  minimumRatio,minimumSteel,sectionMinimum,maxSpacing,capacity,check,suggest,
  suggestPair,limits,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCSlabUplift;
})(typeof globalThis!=='undefined'?globalThis:this);
