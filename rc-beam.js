/* RC beam automatic layouts. Units: mm, MPa, N; reported moment: kN.m.
 * Sources and deliberate scope are documented in docs/rc-beam.md.
 * Kept independent of the legacy column/steel engines and of the DOM.
 */
(function(root){
'use strict';
const BARS={D10:{diameter:9.53,area:71.33},D13:{diameter:12.7,area:126.7},D16:{diameter:15.9,area:198.6},D19:{diameter:19.1,area:286.5},D22:{diameter:22.2,area:387.1},D25:{diameter:25.4,area:506.7},D29:{diameter:28.6,area:642.4},D32:{diameter:31.8,area:794.2},D35:{diameter:34.9,area:956.6}};
const FCK=[21,24,27,30,35,40,45,50,60,70,80,90], FY=[400,500,600], STIRRUPS=['D10','D13','D16'];
function concrete(fc){
  const rows=[[40,.0033,1,.8],[50,.0032,.97,.8],[60,.0031,.95,.76],[70,.003,.91,.74],[80,.0029,.87,.72],[90,.0028,.84,.70]];
  if(fc<21||fc>90) throw Error('콘크리트 강도 지원 범위는 21–90 MPa입니다.');
  if(fc<=40) return {ecu:.0033,eta:1,beta:.8};
  for(let i=1;i<rows.length;i++) if(fc<=rows[i][0]){const a=rows[i-1],b=rows[i],t=(fc-a[0])/(b[0]-a[0]);return {ecu:a[1]+t*(b[1]-a[1]),eta:a[2]+t*(b[2]-a[2]),beta:a[3]+t*(b[3]-a[3])};}
}
function validate(p){
  for(const k of ['b','h','fck','fy','cover','aggregate']) if(!Number.isFinite(p[k])||p[k]<=0) throw Error('치수·강도·피복·골재 값은 0보다 큰 숫자여야 합니다.');
  if(p.b>3000||p.h>5000) throw Error('이 화면의 지원 단면 범위는 폭 3,000 mm, 높이 5,000 mm 이하입니다.');
  if(!BARS[p.bar]||!STIRRUPS.includes(p.stirrup)||!(p.fck>=21&&p.fck<=90)||!FY.includes(p.fy)) throw Error('지원하는 철근 규격과 재료강도를 선택해 주세요.');
  if(p.fyt!==undefined&&!FY.includes(p.fyt)) throw Error('스터럽 강도를 선택해 주세요.');
  if(!Number.isInteger(p.compressionCount??0)||(p.compressionCount??0)<0) throw Error('압축철근 개수는 0 이상의 정수여야 합니다.');
  if((p.compressionCount??0)>0&&!BARS[p.compressionBar]) throw Error('압축철근 규격을 선택해 주세요.');
  if(p.aggregate>Math.min(p.b,p.h)/5) throw Error('골재 최대치수가 단면 최소 치수의 1/5을 초과합니다.');
}
// A corner bar nests inside the stirrup bend arc, so its centre sits further in
// than a bar merely tangent to the two straight legs. Radii below the bend fit
// against the legs instead and keep the tangent position.
function cornerOffset(p,st,radius){
  const bend=2*st.diameter;
  return p.cover+st.diameter+Math.max(radius,bend-(bend-radius)/Math.SQRT2);
}
function geometry(p){
  validate(p);
  const bar=BARS[p.bar],st=BARS[p.stirrup],db=bar.diameter,bend=2*st.diameter;
  const edge=cornerOffset(p,st,db/2);
  const horizontalClear=Math.max(25,db,4*p.aggregate/3);
  const verticalClear=Math.max(25,4*p.aggregate/3);
  const usable=p.b-2*edge+db;
  const perLayer=Math.max(0,Math.floor((usable+horizontalClear+1e-9)/(db+horizontalClear)));
  let maxLayers=Math.max(0,Math.min(3,Math.floor((p.h-2*edge+1e-9)/(db+verticalClear))+1));
  let compression=null;
  if((p.compressionCount??0)>0){
    const cb=BARS[p.compressionBar],count=p.compressionCount,ce=cornerOffset(p,st,cb.diameter/2);
    const clear=Math.max(25,cb.diameter,4*p.aggregate/3);
    const capacity=Math.max(0,Math.floor((p.b-2*ce+cb.diameter+clear+1e-9)/(cb.diameter+clear)));
    if(count>capacity)throw Error(`압축철근은 상부 1단에 최대 ${capacity}가닥까지 배치할 수 있습니다.`);
    const xs=count===1?[p.b/2]:Array.from({length:count},(_,i)=>ce+(p.b-2*ce)*i/(count-1));
    compression={count,d:ce,xs,bar:cb};
    const minDepth=ce+cb.diameter/2+verticalClear+db/2;
    maxLayers=Math.max(0,Math.min(maxLayers,Math.floor((p.h-edge-minDepth+1e-9)/(db+verticalClear))+1));
  }
  return {bar,st,bend,edge,horizontalClear,verticalClear,usable,perLayer,maxLayers,compression};
}
// Select paired positions on the bottom-row grid, maintaining vertical alignment.
function positions(base,count,edge,width){
  if(count<1||count>base||(base%2===0&&count%2===1)) return null;
  const xs=[];
  for(let i=0;i<Math.floor(count/2);i++){xs.push(edge+(width-2*edge)*i/(base-1));xs.push(edge+(width-2*edge)*(base-1-i)/(base-1));}
  if(count%2) xs.push(width/2);
  return xs.sort((a,b)=>a-b);
}
function sectionAt(p,g,layers,c){
  const k=concrete(p.fck),stress=.85*k.eta*p.fck,a=Math.min(k.beta*c,p.h);
  let force=stress*p.b*a,moment=force*a/2;
  const strains=[],stresses=[];
  // Integrate the displaced circular steel area within the concrete block.
  // A partial intersection is continuous even when the neutral axis is shallow.
  function steel(layer,bar){
    const strain=k.ecu*(c-layer.d)/c,fs=Math.max(-p.fy,Math.min(p.fy,200000*strain));
    const radius=bar.diameter/2,z=Math.max(-radius,Math.min(radius,a-layer.d));
    const q=Math.sqrt(Math.max(0,radius*radius-z*z)),ratio=bar.area/(Math.PI*radius*radius);
    const area=(radius*radius*(Math.asin(z/radius)+Math.PI/2)+z*q)*ratio;
    const firstMoment=layer.d*area-2/3*q*q*q*ratio;
    force+=layer.count*(bar.area*fs-stress*area);
    moment+=layer.count*(bar.area*fs*layer.d-stress*firstMoment);
    return {strain:-strain,stress:-fs};
  }
  for(const layer of layers){const r=steel(layer,g.bar);strains.push(r.strain);stresses.push(r.stress);}
  const compression=g.compression?steel(g.compression,g.compression.bar):null;
  return {force,Mn:-moment/1e6,strains,stresses,a,k,compression};
}
function strength(p,g,layers){
  let lo=1e-8,hi=p.h*2;
  if(sectionAt(p,g,layers,lo).force>=0||sectionAt(p,g,layers,hi).force<=0) throw Error('단면 평형해를 찾을 수 없습니다.');
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(sectionAt(p,g,layers,mid).force<0)lo=mid;else hi=mid;}
  const c=(lo+hi)/2,r=sectionAt(p,g,layers,c);
  const et=r.strains[0],ey=p.fy/200000,etl=p.fy<=400?.005:2.5*ey,emin=p.fy<=400?.004:2*ey;
  const phi=et<=ey?.65:et>=etl?.85:.65+.20*(et-ey)/(etl-ey);
  const phiMn=phi*r.Mn,As=layers.reduce((sum,l)=>sum+l.count*g.bar.area,0);
  const d=layers.reduce((sum,l)=>sum+l.count*g.bar.area*l.d,0)/As;
  const minMoment=1.2*.63*Math.sqrt(p.fck)*p.b*p.h*p.h/6/1e6;
  const tensionOnly=r.strains.every(e=>e>0),ductile=et>=emin-1e-12,minimum=phiMn>=minMoment-1e-9;
  if(![phiMn,c,As,d,r.force].every(Number.isFinite)||Math.abs(r.force)>Math.max(1,As*p.fy)*1e-8)throw Error('평형 검증에 실패했습니다.');
  const reasons=[];
  if(!tensionOnly) reasons.push('일부 철근 압축영역: 제외');
  if(!ductile) reasons.push('최소허용변형률 미달');
  if(!minimum) reasons.push('최소 휨철근 조건 미달');
  return {...r,c,et,etl,emin,phi,phiMn:tensionOnly?phiMn:null,As,d,minMoment,tensionOnly,ductile,minimum,eligible:tensionOnly&&ductile&&minimum,reasons};
}
function calculate(p){
  const g=geometry(p),results=[];
  if(g.perLayer<2||g.maxLayers<1)return {g,results,message:'주어진 피복·간격 조건에서 하부 철근 2가닥을 배치할 수 없습니다.'};
  // One representative per total count: fill lower rows first; widest valid
  // symmetric bottom grid first. This is not an exhaustive/optimal rebar design.
  for(let total=2;total<=g.perLayer*g.maxLayers;total++){
    for(let base=Math.min(total,g.perLayer);base>=2;base--){
      const countLayers=Math.ceil(total/base);if(countLayers>g.maxLayers)continue;
      const counts=Array(countLayers).fill(base);counts[countLayers-1]=total-base*(countLayers-1);
      const grids=counts.map(n=>positions(base,n,g.edge,p.b));if(grids.some(x=>x===null))continue;
      const layers=counts.map((count,i)=>({count,d:p.h-g.edge-i*(g.bar.diameter+g.verticalClear),xs:grids[i]}));
      const r=strength(p,g,layers);results.push({...r,total,counts,layers,key:counts.join('+')});break;
    }
  }
  return {g,results,message:''};
}
root.RCBeam={BARS,FCK,FY,STIRRUPS,concrete,geometry,positions,strength,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCBeam;
})(typeof globalThis!=='undefined'?globalThis:this);
