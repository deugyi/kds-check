/* RC column P-M interaction by strain compatibility.
 * Units: mm, MPa for the section; kN and kN.m for reported strength.
 * The solver is unchanged from the verified TI-Nspire rc_vert.py engine; this
 * file only lifts it out of the page. Clauses and limits: docs/rc-column.md.
 */
(function(root){
'use strict';
const ES=200000;                       // KDS 14 20 10, 4.3.3(2)
const TIES={tie:{label:'띠철근',phi0:.65,k:.80,clause:'식 (4.1-17)'},
            spiral:{label:'나선철근',phi0:.70,k:.85,clause:'식 (4.1-16)'}};
// 표 4.1-2. Values between the tabulated strengths are linearly interpolated.
function params(fck){
  let ecu,eta,beta,t;
  if(fck<=40){ecu=.0033;eta=1.00;beta=.80;}
  else if(fck<=50){t=(fck-40)/10;ecu=.0033-.0001*t;eta=1.00-.03*t;beta=.80;}
  else if(fck<=60){t=(fck-50)/10;ecu=.0032-.0001*t;eta=.97-.02*t;beta=.80-.04*t;}
  else if(fck<=70){t=(fck-60)/10;ecu=.0031-.0001*t;eta=.95-.04*t;beta=.76-.02*t;}
  else if(fck<=80){t=(fck-70)/10;ecu=.0030-.0001*t;eta=.91-.04*t;beta=.74-.02*t;}
  else if(fck<=90){t=(fck-80)/10;ecu=.0029-.0001*t;eta=.87-.03*t;beta=.72-.02*t;}
  else {ecu=.0028;eta=.84;beta=.70;}
  return {ecu,eta,beta};
}
function tensionLimit(fy){return fy<=400?.005:2.5*fy/ES;}
function strengthFactor(et,fy,tie){
  const ey=fy/ES,etl=tensionLimit(fy),phi0=TIES[tie].phi0;
  if(et<=ey)return phi0;
  if(et>=etl)return .85;
  return phi0+(.85-phi0)*(et-ey)/(etl-ey);
}
function zone(phi,tie){
  const phi0=TIES[tie].phi0;
  if(phi>=.8499)return '인장지배단면';
  if(phi<=phi0+.0001)return '압축지배단면';
  return '변화구간단면';
}
function positive(v,name){if(!Number.isFinite(v)||v<=0)throw Error(`${name}은 0보다 큰 숫자여야 합니다.`);}
function validate(p){
  for(const [k,n] of [['b','단면 폭 b'],['h','단면 깊이 h'],['fck','콘크리트 강도'],['fy','철근 강도'],['d','유효깊이 d'],['dp','압축철근 깊이 d′']])positive(p[k],n);
  if(!TIES[p.tie])throw Error('횡보강 형식을 선택해 주세요.');
  if(p.fck<21||p.fck>90)throw Error('콘크리트 강도 지원 범위는 21–90 MPa입니다.');
  if(p.fy>600)throw Error('철근의 설계기준항복강도는 600 MPa 이하입니다. (KDS 14 20 10, 4.2.4)');
  if(p.dp>=p.d)throw Error('d′는 d보다 작아야 합니다.');
  if(p.d>p.h)throw Error('d가 단면 깊이 h를 초과합니다.');
  if(p.mode==='layers'){for(const [k,n] of [['asp','압축철근량 As′'],['as','인장철근량 As']])positive(p[k],n);}
  else if(p.mode==='grid'){
    positive(p.ab,'철근 1개 단면적');
    if(!Number.isInteger(p.nx)||p.nx<2)throw Error('상·하단 철근 개수는 2 이상의 정수여야 합니다.');
    if(!Number.isInteger(p.ny)||p.ny<2)throw Error('철근 열 수는 2 이상의 정수여야 합니다.');
  }else throw Error('배근 방식을 선택해 주세요.');
  if(p.Pu!==null&&(!Number.isFinite(p.Pu)||p.Pu<0))throw Error('소요축력 Pu는 0 이상의 숫자여야 합니다.');
  if(!Number.isFinite(p.Mu)||p.Mu<0)throw Error('소요휨모멘트 Mu는 0 이상의 숫자여야 합니다.');
}
// Layers run from the compression face: [As, d].
function section(p){
  validate(p);
  const lay=[];
  if(p.mode==='layers')lay.push([p.asp,p.dp],[p.as,p.d]);
  else for(let i=0;i<p.ny;i++){
    const di=p.dp+(p.d-p.dp)*i/(p.ny-1);
    const ni=(i===0||i===p.ny-1)?p.nx:2;
    lay.push([ni*p.ab,di]);
  }
  const Ast=lay.reduce((s,L)=>s+L[0],0),Ag=p.b*p.h;
  const dt=lay.reduce((m,L)=>Math.max(m,L[1]),0);
  return {b:p.b,h:p.h,lay,Ag,Ast,rho:Ast/Ag,dt};
}
/* Axial force and moment about the section centroid for a neutral axis at c.
 * Steel inside the compression block has the displaced concrete deducted. */
function pmc(sec,fck,fy,c,tie){
  const k=params(fck),m=k.eta*.85*fck,h=sec.h;
  const a=k.beta*c,ae=Math.min(a,h);
  const Cc=m*sec.b*ae/1000,arm=h/2-ae/2;
  let Pn=Cc,Mn=Cc*arm/1000;
  const rows=[];
  for(const [As,d] of sec.lay){
    const es=k.ecu*(c-d)/c;
    let fs=Math.max(-fy,Math.min(fy,ES*es));
    if(d<=ae&&fs>0)fs-=m;
    const F=As*fs/1000;
    Pn+=F;Mn+=F*(h/2-d)/1000;
    rows.push({d,As,es,fs,F});
  }
  const et=k.ecu*(sec.dt-c)/c;
  return {c,a,ae,Cc,arm,Pn,Mn,et,phi:strengthFactor(et,fy,tie),rows,m,params:k};
}
function bisect(sec,fck,fy,tie,goesUp){
  let lo=.01*sec.dt,hi=12*sec.h;
  for(let i=0;i<160;i++){const c=.5*(lo+hi);if(goesUp(pmc(sec,fck,fy,c,tie)))lo=c;else hi=c;}
  return pmc(sec,fck,fy,.5*(lo+hi),tie);
}
const pureFlexure=(sec,fck,fy,tie)=>bisect(sec,fck,fy,tie,r=>r.Pn<0);
const atEccentricity=(sec,fck,fy,tie,e)=>bisect(sec,fck,fy,tie,r=>r.Mn*1000-e*r.Pn>0);
// KDS 14 20 20, 4.1.2(7) and 식 (4.1-16)(4.1-17).
function axial(sec,fck,fy,tie){
  const t=TIES[tie],Po=(.85*fck*(sec.Ag-sec.Ast)+fy*sec.Ast)/1000;
  return {Po,k:t.k,phi0:t.phi0,clause:t.clause,phiPnMax:t.k*t.phi0*Po};
}
// Sampling is biased toward small c so the tension end of the curve stays smooth.
function curve(sec,fck,fy,tie,phiPnMax,steps){
  const n=steps||220,cmax=6*sec.h,lo=.02*sec.dt,pts=[];
  for(let i=0;i<=n;i++){
    const c=lo+(cmax-lo)*Math.pow(i/n,1.6),r=pmc(sec,fck,fy,c,tie);
    pts.push({c,Mn:r.Mn,Pn:r.Pn,phiMn:r.phi*r.Mn,phiPn:Math.min(r.phi*r.Pn,phiPnMax)});
  }
  return pts;
}
function calculate(p){
  const sec=section(p),k=params(p.fck),ax=axial(sec,p.fck,p.fy,p.tie);
  const ey=p.fy/ES,etl=tensionLimit(p.fy);
  const cb=k.ecu/(k.ecu+ey)*sec.dt,balanced=pmc(sec,p.fck,p.fy,cb,p.tie);
  const ct=k.ecu/(k.ecu+etl)*sec.dt,tensionPoint=pmc(sec,p.fck,p.fy,ct,p.tie);
  const flexure=pureFlexure(sec,p.fck,p.fy,p.tie);
  const Pu=p.Pu===null?0:p.Pu;
  const pure=Pu<=0,e=pure?null:p.Mu*1000/Pu;
  const r=pure?flexure:atEccentricity(sec,p.fck,p.fy,p.tie,e);
  const raw=r.phi*r.Pn,capped=raw>ax.phiPnMax;
  const demand={...r,e,pure,zone:zone(r.phi,p.tie),
    phiPn:capped?ax.phiPnMax:raw,rawPhiPn:raw,capped,phiMn:r.phi*r.Mn};
  demand.ratioP=pure?null:Pu/demand.phiPn;
  demand.ratioM=demand.phiMn>0?p.Mu/demand.phiMn:Infinity;
  demand.ok=pure?p.Mu<=demand.phiMn:(Pu<=demand.phiPn&&p.Mu<=demand.phiMn);
  const notes=[];
  if(sec.rho<.01||sec.rho>.08)notes.push(`철근비 ρ = ${sec.rho.toFixed(5)}가 0.01~0.08 범위를 벗어납니다 (4.3.2(1))`);
  else if(sec.rho>.04)notes.push('겹침이음 구간의 철근비는 0.04 이하로 하여야 합니다 (4.3.2(1))');
  const lowAxial=.10*p.fck*sec.Ag/1000;
  if(Pu<lowAxial)notes.push(`Pu가 0.10·fck·Ag = ${lowAxial.toFixed(1)} kN보다 작아 4.1.2(5)에 따라 휨부재로 취급할 수 있습니다`);
  return {sec,params:k,ES,ey,etl,axial:ax,balanced:{...balanced,cb,eb:balanced.Pn>0?balanced.Mn*1000/balanced.Pn:null},
    tensionPoint:{...tensionPoint,ct},flexure,demand,notes,
    curve:curve(sec,p.fck,p.fy,p.tie,ax.phiPnMax)};
}
root.RCColumn={ES,TIES,params,tensionLimit,strengthFactor,zone,section,pmc,
  pureFlexure,atEccentricity,axial,curve,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCColumn;
})(typeof globalThis!=='undefined'?globalThis:this);
