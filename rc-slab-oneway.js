/* Uniform RC slab, 1 m design strip. mm, MPa; kN/m, kN.m/m.
 * KDS clauses and modeling limitations: docs/rc-slab-oneway.md. */
(function(root){
'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const S=typeof module!=='undefined'&&module.exports?require('./rc-slab-uplift.js'):root.RCSlabUplift;
const BARS=['D10','D13','D16','D19','D22','D25'];
const SPACINGS=[75,100,125,150,175,200,225,250,275,300];
function validate(p){
 for(const k of ['h','L','fck','fy','cover','aggregate','bottomSpacing','topSpacing','tempSpacing'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('치수·강도·피복·간격은 0보다 큰 숫자를 입력하세요.');
 if(p.h>2000||p.L>50)throw Error('지원 범위는 두께 2,000 mm, 경간 50 m 이하입니다.');
 if(p.fck<21||p.fck>90||!R.FY.includes(p.fy))throw Error('fck 21–90 MPa, fy 400/500/600 MPa를 사용하세요.');
 for(const k of ['bottomBar','topBar','tempBar'])if(!BARS.includes(p[k]))throw Error('철근 규격을 선택하세요.');
 if(!['direct','auto'].includes(p.mode)||!['simple','fixed','cantilever'].includes(p.support)||!['dry','other'].includes(p.environment))throw Error('입력 방식·지지조건·노출환경을 선택하세요.');
 for(const k of p.mode==='direct'?['Mp','Mn','V']:['wu'])if(!Number.isFinite(p[k])||p[k]<0)throw Error('설계하중은 0 이상의 크기로 입력하세요.');
 const db=R.BARS[p.bottomBar].diameter,dt=R.BARS[p.topBar].diameter,ds=R.BARS[p.tempBar].diameter;
 if(p.h-2*p.cover-db-dt-2*ds<Math.max(25,4*p.aggregate/3))throw Error('상·하부 철근망 사이의 순간격이 부족합니다. 두께·피복·철근을 확인하세요.');
 if(p.aggregate>p.h/5)throw Error('골재 최대치수는 슬래브 두께의 1/5 이하여야 합니다.');
}
function demand(p){
 if(p.mode==='direct')return {Mp:p.Mp,Mn:p.Mn,V:p.V,formula:'Mu·Vu 직접 입력 · 각각의 설계 포락값'};
 const q=p.wu,L=p.L;
 if(p.support==='simple')return {Mp:q*L*L/8,Mn:0,V:q*L/2,formula:'단순지지: M+=WuL²/8, M−=0, V=WuL/2'};
 if(p.support==='fixed')return {Mp:q*L*L/24,Mn:q*L*L/12,V:q*L/2,formula:'양단고정: M+=WuL²/24, |M−|=WuL²/12, V=WuL/2'};
 return {Mp:0,Mn:q*L*L/2,V:q*L,formula:'캔틸레버: M+=0, |M−|=WuL²/2, V=WuL'};
}
function face(p,which,Mu,spacing=p[which+'Spacing']){
 const bar=p[which+'Bar'],steel=R.BARS[bar],As=1000*steel.area/spacing,d=p.h-p.cover-steel.diameter/2;
 const c=S.capacity(p,d,As),AsMin=S.minimumSteel(p),clearMin=Math.max(25,steel.diameter,4*p.aggregate/3);
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
 const steel=R.BARS[p.tempBar],AsEach=1000*steel.area/p.tempSpacing,As=2*AsEach,AsMin=S.minimumSteel(p),maxSpacing=Math.min(5*p.h,450),clearMin=Math.max(25,steel.diameter,4*p.aggregate/3);
 const temp={AsEach,As,AsMin,maxSpacing,clearMin,ok:As>=AsMin-1e-8&&p.tempSpacing<=maxSpacing+1e-8&&p.tempSpacing-steel.diameter>=clearMin-1e-8};
 const d=Math.min(bottom.d,top.d),phiVc=.75*Math.min(Math.sqrt(p.fck),8.4)*1000*d/6/1000;
 const shear={d,phiVc,V:load.V,ok:load.V<=phiVc+1e-8};
 const divisor={simple:20,fixed:28,cantilever:10}[p.support],factor=p.fy===400?1:.43+p.fy/700;
 const thickness={absolute:p.h>=100,reference:Math.max(100,p.L*1000/divisor*factor),divisor,factor};
 thickness.referenceOk=p.h>=thickness.reference-1e-8;
 const suggestions={};for(const which of ['bottom','top'])suggestions[which]=SPACINGS.slice().reverse().map(s=>face(p,which,which==='bottom'?load.Mp:load.Mn,s)).find(r=>r.ok)||null;
 return {p,load,bottom,top,temp,shear,thickness,suggestions,ok:bottom.ok&&top.ok&&temp.ok&&shear.ok&&thickness.absolute};
}
root.RCSlabOneWay={BARS,SPACINGS,validate,demand,face,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCSlabOneWay;
})(typeof globalThis!=='undefined'?globalThis:this);
