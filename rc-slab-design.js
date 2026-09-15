/* Automatic discrete reinforcement selection; no compression-steel credit.
 * Existing verification engines remain available for independent rechecks. */
(function(root){'use strict';
const req=typeof module!=='undefined'&&module.exports;
const R=req?require('./rc-beam.js'):root.RCBeam,S=req?require('./rc-slab-uplift.js'):root.RCSlabUplift;
const O=req?require('./rc-slab-oneway.js'):root.RCSlabOneWay,P=req?require('./rc-slab-plate.js'):root.RCSlabPlate;
const BARS=O.BARS,SPACINGS=O.SPACINGS,clearMin=100/3;
const better=(a,b)=>!b||a.weight<b.weight-1e-8||Math.abs(a.weight-b.weight)<1e-8&&a.spacing>b.spacing;
function oneWay(input){
 const seed={...input,bottomBar:'D10',topBar:'D10',tempBar:'D10',bottomSpacing:150,topSpacing:150,tempSpacing:250};
 O.validate(seed);const load=O.demand(seed),minimum=S.minimumSteel(seed);let best=null;
 const temperatures=[];
 for(const bar of BARS)for(const s of SPACINGS){const b=R.BARS[bar];if(2*b.area*1000/s>=minimum-1e-8&&s<=5*seed.h&&s-b.diameter>=Math.max(clearMin,b.diameter))temperatures.push({bar,s,area:2*b.area*1000/s});}
 for(const spacing of SPACINGS){
  const options={};for(const which of ['bottom','top'])options[which]=BARS.map(bar=>O.face({...seed,[which+'Bar']:bar},which,which==='bottom'?load.Mp:load.Mn,spacing)).filter(v=>v.ok&&v.As>=minimum-1e-8);
  for(const bottom of options.bottom)for(const top of options.top)for(const t of temperatures){
   if(seed.h-2*seed.cover-R.BARS[bottom.bar].diameter-R.BARS[top.bar].diameter-2*R.BARS[t.bar].diameter<clearMin)continue;
   const candidate={bottom,top,temp:t,spacing,weight:bottom.As+top.As+t.area};if(better(candidate,best))best=candidate;
  }
 }
 if(!best)throw Error('자동 배근 설계 미달: D10–D25, 간격 100–300 mm (10 mm 단위) 범위에서 가능한 배근이 없습니다. 두께를 늘리거나 경간·하중을 조정하세요.');
 const p={...seed,bottomBar:best.bottom.bar,topBar:best.top.bar,bottomSpacing:best.spacing,topSpacing:best.spacing,tempBar:best.temp.bar,tempSpacing:best.temp.s};
 return {...O.calculate(p),automatic:true,steelArea:best.weight,commonSpacing:best.spacing};
}
function twoDemand(p){
 if(p.mode==='direct'){
  const r={};for(const k of ['MbX','MbY','MtX','MtY','VX','VY']){if(!Number.isFinite(p[k])||p[k]<0)throw Error('Mu·Vu는 0 이상의 계수된 단면력을 입력하세요.');r[k]=p[k];}
  return {...r,cases:[],plate:null};
 }
 if(p.mode!=='auto'||!Number.isFinite(p.dead)||!Number.isFinite(p.live)||Math.min(p.dead,p.live)<0)throw Error('고정하중·활하중은 0 이상의 숫자를 입력하세요.');
 const edges=Object.fromEntries(P.EDGES.map(k=>[k,p[k]])),plate=P.analyse(p.lx,p.ly,edges);
 const cases=[{name:'1.4D',q:1.4*p.dead},{name:'1.2D + 1.6L',q:1.2*p.dead+1.6*p.live}],governing=cases.reduce((a,b)=>a.q>=b.q?a:b),q=governing.q;
 // Also envelope a full-load 1 m strip in each direction. This deliberate
 // simplification is displayed separately from the plate moment solution.
 const shearFactor=(a,b)=>a===b?.5:.625;
 const r={};for(const k of ['bX','bY','tX','tY'])r['M'+k]=q*plate.envelope[k];
 r.VX=q*Math.max(plate.shear.X,p.lx*shearFactor(p.left,p.right));r.VY=q*Math.max(plate.shear.Y,p.ly*shearFactor(p.bottom,p.top));
 return {...r,cases,governing,plate};
}
function twoFace(p,key,bar,outerBar,spacing,Mu,Vu){
 const steel=R.BARS[bar],outer=R.BARS[outerBar],d=p.h-p.cover-steel.diameter/2-(key.endsWith('Y')?outer.diameter:0),As=steel.area*1000/spacing;
 if(d<=p.h/2)return null;
 const c=S.capacity(p,d,As),AsMin=S.minimumRatio(p.fy)*1000*p.h,phiVc=.75*Math.min(Math.sqrt(p.fck),8.4)*d/6;
 const fs=2*p.fy/3,kcr=p.environment==='dry'?280:210,crackMax=Math.min(375*kcr/fs-2.5*p.cover,300*kcr/fs),maxSpacing=Math.min(2*p.h,300,crackMax);
 const detailOK=As>=AsMin-1e-8&&spacing<=maxSpacing+1e-8&&spacing-steel.diameter>=Math.max(clearMin,steel.diameter);
 const flexOK=Mu<=c.phiMn+1e-8&&c.ductile,shearOK=Vu<=phiVc+1e-8;
 return {...c,key,face:key[0],axis:key[1],bar,spacing,Mu,Vu,d,As,AsMin,phiVc,maxSpacing,detailOK,flexOK,shearOK,ok:detailOK&&flexOK&&shearOK};
}
function twoWay(p){
 for(const k of ['lx','ly','h','cover','fck','fy'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('경간·두께·피복·강도는 0보다 큰 숫자를 입력하세요.');
 if(p.fck<21||p.fck>90||!R.FY.includes(p.fy))throw Error('fck 21–90 MPa, fy 400/500/600 MPa를 사용하세요.');
 if(Math.max(p.lx,p.ly)>50||Math.max(p.lx,p.ly)>2*Math.min(p.lx,p.ly)||p.h<100||p.h>2000)throw Error('경간 50 m 이하, 장단변비 2 이하, 지원 두께 100–2,000 mm를 사용하세요.');
 if(p.mode==='auto'&&p.h>100*Math.min(p.lx,p.ly))throw Error('자동 탄성판 해석은 두께가 단변 경간의 1/10 이하인 슬래브에 적용합니다. 두꺼운 판은 별도 해석한 Mu·Vu를 입력하세요.');
 if(!['dry','other'].includes(p.environment)||P.EDGES.some(k=>!['simple','fixed'].includes(p[k])))throw Error('노출환경과 네 변의 지지조건을 선택하세요.');
 const load=twoDemand(p);let best=null;
 for(const spacing of SPACINGS){
  const options={b:[],t:[]};
  for(const face of ['b','t'])for(const bx of BARS)for(const by of BARS){
   const x=twoFace(p,face+'X',bx,bx,spacing,load['M'+face+'X'],load.VX),y=twoFace(p,face+'Y',by,bx,spacing,load['M'+face+'Y'],load.VY);
   if(x?.detailOK&&x.flexOK&&y?.detailOK&&y.flexOK)options[face].push({x,y,diameters:R.BARS[bx].diameter+R.BARS[by].diameter});
  }
  for(const b of options.b)for(const t of options.t){
   if(p.h-2*p.cover-b.diameters-t.diameters<clearMin)continue;
   const candidate={rows:[b.x,b.y,t.x,t.y],spacing,weight:b.x.As+b.y.As+t.x.As+t.y.As};if(better(candidate,best))best=candidate;
  }
 }
 if(!best)throw Error('자동 배근 설계 미달: 상·하부 동일 간격으로 가능한 D10–D25 배근이 없습니다. 두께를 늘리거나 경간·하중을 조정하세요.');
 const strengthOK=best.rows.every(v=>v.ok),geometryOK=p.h>=100;
 return {p,load,rows:best.rows,commonSpacing:best.spacing,steelArea:best.weight,ratio:Math.max(p.lx,p.ly)/Math.min(p.lx,p.ly),strengthOK,geometryOK,ok:strengthOK&&geometryOK};
}
root.RCSlabDesign={oneWay,twoWay,twoDemand,twoFace,BARS,SPACINGS};if(req)module.exports=root.RCSlabDesign;
})(typeof globalThis!=='undefined'?globalThis:this);
