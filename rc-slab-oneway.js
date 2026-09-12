/* Uniform RC slab, 1 m design strip. mm, MPa; kN/m, kN.m/m.
 * KDS clauses and modeling limitations: docs/rc-slab-oneway.md. */
(function(root){
'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const S=typeof module!=='undefined'&&module.exports?require('./rc-slab-uplift.js'):root.RCSlabUplift;
const F=typeof module!=='undefined'&&module.exports?require('./rc-frame.js'):root.RCFrame;
const AGGREGATE=25;
const BARS=['D10','D13','D16','D19','D22','D25'];
const SPACINGS=[75,100,125,150,175,200,225,250,275,300];
function validate(p){
 for(const k of ['h','L','fck','fy','cover','bottomSpacing','topSpacing','tempSpacing'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('치수·강도·피복·간격은 0보다 큰 숫자를 입력하세요.');
 if(p.h>2000||p.L>50)throw Error('지원 범위는 두께 2,000 mm, 경간 50 m 이하입니다.');
 if(p.fck<21||p.fck>90||!R.FY.includes(p.fy))throw Error('fck 21–90 MPa, fy 400/500/600 MPa를 사용하세요.');
 for(const k of ['bottomBar','topBar','tempBar'])if(!BARS.includes(p[k]))throw Error('철근 규격을 선택하세요.');
 if(!['direct','auto'].includes(p.mode)||!['simple','fixed','propped','cantilever'].includes(p.support)||!['dry','other'].includes(p.environment))throw Error('입력 방식·지지조건·노출환경을 선택하세요.');
 for(const k of p.mode==='direct'?['Mp','Mn','V']:['dead','live','point'])if(!Number.isFinite(p[k])||p[k]<0)throw Error('설계하중은 0 이상의 크기로 입력하세요.');
 if(p.mode==='auto'&&p.point>0&&(!Number.isFinite(p.pointX)||p.pointX<0||p.pointX>p.L))throw Error('집중활하중 위치는 왼쪽 끝부터 0–L m 범위에 입력하세요.');
 const db=R.BARS[p.bottomBar].diameter,dt=R.BARS[p.topBar].diameter,ds=R.BARS[p.tempBar].diameter;
 if(p.h-2*p.cover-db-dt-2*ds<Math.max(25,4*AGGREGATE/3))throw Error('상·하부 철근망 사이의 순간격이 부족합니다. 두께·피복·철근을 확인하세요.');
 if(AGGREGATE>p.h/3)throw Error('골재 최대치수는 슬래브 두께의 1/3 이하여야 합니다.');
}
function demand(p){
 if(p.mode==='direct')return {Mp:p.Mp,Mn:p.Mn,V:p.V,formula:'Mu·Vu 직접 입력 · 계수된 설계 포락값',cases:[],governing:{}};
 const support={simple:['pin','pin'],fixed:['fixed','fixed'],propped:['pin','fixed'],cantilever:['fixed','free']}[p.support];
 const cases=[{name:'1.4D',q:1.4*p.dead,P:0},{name:'1.2D + 1.6L',q:1.2*p.dead+1.6*p.live,P:1.6*p.point}].map(c=>{
  const loads=[{type:'uniform',a:0,b:p.L,value:c.q}];
  if(c.P>0)loads.push({type:'point',a:p.pointX,value:c.P});
  const o=F.calculate({fck:p.fck,spans:[{L:p.L,b:1000,h:p.h,loads}],supports:support.map(type=>({type}))}),e=o.beams[0];
  const v=Math.abs(e.extrema.V.min.V)>Math.abs(e.extrema.V.max.V)?e.extrema.V.min:e.extrema.V.max;
  return {...c,Mp:Math.max(0,e.extrema.M.max.M),Mn:Math.max(0,-e.extrema.M.min.M),V:Math.abs(v.V),xp:e.extrema.M.max.x,xn:e.extrema.M.min.x,xv:v.x};
 });
 const governing={};for(const k of ['Mp','Mn','V'])governing[k]=cases.reduce((a,b)=>b[k]>a[k]?b:a);
 return {Mp:governing.Mp.Mp,Mn:governing.Mn.Mn,V:governing.V.V,cases,governing,formula:'1.4D / 1.2D + 1.6L 조합별 직접강성법 · 정·부모멘트와 전단 포락'};
}
function face(p,which,Mu,spacing=p[which+'Spacing']){
 const bar=p[which+'Bar'],steel=R.BARS[bar],As=1000*steel.area/spacing,d=p.h-p.cover-steel.diameter/2;
 const c=S.capacity(p,d,As),AsMin=S.minimumSteel(p),clearMin=Math.max(25,steel.diameter,4*AGGREGATE/3);
 const fs=2*p.fy/3,kcr=p.environment==='dry'?280:210;
 const crackMax=Math.min(375*kcr/fs-2.5*p.cover,300*kcr/fs),detailMax=Math.min(2*p.h,300),sMax=Math.min(detailMax,crackMax);
 const reasons=[];
 if(As<AsMin-1e-8)reasons.push('최소 휨철근량 부족');
 if(c.phiMn<Mu-1e-8)reasons.push('휨강도 부족');
 if(!c.ductile)reasons.push('최소허용변형률 미달');
 if(spacing>detailMax+1e-8)reasons.push('위험단면 최대간격 초과');
 if(spacing>crackMax+1e-8)reasons.push('균열제어 간격 초과');
 if(spacing-steel.diameter<clearMin-1e-8)reasons.push('철근 순간격 부족');
 return {...c,which,Mu,bar,spacing,As,d,AsMin,clearMin,crackMax,detailMax,sMax,reasons,ok:reasons.length===0};
}
function calculate(p){
 validate(p);const load=demand(p),bottom=face(p,'bottom',load.Mp),top=face(p,'top',load.Mn);
 const steel=R.BARS[p.tempBar],AsEach=1000*steel.area/p.tempSpacing,As=2*AsEach,AsMin=S.minimumSteel(p),maxSpacing=Math.min(5*p.h,450),clearMin=Math.max(25,steel.diameter,4*AGGREGATE/3);
 const areaOK=As>=AsMin-1e-8,spacingOK=p.tempSpacing<=maxSpacing+1e-8,clear=p.tempSpacing-steel.diameter,clearOK=clear>=clearMin-1e-8;
 const temp={AsEach,As,AsMin,maxSpacing,clearMin,clear,areaOK,spacingOK,clearOK,ok:areaOK&&spacingOK&&clearOK};
 const d=Math.min(bottom.d,top.d),phiVc=.75*Math.min(Math.sqrt(p.fck),8.4)*1000*d/6/1000;
 const shear={d,phiVc,V:load.V,ok:load.V<=phiVc+1e-8};
 const divisor={simple:20,fixed:28,propped:24,cantilever:10}[p.support],factor=p.fy===400?1:.43+p.fy/700;
 const thickness={absolute:p.h>=100,reference:Math.max(100,p.L*1000/divisor*factor),divisor,factor};
 thickness.referenceOk=p.h>=thickness.reference-1e-8;
 const suggestions={};for(const which of ['bottom','top'])suggestions[which]=SPACINGS.slice().reverse().map(s=>face(p,which,which==='bottom'?load.Mp:load.Mn,s)).find(r=>r.ok)||null;
 return {p,load,bottom,top,temp,shear,thickness,suggestions,ok:bottom.ok&&top.ok&&temp.ok&&shear.ok&&thickness.absolute};
}
root.RCSlabOneWay={AGGREGATE,BARS,SPACINGS,validate,demand,face,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCSlabOneWay;
})(typeof globalThis!=='undefined'?globalThis:this);
