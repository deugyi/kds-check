/* BH → RH screening, using the shared KDS steel-beam engine. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const S=node?require('./steel-section.js'):root.SteelSection;
const B=node?require('./steel-beam.js'):root.SteelBeam;
const I=node?require('./steel-builtup-i.js'):root.SteelBuiltupI;
const T=node?require('./steel-rh-tee.js'):root.SteelRhTee;
function mass(p){return (2*p.B*p.tf+(p.H-2*p.tf)*p.tw+(p.rolled?4*(p.r||0)**2*(1-Math.PI/4):0))*.00785;}
function calculate(p){
  p={...p,rhGrade:p.bhGrade,teeGrade:p.bhGrade};
  if(!['capacity','load'].includes(p.mode))throw Error('비교 방식을 선택하세요.');
  for(const k of ['maxH','maxB'])if(p[k]!==null&&(!Number.isFinite(p[k])||p[k]<=0))throw Error('후보 치수 상한은 비우거나 양수로 입력하세요.');
  const fy=S.yieldStrength(p.bhGrade,Math.max(p.tf,p.tw));
  if(!fy||!S.STEEL[p.rhGrade])throw Error('강종을 확인하세요.');
  const bh={H:p.H,B:p.B,tw:p.tw,tf:p.tf,Fy:fy,E:S.E,Lb:p.Lb,Cb:p.Cb,Mu:p.mode==='load'?p.Mu:0,Vu:p.mode==='load'?p.Vu:0,rolled:false,J:null,r:0};
  const base=B.calculate(bh);
  // Reuse the built-up I engine for a compact-flange BH with a noncompact web.
  if(base.cls.flange.grade==='조밀'&&base.cls.web.grade==='비조밀'){
    const o=I.calculate({H:p.H,bt:p.B,tt:p.tf,bb:p.B,tb:p.tf,tw:p.tw,Fy:fy,E:S.E,Lb:p.Lb,Cb:p.Cb});
    const d=o.positive;
    base.supported=d.supported;base.message=d.message||'';
    if(d.supported){
      base.flexure={...d,ratio:bh.Mu/d.phiMn,ok:bh.Mu<=d.phiMn+1e-9};
      base.shear={...o.shear,ratio:bh.Vu/o.shear.phiVn,ok:bh.Vu<=o.shear.phiVn+1e-9};
      base.ok=base.flexure.ok&&base.shear.ok;
    }
  }
  // The shared engine's noncompact flange limit is for rolled shapes.
  // Do not use it to claim an equivalent built-up capacity.
  if(base.cls.flange.grade!=='조밀'){
    base.supported=false;delete base.flexure;delete base.shear;
    base.message='BH 비조밀·세장 플랜지의 용접단면 국부좌굴은 지원하지 않습니다.';
  }
  if(p.mode==='load'&&p.Mu===0&&p.Vu===0)throw Error('하중 기준에서는 Mu 또는 Vu에 0보다 큰 설계하중을 입력하세요.');
  const target=p.mode==='capacity'?(base.supported?{M:base.flexure.phiMn,V:base.shear.phiVn}:null):{M:p.Mu,V:p.Vu};
  if(p.scheme==='tee')return T.calculate(p,{bh,base,bhMass:mass(bh),target});
  const rows=[];
  const catalog=S.SECTIONS.filter(s=>s.listed);
  for(const sec of catalog){
    const rp={...sec,Fy:S.yieldStrength(p.rhGrade,Math.max(sec.tf,sec.tw)),E:S.E,Lb:p.Lb,Cb:p.Cb,Mu:target?.M||0,Vu:target?.V||0,rolled:true};
    const out=B.calculate(rp),reasons=[];
    if(!target)reasons.push('BH 내력 산정 불가');
    if(!out.supported)reasons.push('RH 비조밀·세장 웨브');
    if(target&&out.supported){if(!out.flexure.ok)reasons.push('휨 부족');if(!out.shear.ok)reasons.push('전단 부족');}
    if(p.maxH!==null&&sec.H>p.maxH)reasons.push('높이 초과');
    if(p.maxB!==null&&sec.B>p.maxB)reasons.push('폭 초과');
    if(p.keepStiffness&&out.props.Ix<base.props.Ix-1e-6)reasons.push('강축 강성 부족');
    rows.push({section:sec,p:rp,out,mass:mass(rp),reasons,eligible:reasons.length===0});
  }
  rows.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||a.mass-b.mass||a.section.H-b.section.H);
  return {bh,base,bhMass:mass(bh),target,rows,recommended:rows.find(r=>r.eligible)||null};
}
root.SteelReplacement={calculate,mass};
if(node)module.exports=root.SteelReplacement;
})(typeof globalThis!=='undefined'?globalThis:this);
