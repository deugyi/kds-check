/* Rectangular, normal-weight, nonprestressed beams; mm, MPa, kN.
 * KDS clauses, takeoff assumptions and limits: docs/rc-beam.md. */
(function(root){
'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
function positive(value,name){if(!Number.isFinite(value)||value<=0)throw Error(`${name}은 0보다 큰 숫자여야 합니다.`);}
function nonnegative(value,name){if(!Number.isFinite(value)||value<0)throw Error(`${name}은 0 이상의 숫자여야 합니다.`);}
function skin(p,g,r){
  const bar=R.BARS[p.skinBar];if(!bar)throw Error('표피철근 규격을 선택해 주세요.');
  if(!['auto','manual','none'].includes(p.skinMode)||!['dry','other'].includes(p.environment))throw Error('표피철근 배치 방식과 노출환경을 선택해 주세요.');
  const required=p.h>900,fs=2*p.fy/3,kappa=p.environment==='dry'?280:210,cc=p.cover+g.st.diameter;
  const maxSpacing=Math.min(375*kappa/fs-2.5*cc,300*kappa/fs),reasons=[];
  // Existing paired outer main bars anchor the lower end of the skin region.
  const outer=r.layers.filter(l=>l.xs.length>=2&&Math.abs(l.xs[0]-g.edge)<1e-6&&Math.abs(l.xs.at(-1)-(p.b-g.edge))<1e-6);
  const anchor=Math.min(...outer.map(l=>l.d)),start=p.h/2,span=anchor-start;
  let count=0;
  if(p.skinMode==='manual'){
    if(!Number.isInteger(p.skinCount)||p.skinCount<0||p.skinCount>100)throw Error('표피철근 개수는 한 면당 0~100가닥의 정수로 입력해 주세요.');
    count=p.skinCount;
  }else if(p.skinMode==='auto'&&required&&maxSpacing>0&&span>0)count=Math.ceil(span/maxSpacing-1e-12);
  if(count>100)throw Error('요구 표피철근 간격이 너무 작습니다. 피복·강도·노출환경을 확인해 주세요.');
  const xs=[cc+bar.diameter/2,p.b-cc-bar.diameter/2];
  const points=[];
  if(count&&span>0)for(let i=0;i<count;i++)for(const x of xs)points.push({x,d:start+span*i/count});
  const mainDepths=outer.map(l=>l.d).sort((a,b)=>a-b);
  const gaps=mainDepths.slice(1).map((d,i)=>d-mainDepths[i]);
  const spacing=count&&span>0?Math.max(span/count,...gaps):null;
  if(required&&!count)reasons.push('높이 900 mm 초과: 양측 표피철근 필요');
  if((required||count)&&maxSpacing<=0)reasons.push('피복·노출환경·강도 조건에서 허용간격이 0 이하');
  if(count){
    if(span<=0||points.length!==2*count)reasons.push('하부 주철근 위의 표피철근 배치 공간 부족');
    if(spacing>maxSpacing+1e-8)reasons.push('표피철근 최대 중심간격 초과');
    if(xs[1]-xs[0]<bar.diameter+g.horizontalClear)reasons.push('양측 표피철근 사이 배치 공간 부족');
    if(span/count<bar.diameter+g.verticalClear-1e-8&&count>1)reasons.push('표피철근 사이 최소 순간격 부족');
    if(span/count<(bar.diameter+g.bar.diameter)/2+g.verticalClear-1e-8)reasons.push('표피철근과 주철근 사이 최소 순간격 부족');
    if(g.compression&&start-g.compression.d<(bar.diameter+g.compression.bar.diameter)/2+g.verticalClear)reasons.push('압축철근과 표피철근 사이 공간 부족');
  }
  return {required,bar,count,total:points.length,points,maxSpacing,spacing,fs,kappa,cc,area:points.length*bar.area,reasons,ok:!reasons.length};
}
function shear(p,g,r){
  if(!Number.isInteger(p.legs)||p.legs<2||p.legs>6)throw Error('스터럽 다리 수는 2~6개로 선택해 주세요.');
  positive(p.stirrupSpacing,'스터럽 간격');positive(p.fyt,'스터럽 강도');
  if(p.fyt>500)throw Error('일반 RC 보의 전단철근 fyt는 500 MPa 이하입니다. (KDS 14 20 22, 4.3.1(3))');
  if(p.Vu!==null)nonnegative(p.Vu,'소요전단력 Vu');
  const s=p.stirrupSpacing,d=r.d,Av=p.legs*g.st.area,phi=.75;
  const avMin=Math.max(.0625*Math.sqrt(p.fck),.35)*p.b*s/p.fyt;
  const minimum=Av>=avMin-1e-8;
  // 4.1.1(4): the 8.4 cap may be waived for Vc with minimum reinforcement.
  const sqrtVc=minimum?Math.sqrt(p.fck):Math.min(Math.sqrt(p.fck),8.4);
  const Vc=sqrtVc*p.b*d/6000,Vs=Av*p.fyt*d/s/1000;
  const VsMax=.2*(1-p.fck/250)*p.fck*p.b*d/1000;
  const threshold=Math.min(Math.sqrt(p.fck),8.4)*p.b*d/3000;
  const maxSpacing=Math.min(d/2,600)/(Vs>threshold?2:1);
  const phiVn=phi*(Vc+Math.min(Vs,VsMax)),rawPhiVn=phi*(Vc+Vs);
  const reasons=[];
  if(s<g.st.diameter)reasons.push('종방향 스터럽 간격이 철근 지름보다 작음');
  if(s>maxSpacing+1e-8)reasons.push('스터럽 최대 간격 초과');
  if(!minimum)reasons.push('최소 전단철근량 미달');
  if(Vs>VsMax+1e-8)reasons.push('전단철근 강도 Vs 상한 초과');
  if(p.Vu!==null&&p.Vu>phiVn+1e-8)reasons.push('소요전단력 Vu가 설계전단강도 초과');
  // Applies supplied-stirrup detail checks even when a minimum-steel exemption
  // could apply; no exemption or special-member rules are inferred from no load.
  return {s,d,Av,avMin,minimum,phi,Vc,Vs,VsMax,threshold,maxSpacing,phiVn,rawPhiVn,Vu:p.Vu,ratio:p.Vu===null?null:p.Vu/phiVn,reasons,ok:!reasons.length};
}
function quantities(p,g,r,sk){
  positive(p.stirrupSpacing,'스터럽 간격');
  if(!Number.isInteger(p.legs)||p.legs<2||p.legs>6)throw Error('스터럽 다리 수는 2~6개로 선택해 주세요.');
  nonnegative(p.concretePrice,'콘크리트 단가');nonnegative(p.steelPrice,'철근 단가');
  nonnegative(p.wastePercent,'철근 할증률');
  if(p.wastePercent>100)throw Error('철근 할증률은 0~100%로 입력해 주세요.');
  const ds=g.st.diameter,W=p.b-2*p.cover-ds,H=p.h-2*p.cover-ds;
  if(W<=0||H<=0)throw Error('스터럽 물량을 계산할 내부 단면 공간이 없습니다.');
  // Preliminary cut length: closed outer tie + (legs-2) internal crossties,
  // two 135-degree hook extensions per piece, conservative 75mm minimum.
  const hook=Math.max(6*ds,75),autoLength=2*(W+H)+2*hook+(p.legs-2)*(H+2*hook);
  const cutLength=p.stirrupCutLength===null?autoLength:p.stirrupCutLength;
  positive(cutLength,'스터럽 1조 절단길이');
  const factor=7.85e-6; // 7850 kg/m3; tonne-force under standard gravity.
  const tension=r.As*factor,compression=(g.compression?g.compression.count*g.compression.bar.area:0)*factor;
  const skinWeight=sk.area*factor,stations=1000/p.stirrupSpacing,stirrups=g.st.area*cutLength/1000*stations*factor;
  const netSteel=tension+compression+skinWeight+stirrups,steel=netSteel*(1+p.wastePercent/100),concrete=p.b*p.h/1e6;
  const concreteCost=concrete*p.concretePrice,steelCost=steel*p.steelPrice;
  return {concrete,tension,compression,skin:skinWeight,stirrups,netSteel,steel,stations,cutLength,autoLength,hook,concreteCost,steelCost,totalCost:concreteCost+steelCost};
}
root.RCBeamChecks={skin,shear,quantities};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCBeamChecks;
})(typeof globalThis!=='undefined'?globalThis:this);
