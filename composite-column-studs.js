/* KDS 14 31 80:2024 load-introduction shear transfer.
 * One end region only; bearing and bond are not added to stud resistance.
 */
(function(root){
'use strict';
function calculate(o,p){
 const sec=o.p,src=sec.type==='src',round=sec.type==='circle';
 for(const k of ['length','diameter','head','height','Fu','perLevel','spacing','edge'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('스터드 규격·배치 및 실제 기둥 길이는 양수로 입력하세요.');
 if(!Number.isInteger(p.perLevel)||p.perLevel<2||p.perLevel>24||p.perLevel%2)throw Error('1단 스터드는 대칭인 짝수 2–24개로 배치하세요.');
 if(!['steel','concrete','both'].includes(p.loadPath))throw Error('하중 도입 방식을 선택하세요.');
 if(p.loadPath==='both'&&(!Number.isFinite(p.steelShare)||p.steelShare<0||p.steelShare>100))throw Error('철골 도입 비율은 0–100%로 입력하세요.');
 if(p.introLoad!==null&&(!Number.isFinite(p.introLoad)||p.introLoad<0))throw Error('도입 축력은 비우거나 0 이상을 입력하세요.');
 if(p.outsideFlow!==null&&(!Number.isFinite(p.outsideFlow)||p.outsideFlow<0))throw Error('구간 외 전단흐름은 비우거나 0 이상을 입력하세요.');
 const Pr=p.introLoad===null?sec.Pu:p.introLoad,ratio=sec.Fy*o.props.steel.A/(o.Pno*1000);
 const share=p.loadPath==='steel'?1:p.loadPath==='concrete'?0:p.steelShare/100;
 const demand=Math.abs(Pr*(share-ratio));
 const Lin=Math.min(2*Math.min(sec.B,sec.H),p.length/3),end=p.length-p.edge;
 // Edge distance is measured from the physical concrete end, not the far
 // boundary of the load-introduction zone (which is not a free edge).
 const available=Math.min(Lin,end)-p.edge;
 const levels=available>=0?Math.floor((available+1e-8)/p.spacing)+1:0;
 if(levels>200)throw Error('배치 단수가 너무 많습니다. 스터드 간격과 기둥 길이를 확인하세요.');
 const z=Array.from({length:levels},(_,i)=>p.edge+i*p.spacing),count=levels*p.perLevel;
 const A=Math.PI*p.diameter**2/4;
 // §4.4.3.3(2)② refers to §4.8.2.1. No deck: Rg=1, Rp=.75.
 // Also cap by embedded-stud steel shear §4.8.3.1 (.65 Fu A).
 const concrete=.5*A*Math.sqrt(sec.fck*sec.Ec)/1000,steel=.75*A*p.Fu/1000;
 const phiQ=Math.min(concrete,steel,.65*A*p.Fu/1000);
 const capacity=count*phiQ,required=Math.ceil(demand/phiQ-1e-10),checks=[];
 const check=(label,ok,detail)=>checks.push({label,ok,detail});
 check('축력분배 적용 범위',ratio>=0&&ratio<=1,`FyAs/Pno ${ratio.toFixed(3)} / 0–1`);
 check('스터드 길이',p.height>=5*p.diameter,`${p.height} / 최소 ${5*p.diameter} mm (전단 전용)`);
 check('머리 직경',p.head>=1.6*p.diameter,`${p.head} / 최소 ${(1.6*p.diameter).toFixed(1)} mm`);
 check('길이방향 중심 간격',p.spacing>=6*p.diameter&&p.spacing<=32*p.diameter,`${p.spacing} / ${6*p.diameter}–${32*p.diameter} mm`);
 check('하중방향 콘크리트 단부 거리',p.edge>=200&&count>0,`${p.edge} mm / 최소 200 mm · ${count}개`);
 const plan=[];
 if(round){
  const r=sec.B/2-sec.t,rh=r-p.height;
  if(rh<=0)throw Error('스터드 길이가 원형 CFT 내부 반경 이상입니다.');
  for(let i=0;i<p.perLevel;i++){const a=2*Math.PI*i/p.perLevel;plan.push({x:r*Math.cos(a),y:r*Math.sin(a),hx:rh*Math.cos(a),hy:rh*Math.sin(a),face:i+1});}
 }else{
  const width=src?sec.sb:sec.B-2*sec.t,half=p.perLevel/2,margin=Math.max(1.5*p.diameter,p.head/2),usable=width-2*margin;
  if(usable<0)throw Error('스터드가 플랜지 또는 강관 면 폭에 들어가지 않습니다.');
  for(const side of [-1,1])for(let i=0;i<half;i++){const x=half===1?0:-usable/2+usable*i/(half-1),y=side*(src?sec.sh/2:sec.H/2-sec.t);plan.push({x,y,hx:x,hy:y+side*p.height*(src?1:-1),face:side===1?2:1});}
 }
 let transverse=Infinity,headClear=Infinity;
 for(let i=0;i<plan.length;i++)for(let j=i+1;j<plan.length;j++){
  if(round||plan[i].face===plan[j].face)transverse=Math.min(transverse,Math.hypot(plan[i].x-plan[j].x,plan[i].y-plan[j].y));
  headClear=Math.min(headClear,Math.hypot(plan[i].hx-plan[j].hx,plan[i].hy-plan[j].hy)-p.head);
 }
 check('단면방향 중심 간격',transverse>=4*p.diameter,`${Number.isFinite(transverse)?transverse.toFixed(1):'해당 없음'} / 최소 ${4*p.diameter} mm`);
 check('스터드 머리 간 간섭',headClear>=0,`머리 순간격 ${headClear.toFixed(1)} mm`);
 let cover=Infinity,barClear=Infinity;
 for(const q of plan){
  cover=Math.min(cover,round?sec.B/2-sec.t-Math.hypot(q.hx,q.hy)-p.head/2:Math.min(sec.B/2-Math.abs(q.hx),sec.H/2-Math.abs(q.hy))-p.head/2);
  for(const b of o.bars){
   const dx=q.hx-q.x,dy=q.hy-q.y,k=Math.max(0,Math.min(1,((b.x-q.x)*dx+(b.y-q.y)*dy)/(dx*dx+dy*dy)));
   barClear=Math.min(barClear,Math.hypot(b.x-q.x-k*dx,b.y-q.y-k*dy)-b.r-p.diameter/2,Math.hypot(b.x-q.hx,b.y-q.hy)-b.r-p.head/2);
  }
 }
 check('머리 주변 콘크리트 여유',cover>=25,`${cover.toFixed(1)} / 최소 25 mm`);
 if(src)check('주철근 간섭',barClear>=0,`최소 여유 ${barClear.toFixed(1)} mm`);
 const plate=src?sec.tf:sec.t;
 check('용접 모재 두께',p.diameter<=2.5*plate,`${p.diameter} / 한계 ${2.5*plate} mm`);
 check('도입부 전달강도',capacity+1e-8>=demand,`${capacity.toFixed(1)} / 소요 ${demand.toFixed(1)} kN`);
 const outsideCapacity=p.perLevel*phiQ/(p.spacing/1000),outside=p.outsideFlow===null?null:{demand:p.outsideFlow,capacity:outsideCapacity,ok:p.outsideFlow<=outsideCapacity&&checks.slice(0,-1).every(q=>q.ok)};
 return {p,Pr,ratio,share,demand,Lin,levels,z,count,required,phiQ,capacity,checks,plan,transverse,cover,barClear,outside,ok:checks.every(q=>q.ok),concrete,steel};
}
root.CompositeColumnStuds={calculate};if(typeof module!=='undefined'&&module.exports)module.exports=root.CompositeColumnStuds;
})(typeof globalThis!=='undefined'?globalThis:this);
