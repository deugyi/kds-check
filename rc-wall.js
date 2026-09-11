/* RC wall: KDS 14 20 22:2022 and 14 20 72:2021.
 * Units mm, MPa, kN, kN.m. Out-of-plane results use 1,000 mm strips.
 * See docs/rc-wall.md for scope, force signs and equation branches. */
(function(root){
'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const ES=200000,PHI_V=.75;
function positive(v,label){if(!Number.isFinite(v)||v<=0)throw Error(label+'은 0보다 큰 숫자여야 합니다.');}
function finite(v,label){if(!Number.isFinite(v))throw Error(label+'을 입력해 주세요.');}
function validate(p){
 for(const k of ['fck','fyv','fyh','t','lw','hw','cover','sv','sh'])positive(p[k],k);
 for(const k of ['N','M','V','Mv','Vv','Nh','Mh','Vh'])finite(p[k],k);
 if(p.Nv!==null)finite(p.Nv,'면외 수직방향 축력');
 if(p.fck<21||p.fck>90)throw Error('콘크리트 강도는 21–90 MPa 범위입니다.');
 if(!R.FY.includes(p.fyv)||![400,500].includes(p.fyh))throw Error('수직근은 400·500·600 MPa, 수평 전단철근은 400·500 MPa를 선택해 주세요.');
 if(!R.BARS[p.bv]||!R.BARS[p.bh])throw Error('철근 규격을 선택해 주세요.');
 if(!['detail','simple'].includes(p.method)||!['detail','simple'].includes(p.outMethod))throw Error('전단 계산 방법을 선택해 주세요.');
 if(!['horizontal','vertical'].includes(p.outer))throw Error('바깥쪽 철근 방향을 선택해 주세요.');
 if(!['general','basement'].includes(p.wallType))throw Error('벽체 용도를 선택해 주세요.');
 if(p.t>3000||p.lw>30000||p.hw>100000||p.lw<p.t)throw Error('벽체 두께 ≤ 3,000 mm, 길이 ≤ 30,000 mm, 높이 ≤ 100,000 mm, 길이 ≥ 두께 범위로 입력해 주세요.');
 if(Math.min(p.sv,p.sh)<40)throw Error('철근 간격은 40 mm 이상 입력해 주세요.');
}
function geometry(p){
 const v=R.BARS[p.bv],h=R.BARS[p.bh];
 const zv=p.cover+(p.outer==='horizontal'?h.diameter:0)+v.diameter/2;
 const zh=p.cover+(p.outer==='vertical'?v.diameter:0)+h.diameter/2;
 const core=p.t-2*(p.cover+v.diameter+h.diameter);
 if(core<25)throw Error('양면 철근망 사이 순거리 25 mm를 확보할 수 없습니다. 두께·피복·철근 규격을 조정하세요.');
 return {v,h,zv,zh,core,d:.8*p.lw,dv:p.t-zv,dh:p.t-zh,Av:1000/p.sv*v.area,Ah:1000/p.sh*h.area,
  rhov:2*v.area/(p.t*p.sv),rhoh:2*h.area/(p.t*p.sh)};
}
function wallShear(p,g){
 const sqrt=Math.min(Math.sqrt(p.fck),8.4),bd=p.t*g.d,N=p.N*1000,V=Math.abs(p.V)*1000,M=Math.abs(p.M)*1e6;
 const simple=Math.max(0,sqrt*bd/6*(N<0?1+N/(3.5*p.t*p.lw):1));
 let Vc=simple,vc1=null,vc2=null,denom=null,note='',used='간편식';
 if(p.method==='detail'&&V>0){
  vc1=.28*sqrt*bd+N*g.d/(4*p.lw);denom=M/V-p.lw/2;
  if(denom>1e-8){vc2=(.05*sqrt+p.lw*(.1*sqrt+.2*N/(p.lw*p.t))/denom)*bd;Vc=Math.max(0,Math.min(vc1,vc2));used='상세식 · 두 식 중 작은 값';}
  else{Vc=Math.max(0,vc1);used='상세식 · 식 (4.9-1)';note='Mu/Vu − lw/2 ≤ 0이므로 식 (4.9-2)는 적용하지 않습니다.';}
 }else if(p.method==='detail'){note='Vu = 0으로 Mu/Vu가 정의되지 않아 간편식 Vc를 표시합니다.';}
 const Vs=2*g.h.area*p.fyh*g.d/p.sh,limit=5*sqrt*bd/6,Vn=Math.min(Vc+Vs,limit),phiVn=PHI_V*Vn/1000;
 const high=V>=PHI_V*Vc/2,baseH=.0025*400/Math.min(p.fyh,500),baseV=.0025*400/Math.min(p.fyv,500);
 const shearRho=Math.max(0,(V/PHI_V-Vc)/(p.fyh*bd));
 const requiredH=Math.max(baseH,shearRho);
 // Eq 4.9-4 uses provided rho_h, bounded by required horizontal ratio;
 // retain the explicit minimum as a lower bound, including unequal grades.
 const minVShear=Math.max(baseV,Math.min(baseV+.5*(2.5-p.hw/p.lw)*(g.rhoh-baseV),requiredH));
 const minHGeneral=g.h.diameter<=15.9?.0020*400/Math.min(p.fyh,500):.0025;
 const minVGeneral=g.v.diameter<=15.9?.0012:.0015;
 const minH=high?Math.max(minHGeneral,requiredH):minHGeneral;
 const minV=high?Math.max(minVGeneral,minVShear):minVGeneral;
 // Use ordinary anchorage spacing, no relaxed hook/connector exception.
 const sH=high?Math.min(3*p.t,450,Math.max(p.t,p.lw/5)):Math.min(3*p.t,450);
 const sV=high?Math.min(p.lw/3,3*p.t,450):Math.min(3*p.t,450);
 return {sqrt,vc1:vc1===null?null:vc1/1000,vc2:vc2===null?null:vc2/1000,denom,Vc:Vc/1000,Vs:Vs/1000,Vn:Vn/1000,limit:limit/1000,phiVn,used,note,high,minH,minV,sH,sV,requiredH,
  demand:V/1000,capacityOK:V/1000<=phiVn+1e-9,capReached:Vc+Vs>limit+1e-7};
}
// Exact concrete-block integration subtracts the circular steel overlap.
// Two symmetric faces; fractional count denotes reinforcement per metre.
function sectionAt(p,As,z,db,fy,c){
 const k=R.concrete(p.fck),stress=.85*k.eta*p.fck,a=Math.min(k.beta*c,p.t),r=db/2;
 let force=stress*1000*a,moment=force*(p.t/2-a/2);const rows=[];
 for(const d of [z,p.t-z]){
  const strain=k.ecu*(c-d)/c,fs=Math.max(-fy,Math.min(fy,ES*strain));
  const u=Math.max(-r,Math.min(r,a-d)),q=Math.sqrt(Math.max(0,r*r-u*u)),factor=As/(Math.PI*r*r);
  const cut=(r*r*(Math.asin(u/r)+Math.PI/2)+u*q)*factor;
  const first=d*cut-2/3*q*q*q*factor,F=As*fs-stress*cut;
  force+=F;moment+=As*fs*(p.t/2-d)-stress*(p.t/2*cut-first);
  rows.push({d,As,strain,fs});
 }
 const et=k.ecu*(p.t-z-c)/c,ey=fy/ES,etl=fy<=400?.005:2.5*ey;
 const phi=et<=ey?.65:et>=etl?.85:.65+.2*(et-ey)/(etl-ey);
 return {c,a,et,phi,Pn:force/1000,Mn:moment/1e6,phiPn:phi*force/1000,phiMn:phi*moment/1e6,rows};
}
function flexure(p,As,z,db,fy,N,Mu){
 const Po=(.85*R.concrete(p.fck).eta*p.fck*(1000*p.t-2*As)+fy*2*As)/1000;
 const compressionLimit=.8*.65*Po,tensionLimit=-.85*fy*2*As/1000;
 const base={N,Mu:Math.abs(Mu),As,z,d:p.t-z,fy,compressionLimit,tensionLimit};
 if(N>compressionLimit+1e-8||N<=tensionLimit+1e-8)return {...base,available:false,phiMn:0,ok:false,note:'입력 축력이 단면의 축력 적용 범위를 벗어납니다.'};
 let lo=1e-8,hi=p.t*1000;
 for(let i=0;i<110;i++){const c=(lo+hi)/2,r=sectionAt(p,As,z,db,fy,c);if(r.phiPn<N)lo=c;else hi=c;}
 const r=sectionAt(p,As,z,db,fy,(lo+hi)/2);
 if(!Number.isFinite(r.phiMn)||Math.abs(r.phiPn-N)>1e-5)throw Error('면외 휨 축력 평형 계산에 실패했습니다.');
 return {...base,...r,available:true,ok:Math.abs(Mu)<=r.phiMn+1e-9,note:'양면 배근 · 변형률 적합 · 입력 축력에서의 단면 휨강도'};
}
function stripShear(p,d,As,N,Mu,Vu){
 const sqrt=Math.min(Math.sqrt(p.fck),8.4),bd=1000*d,Ag=1000*p.t,n=N*1000,m=Math.abs(Mu)*1e6,v=Math.abs(Vu)*1000,rho=As/bd;
 let Vc,limit=null,mm=null,ratio=null,used,note='';
 if(n<0){Vc=Math.max(0,(1+n/(3.5*Ag))*sqrt*bd/6);used='축인장식 (4.2-6)';}
 else if(p.outMethod==='simple'){Vc=(1+n/(14*Ag))*sqrt*bd/6;used=n>0?'간편식 (4.2-2)':'간편식 (4.2-1)';}
 else if(n>0){
  mm=m-n*(4*p.t-d)/8;limit=.29*sqrt*bd*Math.sqrt(1+n/(3.5*Ag));
  if(mm<=0){Vc=limit;used='상세식 상한 (4.2-5)';note='수정모멘트 Mm ≤ 0으로 상한식을 적용합니다.';}
  else{ratio=v*d/mm;Vc=Math.min((.16*sqrt+17.6*rho*ratio)*bd,limit);used='상세식 (4.2-3)·(4.2-4)·(4.2-5)';}
 }else if(m===0&&v===0){Vc=sqrt*bd/6;used='간편식 (4.2-1)';note='Mu = Vu = 0으로 상세식 비율을 정의할 수 없어 간편식을 표시합니다.';}
 else{ratio=m===0?1:Math.min(1,v*d/m);limit=.29*sqrt*bd;Vc=Math.min((.16*sqrt+17.6*rho*ratio)*bd,limit);used='상세식 (4.2-3)';}
 return {N,Mu:Math.abs(Mu),Vu:Math.abs(Vu),d,As,rho,Vc:Vc/1000,phiVn:PHI_V*Vc/1000,Vs:0,mm:mm===null?null:mm/1e6,ratio,limit:limit===null?null:limit/1000,used,note,ok:Math.abs(Vu)<=PHI_V*Vc/1000+1e-9};
}
function calculate(p){
 validate(p);const g=geometry(p),s=wallShear(p,g),Nv=p.Nv===null?p.N/(p.lw/1000):p.Nv;
 const vertical={label:'수직방향',N:Nv,flexure:flexure(p,g.Av,g.zv,g.v.diameter,p.fyv,Nv,p.Mv),shear:stripShear(p,g.dv,g.Av,Nv,p.Mv,p.Vv)};
 const horizontal={label:'수평방향',N:p.Nh,flexure:flexure(p,g.Ah,g.zh,g.h.diameter,p.fyh,p.Nh,p.Mh),shear:stripShear(p,g.dh,g.Ah,p.Nh,p.Mh,p.Vh)};
 const checks=[];const add=(label,value,ok)=>checks.push({label,value,ok});
 add('수평철근비 ρh',`${g.rhoh.toFixed(5)} / 최소 ${s.minH.toFixed(5)}`,g.rhoh>=s.minH-1e-12);
 add('수직철근비 ρv',`${g.rhov.toFixed(5)} / 최소 ${s.minV.toFixed(5)}`,g.rhov>=s.minV-1e-12);
 add('수평철근 간격',`${p.sh} / 최대 ${s.sH.toFixed(1)} mm`,p.sh<=s.sH+1e-9);
 add('수직철근 간격',`${p.sv} / 최대 ${s.sV.toFixed(1)} mm`,p.sv<=s.sV+1e-9);
 const clr=Math.max(25,4*25/3); // default 25 mm maximum aggregate, stated in UI
 add('철근 순간격',`수직 ${(p.sv-g.v.diameter).toFixed(1)} / 수평 ${(p.sh-g.h.diameter).toFixed(1)} mm`,p.sv-g.v.diameter>=Math.max(clr,g.v.diameter)&&p.sh-g.h.diameter>=Math.max(clr,g.h.diameter));
 add('양면 철근망 사이',`${g.core.toFixed(1)} / 최소 ${clr.toFixed(1)} mm`,g.core>=clr);
 const generalFaces=p.wallType==='basement'||p.t<250||Math.min(g.zv,g.zh)>=50&&Math.max(g.zv,g.zh)<=p.t/3;
 add('양면 철근 위치',`표면부터 ${g.zv.toFixed(1)} / ${g.zh.toFixed(1)} mm`,generalFaces);
 add('벽체 적용 축력 한계',`${Math.max(p.N,Nv*p.lw/1000).toFixed(1)} / 0.4Agfck ${(0.4*p.t*p.lw*p.fck/1000).toFixed(1)} kN`,Math.max(p.N,Nv*p.lw/1000)<=.4*p.t*p.lw*p.fck/1000);
 add('면외 스트립 축력 범위',`${Math.max(Nv,p.Nh).toFixed(1)} / 0.4btfck ${(.4*1000*p.t*p.fck/1000).toFixed(1)} kN/m`,Math.max(Nv,p.Nh)<=.4*p.t*p.fck);
 add('수직철근비 상한',`${g.rhov.toFixed(5)} / 0.01000`,g.rhov<=.01);
 add('벽체 최소 두께',`${p.t} / 최소 ${p.wallType==='basement'?200:100} mm`,p.t>=(p.wallType==='basement'?200:100));
 const detailOK=checks.every(c=>c.ok),ipOK=s.capacityOK&&detailOK;
 return {p,g,s,Nv,vertical,horizontal,checks,detailOK,ipOK,ok:ipOK&&vertical.flexure.ok&&vertical.shear.ok&&horizontal.flexure.ok&&horizontal.shear.ok};
}
root.RCWall={validate,geometry,wallShear,sectionAt,flexure,stripShear,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCWall;
})(typeof globalThis!=='undefined'?globalThis:this);
