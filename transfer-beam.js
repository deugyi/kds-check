/* Staged self-weight screening. See docs/transfer-beam.md for assumptions.
 * mm, MPa, kN, m; interface area is per metre of beam length. */
(function(root){
'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const C=typeof module!=='undefined'&&module.exports?require('./rc-beam-checks.js'):root.RCBeamChecks;
function modulus(fc){return 8500*Math.cbrt(fc+Math.max(4,Math.min(6,4+(fc-40)/10)));}
function pos(v,name){if(!Number.isFinite(v)||v<=0)throw Error(name+'은 0보다 커야 합니다.');}
function layout(p,H){
  const bar=R.BARS[p.bar],st=R.BARS[p.stirrup];
  if(!bar||!st)throw Error('철근 규격을 선택하세요.');
  pos(p.cover,'피복');pos(p.aggregate,'골재 치수');
  const edge=p.cover+st.diameter+Math.max(bar.diameter/2,2*st.diameter-(2*st.diameter-bar.diameter/2)/Math.SQRT2);
  const gap=Math.max(25,bar.diameter,4*p.aggregate/3),vgap=Math.max(25,4*p.aggregate/3);
  const cap=Math.floor((p.b-2*edge+bar.diameter+gap)/(bar.diameter+gap));
  if(!p.counts.length||p.counts.length>3||p.counts.some(n=>!Number.isInteger(n)||n<0)||p.counts[0]<2)throw Error('하부 1단은 2가닥 이상, 최대 3단으로 입력하세요.');
  if(p.counts[2]>0&&p.counts[1]===0)throw Error('철근 중간 단을 비울 수 없습니다.');
  const layers=p.counts.map((count,i)=>({count,d:H-edge-i*(bar.diameter+vgap),xs:[]})).filter(l=>l.count>0);
  if(layers.some(l=>l.count>cap||l.d<edge))throw Error('타설 높이 또는 폭에 하부 철근을 배치할 수 없습니다.');
  // Upper bars must align on the first-row grid, as in the RC beam tool.
  for(const l of layers){l.xs=R.positions(p.counts[0],l.count,edge,p.b);if(!l.xs)throw Error('상부 단 가닥 수는 1단과 수직 정렬되는 배치여야 합니다.');}
  return {g:{bar,st,compression:null,edge},layers};
}
// Cracked transformed section: all concrete tension is omitted. Same minimum
// measured fc is used throughout the active concrete as a strength lower bound.
function cracked(b,H,layers,bar,fc,concrete){
  const Ec=modulus(fc),n=200000/Ec;
  concrete??=[{top:0,bottom:H,ratio:1}];
  function first(c){return concrete.reduce((a,l)=>{const t=Math.min(c,l.bottom),f=l.top;return t>f?a+l.ratio*b*(c*(t-f)-(t*t-f*f)/2):a;},0)+layers.reduce((a,l)=>a+n*l.count*bar.area*(c-l.d),0);}
  let lo=0,hi=H;for(let i=0;i<90;i++){const c=(lo+hi)/2;if(first(c)>0)hi=c;else lo=c;}
  const c=(lo+hi)/2,I=concrete.reduce((a,l)=>{const t=Math.min(c,l.bottom),f=l.top;return t>f?a+l.ratio*b*((c-f)**3-(c-t)**3)/3:a;},0)+layers.reduce((a,l)=>a+n*l.count*bar.area*(l.d-c)**2,0);
  return {c,I,n,concrete};
}
function interfaceCheck(p,H,joint,fc,r,lay,Vu,values){
  let y=0;const concrete=values.map((v,i)=>{const bottom=H-y;y+=p.heights[i];return {top:H-y,bottom,ratio:modulus(v)/modulus(fc)};});
  const cut=H-joint,cr=cracked(p.b,H,lay.layers,lay.g.bar,fc,concrete);
  // Area above the joint, measured from the top, transformed to concrete.
  let Q=concrete.reduce((a,l)=>{const t=Math.min(cut,cr.c,l.bottom),f=l.top;return t>f?a+l.ratio*p.b*(cr.c*(t-f)-(t*t-f*f)/2):a;},0);
  for(const l of lay.layers)if(l.d<cut)Q+=cr.n*l.count*lay.g.bar.area*(cr.c-l.d);
  const qCracked=Math.abs(Vu*1000*Q/cr.I);
  const area=concrete.reduce((a,l)=>a+l.ratio*p.b*(l.bottom-l.top),0);
  const cg=concrete.reduce((a,l)=>a+l.ratio*p.b*(l.bottom*l.bottom-l.top*l.top)/2,0)/area;
  const Igross=concrete.reduce((a,l)=>a+l.ratio*p.b*((l.bottom-cg)**3-(l.top-cg)**3)/3,0);
  const Qgross=Math.abs(concrete.reduce((a,l)=>{const t=Math.min(cut,l.bottom),f=l.top;return t>f?a+l.ratio*p.b*(cg*(t-f)-(t*t-f*f)/2):a;},0));
  const qGross=Vu*1000*Qgross/Igross;
  const q=Math.max(qCracked,qGross),demand=q; // N/mm = kN/m
  const mu=1,phi=.75,steelFy=Math.min(p.fyd,500);
  const st=lay.g.st,db=R.BARS[p.dowel];if(!db)throw Error('다월바 규격을 선택하세요.');
  const stirrupArea=p.crossAnchored?(p.crossLegs??p.legs)*st.area*1000/p.stirrupSpacing:0;
  const existing=phi*mu*stirrupArea*Math.min(p.fyt,500)/1000;
  const requiredArea=Math.max(0,(demand-existing)*1000/(phi*mu*steelFy));
  const provided=p.dowelCount*db.area*1000/p.dowelSpacing;
  const cap=.75*Math.min(.2*fc,3.3+.08*fc,11)*p.b; // kN/m
  const steelCapacity=existing+(p.dowelAnchored?phi*mu*provided*steelFy/1000:0);
  const available=Math.min(cap,steelCapacity);
  const neededCount=requiredArea>0?Math.ceil(requiredArea*p.dowelSpacing/1000/db.area-1e-10):0;
  const fit=Math.max(0,Math.floor((p.b-2*p.cover+Math.max(25,db.diameter,4*p.aggregate/3))/(db.diameter+Math.max(25,db.diameter,4*p.aggregate/3))));
  return {joint,cut,qGross,qCracked,demand,existing,requiredArea,provided,available,cap,neededCount,fit,
    ok:demand<=available+1e-8&&p.dowelCount<=fit,
    reason:demand>cap?'콘크리트 접합면 상한 초과':p.dowelCount>fit?'다월바 폭 방향 배치 불가':requiredArea>0&&!p.dowelAnchored?'다월바 양측 정착 확인 필요':demand>available?'접합면 철근량 부족':'입력 조건상 전단 전달량 충족'};
}
function phase(p,k,wet){
  const active=wet?k-1:k,H=p.heights.slice(0,active).reduce((a,v)=>a+v,0),loaded=p.heights.slice(0,k).reduce((a,v)=>a+v,0);
  const D=24*p.b/1000*loaded/1000,w=p.deadFactor*D;
  const out={stage:k,wet,H,loaded,D,w,M:w*p.span*p.span/8,V:w*p.span/2,interfaces:[]};
  if((wet&&k<=p.release)||(!wet&&k<p.release))return {...out,status:'shored',message:'동바리 지지 상태 · 동바리 내력은 별도 검토'};
  try{
    const values=p.strengths[active]||[];
    if(values.length<active||values.slice(0,active).some(v=>!Number.isFinite(v)))throw Error(`${active}차 검토 시점의 각 콘크리트 발현강도를 입력하세요.`);
    const fc=Math.min(...values.slice(0,active));
    if(values.slice(0,active).some(v=>v<21||v>90))throw Error('발현강도 21–90 MPa에서 내력을 계산합니다. 21 MPa 미만은 별도 초기재령 모델 검증이 필요합니다.');
    const lay=layout(p,H),r=R.strength({...p,h:H,fck:fc},lay.g,lay.layers);
    const shear=C.shear({...p,h:H,fck:fc,Vu:out.V},lay.g,r);
    let joint=0;for(let j=0;j<active-1;j++){joint+=p.heights[j];out.interfaces.push(interfaceCheck(p,H,joint,fc,r,lay,out.V,values.slice(0,active)));}
    const deep=p.span*1000<=4*H;
    const flexOK=r.eligible&&out.M<=r.phiMn;
    return {...out,fc,r,shear,deep,flexOK,status:deep?'outside':'calculated',
      message:deep?'경간/높이 ≤ 4: 깊은보 판정 대상 · 일반 보 계산으로 적합 판정하지 않음':!flexOK?'휨강도 또는 단면 조건 미달':!shear.ok?'수직 전단 검토 미달':out.interfaces.some(i=>!i.ok)?'이어치기면 보강 확인 필요':'계산 항목 충족 · 시공단계 상세 검토 별도'};
  }catch(e){return {...out,status:'missing',message:e.message};}
}
function calculate(p){
  for(const key of ['b','h','span','deadFactor','stirrupSpacing','dowelSpacing'])pos(p[key],key);
  if(p.deadFactor<1)throw Error('자중 하중계수는 1 이상이어야 합니다.');
  if(!p.heights.length||p.heights.length>10||p.heights.some(v=>!Number.isFinite(v)||v<=0)||Math.abs(p.heights.reduce((a,v)=>a+v,0)-p.h)>.01)throw Error('타설 높이 합계를 확인하세요.');
  if(!Number.isInteger(p.release)||p.release<1||p.release>p.heights.length)throw Error('동바리 해체 차수를 선택하세요.');
  if(!Number.isInteger(p.legs)||p.legs<2||p.legs>6||!Number.isInteger(p.dowelCount)||p.dowelCount<0)throw Error('스터럽 다리 수와 다월바 개수를 확인하세요.');
  if(![400,500,600].includes(p.fy)||![400,500].includes(p.fyt)||![400,500,600].includes(p.fyd))throw Error('철근 강도를 확인하세요.');
  const crossLegs=p.crossLegs??p.legs;
  if(!Number.isInteger(crossLegs)||crossLegs<0||crossLegs>p.legs)throw Error('유효 관통 스터럽 다리 수는 전체 다리 수 이내여야 합니다.');
  const phases=[];
  for(let k=1;k<=p.heights.length;k++){phases.push(phase(p,k,true));phases.push(phase(p,k,false));}
  return {phases};
}
root.TransferBeam={calculate,layout,cracked,interfaceCheck};
if(typeof module!=='undefined'&&module.exports)module.exports=root.TransferBeam;
})(typeof globalThis!=='undefined'?globalThis:this);
