/* Downward static loads on an unshored, simply supported composite beam.
 * Geometry in mm, surface loads in kN/m2, point loads in kN at metres from left.
 * KDS 41 12 00 1.7.1: 1.4D / 1.2D+1.6L; 11.2-1: 1.2CD+1.4CM+1.6CP
 * (horizontal construction load CH=0 in this vertical member model).
 */
(function(root){
'use strict';
const KINDS={D:'완공 고정하중 D',L:'완공 활하중 L',CD:'시공 고정하중 CD',CM:'시공 자재하중 CM',CP:'시공 작업하중 CP'};
function positive(v,name){if(!Number.isFinite(v)||v<=0)throw Error(`${name}은 0보다 큰 숫자여야 합니다.`);}
function nonnegative(v,name){if(!Number.isFinite(v)||v<0)throw Error(`${name}은 0 이상의 숫자여야 합니다.`);}
function validatePoints(points,span){
  if(!Array.isArray(points)||points.length>50)throw Error('집중하중은 50개까지 입력할 수 있습니다.');
  return points.map((p,i)=>{
    if(!KINDS[p.kind])throw Error(`집중하중 ${i+1}의 하중 종류를 선택해 주세요.`);
    nonnegative(p.P,`집중하중 ${i+1} 크기`);positive(p.x,`집중하중 ${i+1} 위치`);
    if(p.x>=span)throw Error(`집중하중 ${i+1} 위치는 왼쪽 지점에서 0 m 초과, 경간 ${span} m 미만이어야 합니다.`);
    return {kind:p.kind,P:p.P,x:p.x,index:i+1};
  });
}
// Exact piecewise equilibrium. Interior extrema come from V(x)=0, not sampling.
function analyze(span,w,points=[]){
  positive(span,'해석 경간');nonnegative(w,'등분포 선하중');
  for(const p of points){nonnegative(p.P,'계수 집중하중');positive(p.x,'집중하중 위치');if(p.x>=span)throw Error('집중하중 위치가 경간 밖입니다.');}
  const total=w*span+points.reduce((s,p)=>s+p.P,0);
  const RA=w*span/2+points.reduce((s,p)=>s+p.P*(span-p.x)/span,0),RB=total-RA;
  const moment=x=>RA*x-w*x*x/2-points.reduce((s,p)=>s+p.P*Math.max(x-p.x,0),0);
  const shear=(x,side='right')=>RA-w*x-points.reduce((s,p)=>s+(p.x<x||(side==='right'&&p.x===x)?p.P:0),0);
  const breaks=[...new Set([0,span,...points.map(p=>p.x)])].sort((a,b)=>a-b),candidates=[...breaks];
  for(let i=0;i<breaks.length-1;i++){
    const a=breaks[i],b=breaks[i+1],passed=points.filter(p=>p.x<=a).reduce((s,p)=>s+p.P,0);
    if(w>0){const x=(RA-passed)/w;if(x>a&&x<b)candidates.push(x);}
    else if(Math.abs(RA-passed)<1e-9)candidates.push((a+b)/2);
  }
  const moments=candidates.map(x=>({x,M:Math.max(0,moment(x))}));
  let peak=moments.reduce((best,p)=>p.M>best.M? p:best,{x:span/2,M:0});
  const shears=breaks.flatMap(x=>[{x,side:'left',V:shear(x,'left')},{x,side:'right',V:shear(x,'right')}]);
  const peakV=shears.reduce((best,p)=>Math.abs(p.V)>Math.abs(best.V)?p:best,{x:0,side:'right',V:0});
  if(![total,RA,RB,peak.M,peakV.V].every(Number.isFinite))throw Error('하중 계산 범위를 초과했습니다. 입력값을 확인해 주세요.');
  return {span,w,points,RA,RB,Mu:peak.M,xM:peak.x,Vu:Math.abs(peakV.V),xV:peakV.x,
    pointMoments:points.filter(p=>p.P>0).map(p=>({...p,M:Math.max(0,moment(p.x))})),
    samples:Array.from({length:41},(_,i)=>{const x=span*i/40;return {x,M:Math.max(0,moment(x))};})};
}
function calculate(p,props){
  const span=p.span/1000;
  positive(span,'보 경간');positive(p.loadWidth,'하중 부담폭');positive(p.ts,'슬래브 두께');
  positive(p.concreteWeight,'콘크리트 자중 단위중량');positive(props.A,'강재 단면적');
  for(const [k,n] of [['finishLoad','마감하중'],['liveLoad','활하중'],['formLoad','거푸집 하중'],['constructionMaterialLoad','추가 시공 자재하중'],['constructionLiveLoad','시공 작업하중']])nonnegative(p[k],n);
  const points=validatePoints(p.pointLoads??[],span),width=p.loadWidth;
  const include=p.includeSelfWeight!==false;
  const slab=include?p.concreteWeight*p.ts/1000*width:0;
  const steel=include?props.A*1e-6*7850*9.80665/1000:0;
  const line={slab,steel,finish:p.finishLoad*width,live:p.liveLoad*width,
    form:p.formLoad*width,material:p.constructionMaterialLoad*width,work:p.constructionLiveLoad*width};
  const D=line.slab+line.steel+line.finish,L=line.live,CD=line.steel,CM=line.slab+line.form+line.material,CP=line.work;
  const make=(id,label,phase,w,factors)=>({id,label,phase,...analyze(span,w,points.filter(q=>(factors[q.kind]??0)>0&&q.P>0).map(q=>({...q,P:q.P*factors[q.kind]})))});
  const cases=[make('dead','1.4D','completed',1.4*D,{D:1.4}),make('gravity','1.2D + 1.6L','completed',1.2*D+1.6*L,{D:1.2,L:1.6}),
    make('construction','1.2CD + 1.4CM + 1.6CP','construction',1.2*CD+1.4*CM+1.6*CP,{CD:1.2,CM:1.4,CP:1.6})];
  const completed=cases.filter(c=>c.phase==='completed'),construction=cases[2];
  const flexure=completed.reduce((a,b)=>a.Mu>=b.Mu?a:b),shearCase=cases.reduce((a,b)=>a.Vu>=b.Vu?a:b);
  return {mode:'auto',span,width,includeSelfWeight:include,line,D,L,CD,CM,CP,points,cases,
    Mu:flexure.Mu,Vu:shearCase.Vu,VuCompleted:Math.max(...completed.map(c=>c.Vu)),VuConstruction:construction.Vu,
    MuConstruction:construction.Mu,flexureCase:flexure,shearCase,construction};
}
root.CompositeBeamLoads={KINDS,validatePoints,analyze,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.CompositeBeamLoads;
})(typeof globalThis!=='undefined'?globalThis:this);
