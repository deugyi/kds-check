/* User-selected reduction: omit the intermediate flange, retain its weight. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const S=node?require('./steel-section.js'):root.SteelSection;
const I=node?require('./steel-builtup-i.js'):root.SteelBuiltupI;
function assembly(top,tee,cut,p){
  if(!Number.isFinite(cut)||cut<=tee.tf+tee.r||cut>=tee.H-tee.tf-tee.r)throw Error('절단선이 원본 RH의 직선 웨브 구간에 있어야 합니다.');
  const topFy=S.yieldStrength(p.bhGrade,Math.max(top.tf,top.tw)),teeFy=S.yieldStrength(p.bhGrade,Math.max(tee.tf,tee.tw));
  if(!topFy||!teeFy)throw Error('상부 RH와 역T 강종을 확인하세요.');
  const effective={H:top.H+cut,bt:top.B,tt:top.tf,bb:tee.B,tb:tee.tf,tw:Math.min(top.tw,tee.tw),Fy:Math.min(topFy,teeFy),E:S.E,Lb:p.Lb,Cb:p.Cb};
  const out=I.calculate(effective);
  const partMass=(area)=>area*.00785;
  const topMass=partMass(top.A+4*top.r**2*(1-Math.PI/4));
  const teeMass=partMass(tee.B*tee.tf+(cut-tee.tf)*tee.tw+2*tee.r**2*(1-Math.PI/4));
  const y0=top.H,hw=cut-tee.tf,Aweb=hw*effective.tw,Af=tee.B*tee.tf;
  const Q=Math.abs(Aweb*(y0+hw/2-out.props.y)+Af*(effective.H-tee.tf/2-out.props.y));
  return {effective,out,top,tee,cut,topFy,teeFy,mass:topMass+teeMass,topMass,teeMass,Q};
}
function calculate(p,base){
  const chosen=p.topSection==='auto'?null:S.findSection(p.topSection);
  if(p.topSection!=='auto'&&!chosen?.listed)throw Error('공통 RH 규격을 선택하세요.');
  if(!['positive','negative','both'].includes(p.bending))throw Error('휨 방향을 선택하세요.');
  if(!['half','custom'].includes(p.cutMode))throw Error('역T 절단 방식을 선택하세요.');
  if(p.cutMode==='custom'&&(!Number.isFinite(p.cutHeight)||p.cutHeight<=0))throw Error('역T 절단 높이를 양수로 입력하세요.');
  const rows=[];
  for(const sec of S.SECTIONS.filter(s=>s.listed&&(!chosen||s.name===chosen.name))){
    const top=sec;
    const cut=p.cutMode==='half'?sec.H/2:p.cutHeight;
    if(cut<=sec.tf+sec.r||cut>=sec.H-sec.tf-sec.r)continue;
    const a=assembly(top,sec,cut,p),all=a.out;
    const dirs=p.bending==='both'?[all.positive,all.negative]:[p.bending==='negative'?all.negative:all.positive];
    const supported=dirs.every(d=>d.supported),phiMn=supported?Math.min(...dirs.map(d=>d.phiMn)):null;
    const reasons=[];
    if(!base.target)reasons.push('BH 내력 산정 불가');
    if(!supported)reasons.push('조립 I형 휨 검토범위 초과');
    if(base.target&&supported&&phiMn+1e-9<base.target.M)reasons.push('휨 부족');
    if(base.target&&all.shear.phiVn+1e-9<base.target.V)reasons.push('전단 부족');
    if(p.maxH!==null&&a.effective.H>p.maxH)reasons.push('전체 높이 초과');
    if(p.maxB!==null&&Math.max(top.B,sec.B)>p.maxB)reasons.push('폭 초과');
    if(p.keepStiffness&&all.props.Ix<base.base.props.Ix-1e-6)reasons.push('강축 강성 부족');
    const flow=base.target?base.target.V*1000*a.Q/all.props.Ix:null;
    const force=base.target?base.target.M*1000*a.Q/all.props.Ix:null;
    rows.push({section:sec,p:{H:a.effective.H,B:Math.max(top.B,sec.B),Fy:a.effective.Fy},assembly:a,
      out:{...all,supported,flexure:supported?{phiMn}:null},mass:a.mass,reasons,eligible:reasons.length===0,flow,force});
  }
  rows.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||a.mass-b.mass||a.p.H-b.p.H);
  return {...base,scheme:'tee',rows,recommended:rows.find(r=>r.eligible)||null};
}
root.SteelRhTee={assembly,calculate};if(node)module.exports=root.SteelRhTee;
})(typeof globalThis!=='undefined'?globalThis:this);
