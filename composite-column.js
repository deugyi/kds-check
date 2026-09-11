/* KDS 14 31 80:2024, symmetric SRC and concrete-filled tubes.
 * mm, MPa, N internally; kN and kN.m at the public result boundary.
 * Scope and independent examples: docs/composite-column.md.
 */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const R=node?require('./rc-beam.js'):root.RCBeam;
const S=node?require('./steel-section.js'):root.SteelSection;
function concreteModulus(fck){if(!Number.isFinite(fck)||fck<21||fck>70)throw Error('콘크리트 강도는 21–70 MPa로 입력하세요.');const delta=fck<=40?4:fck>=60?6:4+(fck-40)/10;return 8500*Math.cbrt(fck+delta);}
const E=210000,Er=200000;
function rect(b,h,x=0,y=0,w=1){return {type:'rect',b,h,x,y,w};}
function circle(r,x=0,y=0,w=1){return {type:'circle',r,x,y,w};}
function properties(regions){
 let A=0,Ix=0,Iy=0;
 for(const q of regions){const a=q.type==='rect'?q.b*q.h:Math.PI*q.r*q.r,ix=q.type==='rect'?q.b*q.h**3/12:a*q.r*q.r/4,iy=q.type==='rect'?q.h*q.b**3/12:ix;A+=q.w*a;Ix+=q.w*(ix+a*q.y*q.y);Iy+=q.w*(iy+a*q.x*q.x);}
 return {A,Ix,Iy};
}
// Exact area and first moment above a cut, for either principal axis.
function above(q,cut,axis){
 const c=axis==='X'?q.y:q.x;
 if(q.type==='rect'){
  const depth=axis==='X'?q.h:q.b,width=axis==='X'?q.b:q.h,lo=Math.max(c-depth/2,cut),hi=c+depth/2;
  return hi<=lo?{A:0,Q:0}:{A:q.w*width*(hi-lo),Q:q.w*width*(hi*hi-lo*lo)/2};
 }
 const r=q.r,z=Math.max(-r,Math.min(r,cut-c)),s=Math.sqrt(Math.max(0,r*r-z*z));
 const A=r*r*Math.acos(z/r)-z*s;
 return {A:q.w*A,Q:q.w*(c*A+2/3*s**3)};
}
function plastic(steel,bars,concrete,Fy,fy,fc,depth,axis){
 function at(cut){let N=0,M=0;
  for(const [regions,stress,tension] of [[steel,Fy,true],[bars,fy,true],[concrete,fc,false]])for(const q of regions){
   const a=above(q,cut,axis),total=above(q,-Infinity,axis);
   N+=stress*(tension?2*a.A-total.A:a.A);M+=stress*(tension?2*a.Q-total.Q:a.Q);
  }return {N,M};
 }
 let lo=-depth/2,hi=depth/2;
 for(let i=0;i<70;i++){const m=(lo+hi)/2;if(at(m).N>0)lo=m;else hi=m;}
 const neutral=(lo+hi)/2,out=at(neutral);
 return {neutral,Mn:Math.abs(out.M)/1e6,phiMn:.9*Math.abs(out.M)/1e6,residual:out.N};
}
function calculate(p){
 p={...p,Ec:concreteModulus(p.fck)};
 if(p.type==='src'&&p.shapeMode==='rh'){const sec=S.findSection(p.section);if(!sec?.listed)throw Error('RH 규격을 선택하세요.');p={...p,sh:sec.H,sb:sec.B,tw:sec.tw,tf:sec.tf};}

 if(!['src','rect','circle'].includes(p.type))throw Error('합성 기둥 형식을 선택하세요.');
 for(const k of ['B','H','fck','Fy','Ec','klx','kly'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('단면·재료·유효좌굴길이는 양수로 입력하세요.');
 if(p.fck<21||p.fck>70||p.Fy>650)throw Error('일반중량 콘크리트 fck 21–70 MPa, 강재 Fy 650 MPa 이하를 입력하세요.');
 for(const k of ['Pu','Mux','Muy'])if(!Number.isFinite(p[k]))throw Error('Pu·Mux·Muy를 입력하세요.');
 if(p.Pu<0)throw Error('현재 합성 기둥 화면은 압축력 Pu ≥ 0을 검토합니다.');
 const src=p.type==='src',round=p.type==='circle',B=p.B,H=round?p.B:p.H;
 let steel=[],bars=[],checks=[],gross=round?[circle(B/2)]:[rect(B,H)],tie=null;
 const check=(label,ok,detail)=>checks.push({label,ok,detail});
 if(src){
  if(p.Fy>450)throw Error('현재 SRC는 강재 Fy ≤ 450 MPa 범위입니다. 고강도 강재의 심부 콘크리트 유효단면은 별도 검토하세요.');
  for(const k of ['sh','sb','tw','tf','cover','tieSpacing','fy'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('SRC 철골·배근 정보를 입력하세요.');
  if(p.fy>650||p.sh<=2*p.tf||p.sb<=p.tw||p.sh>=H||p.sb>=B)throw Error('SRC 철골 크기와 철근 강도를 확인하세요.');
  const bar=R.BARS[p.bar];tie=R.BARS[p.tie];
  if(!bar||!['D10','D13','D16'].includes(p.tie))throw Error('주철근과 띠철근 규격을 선택하세요.');
  if(![p.nb,p.nh].every(n=>Number.isInteger(n)&&n>=2&&n<=30))throw Error('각 변의 철근 수는 모서리 포함 2–30개로 입력하세요.');
  steel=[rect(p.sb,p.tf,0,(p.sh-p.tf)/2),rect(p.tw,p.sh-2*p.tf),rect(p.sb,p.tf,0,-(p.sh-p.tf)/2)];
  const d=p.cover+tie.diameter+bar.diameter/2,x=B/2-d,y=H/2-d,r=bar.diameter/2;
  if(x<=0||y<=0)throw Error('피복과 철근이 단면 안에 들어가지 않습니다.');
  const add=(x,y)=>bars.push(circle(r,x,y,bar.area/(Math.PI*r*r)));
  for(let i=0;i<p.nb;i++){const xx=-x+2*x*i/(p.nb-1);add(xx,y);add(xx,-y);}
  for(let i=1;i<p.nh-1;i++){const yy=-y+2*y*i/(p.nh-1);add(-x,yy);add(x,yy);}
  const clearance=Math.min(...bars.flatMap(b=>steel.map(s=>Math.hypot(Math.max(Math.abs(b.x-s.x)-s.b/2,0),Math.max(Math.abs(b.y-s.y)-s.h/2,0))-r)));
  if(clearance<0)throw Error('주철근이 철골과 겹칩니다. 단면 또는 배근을 조정하세요.');
  check('철골–주철근 순간격',clearance>=Math.max(40,1.5*bar.diameter),`${clearance.toFixed(1)} / 필요 ${Math.max(40,1.5*bar.diameter).toFixed(1)} mm`);
  check('플랜지 콘크리트 순피복',Math.min((B-p.sb)/2,(H-p.sh)/2)>=p.sb/6,`최소 ${Math.min((B-p.sb)/2,(H-p.sh)/2).toFixed(1)} / 필요 ${(p.sb/6).toFixed(1)} mm`);
  const spacingLimit=Math.min(p.tie==='D10'?300:400,Math.min(B,H)/2);
  check('띠철근 간격',p.tieSpacing<=spacingLimit,`${p.tieSpacing} / 한계 ${spacingLimit} mm`);
  check('주철근 순간격',Math.min(2*x/(p.nb-1),2*y/(p.nh-1))-bar.diameter>=Math.max(40,1.5*bar.diameter),'40 mm 및 주철근 지름의 1.5배 이상');
 }else{
  if(!Number.isFinite(p.t)||p.t<=0||2*p.t>=Math.min(B,H))throw Error('강관 두께는 양수이며 단면 크기의 절반보다 작아야 합니다.');
  steel=round?[circle(B/2),circle(B/2-p.t,0,0,-1)]:[rect(B,H),rect(B-2*p.t,H-2*p.t,0,0,-1)];
 }
 const concrete=[...gross,...steel.map(q=>({...q,w:-q.w})),...bars.map(q=>({...q,w:-q.w}))];
 const s=properties(steel),r=properties(bars),c=properties(concrete),g=properties(gross);
 if(c.A<=0||c.Ix<=0||c.Iy<=0)throw Error('콘크리트 유효 단면을 확인하세요.');
 check('강재 단면적 비율',s.A/g.A>=.01,`${(s.A/g.A*100).toFixed(2)}% / 최소 1%`);
 if(src)check('주철근 비율',r.A/g.A>=.004,`${(r.A/g.A*100).toFixed(2)}% / 최소 0.4%`);
 let axialClass='매입형',flexureClass='매입형',lambda=null,lp=null,lr=null,max=null;
 if(!src){
  lambda=round?B/p.t:Math.max(B-2*p.t,H-2*p.t)/p.t;
  lp=round?.15*E/p.Fy:2.26*Math.sqrt(E/p.Fy);lr=round?.19*E/p.Fy:3*Math.sqrt(E/p.Fy);max=round?.31*E/p.Fy:5*Math.sqrt(E/p.Fy);
  axialClass=lambda<=lp?'조밀':lambda<=lr?'비조밀':'세장';
  flexureClass=(round?lambda<=.09*E/p.Fy:lambda<=lp)?'조밀':'비조밀·세장';
  check('강관 최대 폭두께비',lambda<=max,`${lambda.toFixed(2)} / 한계 ${max.toFixed(2)}`);
 }
 const C=src?Math.min(.3,.1+2*s.A/(c.A+s.A)):Math.min(.9,.6+2*s.A/(c.A+s.A));
 const C2=round?.85*(1+1.56*p.Fy*p.t/((B-2*p.t)*p.fck)):.85;
 const Pp=p.Fy*s.A+(src?p.fy*r.A:0)+C2*p.fck*c.A,Py=p.Fy*s.A+.7*p.fck*c.A;
 let Pno=Pp;
 if(!src&&axialClass==='비조밀')Pno=Pp-(Pp-Py)*((lambda-lp)/(lr-lp))**2;
 if(!src&&axialClass==='세장'){const Fcr=round?.72*p.Fy/(lambda*p.Fy/E)**.2:9*E/lambda**2;Pno=Fcr*s.A+.7*p.fck*c.A;}
 function axis(name,KL,Is,Ir,Ic){
  const EI=E*Is+(src?.5:1)*Er*Ir+C*p.Ec*Ic,Pe=Math.PI**2*EI/KL**2,ratio=Pno/Pe;
  const Pn=ratio<=2.25?Pno*.658**ratio:.877*Pe;
  return {name,KL,EI,Pe:Pe/1000,ratio,Pn:Pn/1000,phiPn:.75*Pn/1000};
 }
 const axes=[axis('X',p.klx,s.Ix,r.Ix,c.Ix),axis('Y',p.kly,s.Iy,r.Iy,c.Iy)];
 const compositePr=Math.min(...axes.map(a=>a.phiPn));
 // Steel-only floor is needed only when the composite result is below the
 // gross steel yield upper bound. Slender bare-steel plates are not approved.
 const bareNonslender=src?p.sb/(2*p.tf)<=.56*Math.sqrt(E/p.Fy)&&(p.sh-2*p.tf)/p.tw<=1.49*Math.sqrt(E/p.Fy):round?B/p.t<=.11*E/p.Fy:lambda<=1.4*Math.sqrt(E/p.Fy);
 let steelPr=null;
 if(bareNonslender){steelPr=Math.min(...[['Ix',p.klx],['Iy',p.kly]].map(([key,KL])=>{const Fe=Math.PI**2*E*s[key]/(s.A*KL**2),Fcr=p.Fy/Fe<=2.25?p.Fy*.658**(p.Fy/Fe):.877*Fe;return .9*Fcr*s.A/1000;}));}
 const floorVerified=steelPr!==null||compositePr>=.9*p.Fy*s.A/1000;
 check('순강재 압축강도 하한',floorVerified,steelPr!==null?`φPn ${steelPr.toFixed(1)} kN`:(floorVerified?'합성 압축강도가 순강재 총단면 항복 상한 이상':'순강재 세장판 압축강도 추가 검토 필요'));
 const Pr=Math.max(compositePr,steelPr||0);
 const flexureSupported=src||flexureClass==='조밀';
 const mx=flexureSupported?plastic(steel,bars,concrete,p.Fy,p.fy||0,(round?.95:.85)*p.fck,H,'X'):null;
 const my=flexureSupported?plastic(steel,bars,concrete,p.Fy,p.fy||0,(round?.95:.85)*p.fck,B,'Y'):null;
 let combined=null;
 if(flexureSupported){const axial=p.Pu/Pr,x=Math.abs(p.Mux)/mx.phiMn,y=Math.abs(p.Muy)/my.phiMn,high=axial>=.2,value=high?axial+8/9*(x+y):axial/2+x+y;combined={axial,x,y,high,value,limit:Math.max(0,high?(1-axial)*9/8:1-axial/2),ok:axial<=1&&x<=1&&y<=1&&value<=1};}
 const axialSupported=checks.every(q=>q.ok),hasMoments=Math.abs(p.Mux)+Math.abs(p.Muy)>0;
 return {p:{...p,B,H},steel,bars,concrete,gross,props:{steel:s,bars:r,concrete:c,gross:g},checks,C,C2,Pno:Pno/1000,axes,compositePr,steelPr,Pr,mx,my,combined,axialClass,flexureClass,lambda,lp,lr,max,
  supported:axialSupported&&(!hasMoments||flexureSupported),ok:axialSupported&&p.Pu<=Pr&&(!hasMoments||!!(combined&&combined.ok)),mass:(s.A+r.A)*.00785,concreteVolume:c.A/1e6};
}
root.CompositeColumn={calculate,properties,above,plastic,concreteModulus};if(node)module.exports=root.CompositeColumn;
})(typeof globalThis!=='undefined'?globalThis:this);
