/* Composite beam with steel shear connectors, positive moment region.
 * KDS 14 31 80 : 2024, 4.5 and 4.8. Simple span, solid slab bearing directly
 * on the steel beam. Units: mm, MPa; strength in kN and kN.m.
 * Clauses, the equations recovered from the standard form, and the deliberate
 * omissions are listed in docs/composite-beam.md.
 */
(function(root){
'use strict';
const load=n=>typeof module!=='undefined'&&module.exports?require(n):null;
const S=load('./steel-section.js')||root.SteelSection;
const SB=load('./steel-beam.js')||root.SteelBeam;
const PHI_B=.90;                       // 4.5.2(2)
const STUDS={D13:{d:12.7,a:126.7},D16:{d:15.9,a:198.6},D19:{d:19.1,a:286.5},D22:{d:22.2,a:387.1}};
function positive(v,name){if(!Number.isFinite(v)||v<=0)throw Error(`${name}은 0보다 큰 숫자여야 합니다.`);}
function nonnegative(v,name){if(!Number.isFinite(v)||v<0)throw Error(`${name}은 0 이상의 숫자여야 합니다.`);}
function validate(p){
  for(const [k,n] of [['H','총춤 H'],['B','폭 B'],['tw','웨브 두께 tw'],['tf','플랜지 두께 tf'],
    ['Fy','강재 항복강도 Fy'],['E','강재 탄성계수 E'],['span','보 경간'],['spacing','보 간격'],
    ['ts','슬래브 두께'],['fck','콘크리트 강도'],['Fu','스터드 인장강도 Fu'],['studCount','스터드 개수']])positive(p[k],n);
  for(const [k,n] of [['Mu','소요휨모멘트 Mu'],['Vu','소요전단력 Vu'],['MuConstruction','시공 중 소요휨모멘트']])nonnegative(p[k],n);
  if(!STUDS[p.stud])throw Error('스터드 규격을 선택해 주세요.');
  if(!Number.isInteger(p.studCount))throw Error('스터드 개수는 정수여야 합니다.');
  // 4.2(1): the composite provisions are calibrated for this strength range.
  if(p.fck<21||p.fck>70)throw Error('합성구조의 콘크리트 강도는 21–70 MPa입니다. (KDS 14 31 80, 4.2(1))');
  if(2*p.tf>=p.H)throw Error('플랜지 두께가 총춤의 절반 이상입니다.');
}
// 4.5.1(2). Each side takes the least of three limits; the two sides are summed.
function effectiveWidth(p){
  const half=[{v:p.span/8,why:'보경간의 1/8'},{v:p.spacing/2,why:'인접보 중심간 거리의 1/2'}];
  if(Number.isFinite(p.edge)&&p.edge>0)half.push({v:p.edge,why:'슬래브 가장자리까지의 거리'});
  const each=Math.min(...half.map(h=>h.v));
  return {each,be:2*each,limits:half,governs:half.find(h=>h.v===each).why};
}
/* 4.8.2.1 식 (4.8-1). The equation itself was an image in the source document,
 * so the standard form is used: Qn = 0.5 Asa sqrt(fck Ec) <= Rg Rp Asa Fu.
 * Rg and Rp come from 표 4.3-4, which did survive. */
function studStrength(p){
  const stud=STUDS[p.stud],Ec=.043*Math.pow(p.wc,1.5)*Math.sqrt(p.fck);
  const Rg=1.0,Rp=.75;                 // 골데크 미사용, 형강에 직접 용접
  const push=.5*stud.a*Math.sqrt(p.fck*Ec),cap=Rg*Rp*stud.a*p.Fu;
  const Qn=Math.min(push,cap);
  return {stud,Ec,Rg,Rp,push,cap,governs:push<=cap?'콘크리트 지압':'스터드 강재강도',Qn};
}
/* 4.5.2(5)① 식 (4.5-1). Three limit states; the smallest governs. */
function horizontalShear(p,props,Ac,Qn){
  const concrete=.85*p.fck*Ac/1000;
  const steel=p.Fy*props.A/1000;
  const studs=p.studCount*Qn/1000;
  const V=Math.min(concrete,steel,studs);
  const full=Math.min(concrete,steel);
  return {concrete,steel,studs,V,full,degree:full>0?V/full:0,
    partial:studs<full-1e-9,
    governs:V===studs?'강재 전단연결재':V===concrete?'콘크리트 압괴':'강재단면 인장항복'};
}
// Area and centroid of the steel between two depths measured from the steel top.
function steelSlice(p,from,to){
  const parts=[],add=(w,a,b)=>{if(b>a)parts.push({A:w*(b-a),y:(a+b)/2});};
  add(p.B,Math.max(from,0),Math.min(to,p.tf));
  add(p.tw,Math.max(from,p.tf),Math.min(to,p.H-p.tf));
  add(p.B,Math.max(from,p.H-p.tf),Math.min(to,p.H));
  const A=parts.reduce((s,q)=>s+q.A,0);
  return {A,y:A>0?parts.reduce((s,q)=>s+q.A*q.y,0)/A:0};
}
/* Plastic stress distribution for the positive moment, 4.1.1(1) with the
 * concrete at 0.85 fck. The horizontal shear V' is the compression delivered to
 * the slab; whatever the steel cannot yield in tension against it is carried in
 * steel compression, which puts the plastic neutral axis inside the section.
 * Moments are summed about the plastic neutral axis. */
function plasticMoment(p,props,be,V){
  // V' never exceeds the concrete crushing limit 0.85 fck be ts, so a <= ts.
  const C=V*1000,a=C/(.85*p.fck*be);
  const T=p.Fy*props.A,compSteel=(T-C)/2;
  const slabArm=p.hr+p.ts-a/2;               // slab block centroid above the steel top
  if(compSteel<=1e-6)
    return {case:'슬래브 내 소성중립축',a,pna:null,compSteel:0,
      arm:slabArm+p.H/2,Mn:C*(slabArm+p.H/2)/1e6};
  const flangeCap=p.B*p.tf*p.Fy;
  let pna,label;
  if(compSteel<=flangeCap+1e-6){
    pna=compSteel/(p.B*p.Fy);label='강재 상부 플랜지 내 소성중립축';
  }else{
    pna=p.tf+(compSteel-flangeCap)/(p.tw*p.Fy);label='강재 웨브 내 소성중립축';
    if(pna>p.H-p.tf)throw Error('소성중립축이 하부 플랜지에 도달했습니다. 스터드 개수나 단면을 확인하세요.');
  }
  const comp=steelSlice(p,0,pna),tens=steelSlice(p,pna,p.H);
  const Mn=(C*(pna+slabArm)+p.Fy*comp.A*(pna-comp.y)+p.Fy*tens.A*(tens.y-pna))/1e6;
  return {case:label,a,pna,compSteel,arm:null,comp,tens,Mn};
}
function calculate(p){
  validate(p);
  const props=S.hProps(p.H,p.B,p.tw,p.tf,p.J,p.r);
  const web=(p.H-2*p.tf)/p.tw,webLimit=3.76*Math.sqrt(p.E/p.Fy);
  // 4.5.2(2): a compact web gets the plastic moment, otherwise the yield moment.
  if(web>webLimit)throw Error(`웨브 h/tw = ${web.toFixed(1)}가 3.76√(E/Fy) = ${webLimit.toFixed(1)}를 초과합니다. 이 경우 항복모멘트로 산정해야 하며 이 화면에서 다루지 않습니다.`);
  const ew=effectiveWidth(p);
  const Ac=ew.be*p.ts;                               // 골 내부 콘크리트는 포함하지 않음
  const st=studStrength(p);
  const hs=horizontalShear(p,props,Ac,st.Qn);
  const pm=plasticMoment(p,props,ew.be,hs.V);
  const phiMn=PHI_B*pm.Mn;
  // 4.6.2: shear is carried by the steel section alone.
  const bare=SB.calculate({...p,Lb:p.LbConstruction,Cb:p.CbConstruction,Mu:p.MuConstruction,Vu:p.Vu});
  const required=Math.ceil(hs.full*1000/st.Qn);      // 4.8.2.3 완전합성 소요개수
  return {props,ew,Ac,stud:st,shearFlow:hs,plastic:pm,
    web:{ratio:web,limit:webLimit},
    phiMn,phi:PHI_B,ratioM:phiMn>0?p.Mu/phiMn:Infinity,okM:p.Mu<=phiMn+1e-9,
    steel:bare,requiredStuds:required,
    detail:studDetail(p,st,props),
    okV:bare.supported?bare.shear.ok:null,
    okConstruction:bare.supported?bare.flexure.ok:null,
    ok:(p.Mu<=phiMn+1e-9)&&(bare.supported?bare.shear.ok&&bare.flexure.ok:false)};
}
/* 4.8.1(1), 4.8.2(1) and 4.8.2.4 detailing limits. */
function studDetail(p,st,props){
  const d=st.stud.d,reasons=[];
  if(d>2.5*p.tf+1e-9)reasons.push('스터드 직경이 플랜지 두께의 2.5배를 초과합니다 (4.8.1(1))');
  if(p.studLength<4*d-1e-9)reasons.push('스터드 길이는 몸체직경의 4배 이상이어야 합니다 (4.8.2(1))');
  if(p.studLength>p.hr+p.ts-25+1e-9)reasons.push('스터드 상단 위 콘크리트 피복이 부족합니다');
  const maxSpacing=Math.min(8*(p.ts+p.hr),900);
  const minLong=6*d,minTrans=4*d;
  const layout=p.studCount>1?p.span/(p.studCount-1):null;
  if(layout!==null){
    if(layout>maxSpacing+1e-9)reasons.push('스터드 중심간 간격이 최대 간격을 초과합니다 (4.8.2.4(5))');
    if(layout<minLong-1e-9)reasons.push('길이방향 중심간 간격이 직경의 6배 미만입니다 (4.8.2.4(4))');
  }
  return {d,maxSpacing,minLong,minTrans,layout,reasons,ok:!reasons.length};
}
root.CompositeBeam={PHI_B,STUDS,effectiveWidth,studStrength,horizontalShear,
  plasticMoment,studDetail,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.CompositeBeam;
})(typeof globalThis!=='undefined'?globalThis:this);
