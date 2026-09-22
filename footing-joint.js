/* Horizontal lift joints in rectangular isolated footings / 1 m mat strips.
 * mm, MPa, kN, kN.m. See docs/footing-joint.md for load paths and scope.
 */
(function(root){'use strict';
const req=typeof module==='object'&&module.exports;
const R=req?require('./rc-beam.js'):root.RCBeam,S=req?require('./rc-slab-uplift.js'):root.RCSlabUplift;
const F=req?require('./rc-footing.js'):root.RCFooting;
const Age=req?require('./concrete-age.js'):root.ConcreteAge,Dev=req?require('./rebar-development.js'):root.RebarDevelopment;
const COLORS=['#2878b5','#df9a33','#3a9b78','#8b6cb5','#c96772'];
const defaults={mode:'soil',fck:40,fy:500,fyt:500,fyd:500,bx:3000,by:3000,h:1500,cx:600,cy:600,cover:80,
 Ps:1500,Pu:2100,qa:250,pileCount:4,diameter:500,gapFactor:2.5,pileAllow:800,
 barX:'D25',barY:'D25',spacing:150,crossBar:'D13',crossLegs:2,crossSX:400,crossSY:400,dowel:'D16',
 surface:'rough',compressionMode:'none',compression:0,strengthMode:'estimate',cement:'normal',temperature:20,
 stages:[{height:750,days:7,load:0,wet:{mx:0,my:0,vx:0,vy:0},cured:{mx:0,my:0,vx:0,vy:0}},
 {height:750,days:7,load:100,wet:{mx:0,my:0,vx:150,vy:150},cured:{mx:300,my:300,vx:400,vy:400}}],strengths:{}};
const clone=v=>JSON.parse(JSON.stringify(v));
const ec=fc=>8500*Math.cbrt(fc+Math.max(4,Math.min(6,4+(fc-40)/10)));
function num(v,n,min=0){if(!Number.isFinite(v)||v<min)throw Error(n+'은 '+min+' 이상의 숫자로 입력하세요.');}
function positive(v,n){num(v,n);if(v===0)throw Error(n+'은 0보다 커야 합니다.');}
function validate(p){
 if(!['soil','pile','mat'].includes(p.mode))throw Error('기초 형식을 선택하세요.');
 for(const k of ['bx','by','h','cover','spacing','crossSX','crossSY'])positive(p[k],k);
 if(p.h>5000||p.bx>30000||p.by>30000)throw Error('평면 30 m, 전체 두께 5 m 이하를 지원합니다.');
 if(p.fck<21||p.fck>90||!Number.isFinite(p.fck)||![400,500,600].includes(p.fy)||![400,500].includes(p.fyt)||![400,500].includes(p.fyd))throw Error('fck 21~90 MPa, 주철근 fy 400/500/600, 전단·다월바 fy 400/500 MPa를 선택하세요.');
 for(const k of ['barX','barY','crossBar','dowel'])if(!R.BARS[p[k]])throw Error('철근 규격을 선택하세요.');
 if(p.spacing<100||p.spacing>300||p.spacing%10)throw Error('주철근 공통 간격은 100~300 mm, 10 mm 단위입니다.');
 if(!Number.isInteger(p.crossLegs)||p.crossLegs<0||p.crossLegs>6)throw Error('기존 관통철근 다리 수는 격자당 0~6개입니다.');
 if(p.crossSX<R.BARS[p.crossBar].diameter+25||p.crossSY<R.BARS[p.crossBar].diameter+25)throw Error('관통철근 간격이 부족합니다.');
 if(!['rough','smooth'].includes(p.surface)||!['estimate','manual'].includes(p.strengthMode))throw Error('접합면·발현강도 입력 방식을 확인하세요.');
 if(!['none','manual'].includes(p.compressionMode))throw Error('영구 순압축력 반영 방식을 선택하세요.');
 if(p.compressionMode==='manual')num(p.compression,'최소 영구 순압축응력');
 if(!Array.isArray(p.stages)||p.stages.length<2||p.stages.length>5)throw Error('타설 차수는 2~5차입니다.');
 let sum=0;for(const s of p.stages){positive(s.height,'차수별 높이');num(s.days,'경과일수');sum+=s.height;
  if(p.mode!=='mat'){num(s.load,'전달 축력 비율');if(s.load>100)throw Error('전달 축력 비율은 0~100%입니다.');}
  else for(const phase of ['wet','cured']){if(!s[phase])throw Error('타설 중·양생 후 해석력을 각각 입력하세요.');for(const key of ['mx','my','vx','vy'])if(!Number.isFinite(s[phase][key]))throw Error('단위폭 Mu·Vu를 숫자로 입력하세요.');}
 }
 if(Math.abs(sum-p.h)>.01)throw Error('차수별 타설 높이 합계가 전체 기초 두께와 같아야 합니다.');
 if(p.mode!=='mat'){
  for(const k of ['Ps','Pu','cx','cy'])positive(p[k],k);
  if(p.mode==='soil')positive(p.qa,'허용지내력');else positive(p.pileAllow,'파일 허용지지력');
 }
}
function geometry(p){
 let g={bx:p.bx,by:p.by,footingX:0,footingY:0,points:[]};
 if(p.mode==='pile'){const a=F.pileCountLayout(p);g={...g,...a,points:a.autoPoints.map((v,i)=>({id:i+1,x:v.x/1000,y:v.y/1000}))};}
 g.B=g.bx/1000;g.L=g.by/1000;g.A=g.B*g.L;
 g.bounds={left:g.footingX/1000-g.B/2,right:g.footingX/1000+g.B/2,bottom:g.footingY/1000-g.L/2,top:g.footingY/1000+g.L/2};
 if(g.bx<=2*p.cover||g.by<=2*p.cover)throw Error('기초 폭에 양측 피복을 확보할 수 없습니다.');
 if(p.mode!=='mat'&&(-p.cx/2000<=g.bounds.left||p.cx/2000>=g.bounds.right||-p.cy/2000<=g.bounds.bottom||p.cy/2000>=g.bounds.top))throw Error('기둥이 기초 외곽 안에 있어야 합니다.');
 return g;
}
function steel(p,H,axis){
 const db=R.BARS[p['bar'+axis]],dx=R.BARS[p.barX].diameter;
 const z=p.cover+(axis==='X'?db.diameter/2:dx+db.diameter/2),As=db.area*1000/p.spacing;
 if(H<=z+p.cover)throw Error('양생된 높이에 하부 철근과 피복을 확보할 수 없습니다.');
 const layers=[{count:1000/p.spacing,d:H-z}];
 if(Math.abs(H-p.h)<.01)layers.push({count:1000/p.spacing,d:z});
 return {db,z,d:H-z,As,layers,hasTop:Math.abs(H-p.h)<.01};
}
// Internal forces from net upward reaction outside a strip cut. Pile reactions
// are kept as point loads for interface-demand envelopes (no d-cut reduction).
function forces(p,g,k,wet,H,loaded){
 if(p.mode==='mat')return {axes:['X','Y'].map(a=>({axis:a,Mu:p.stages[k-1][wet?'wet':'cured']['m'+a.toLowerCase()],Vu:Math.abs(p.stages[k-1][wet?'wet':'cured']['v'+a.toLowerCase()]),Vd:null})),load:null,W:g.A*loaded/1000*24,bearing:null,piles:[]};
 const share=(wet?(k>1?p.stages[k-2].load:0):p.stages[k-1].load)/100;
 const Ns=p.Ps*share,Nu=p.Pu*share,W=g.A*loaded/1000*24,wu=1.2*W/g.A,totalS=Ns+W,totalU=Nu+1.2*W;
 let piles=[],bearing;
 if(p.mode==='soil')bearing={value:totalS/g.A,limit:p.qa,unit:'kPa',ok:totalS/g.A<=p.qa};
 else{
  const xx=g.points.reduce((a,v)=>a+v.x*v.x,0),yy=g.points.reduce((a,v)=>a+v.y*v.y,0);
  piles=g.points.map(v=>({...v,Rs:totalS/g.points.length+W*(g.footingX/1000)*v.x/xx+W*(g.footingY/1000)*v.y/yy,Ru:totalU/g.points.length+1.2*W*(g.footingX/1000)*v.x/xx+1.2*W*(g.footingY/1000)*v.y/yy}));
  if(piles.some(v=>Math.min(v.Rs,v.Ru)<-1e-8))throw Error('인발 파일이 발생하여 압축 파일 모델 범위를 벗어납니다.');
  bearing={value:Math.max(...piles.map(v=>v.Rs)),limit:p.pileAllow,unit:'kN/본',ok:Math.max(...piles.map(v=>v.Rs))<=p.pileAllow};
 }
 const axes=['X','Y'].map(axis=>{
  const width=axis==='X'?g.L:g.B,face=(axis==='X'?p.cx:p.cy)/2000;
  const d=H>0?steel(p,H,axis).d/1000:0,band=(axis==='X'?g.B:g.L)<width?2*Math.max(g.B,g.L)/(g.B+g.L):1;
  let Mu=0,MuNeg=0,MuPos=0,Vu=0,Vd=0,Vavg=0;const sides=[];
  for(const sign of [-1,1]){
   const edge=axis==='X'?(sign>0?g.bounds.right:-g.bounds.left):(sign>0?g.bounds.top:-g.bounds.bottom),l=edge-face;
   const point=v=>sign*(axis==='X'?v.x:v.y);
   if(p.mode==='soil'){
    const q=Nu/g.A,M=q*l*l/2;Mu=Math.max(Mu,M*band);MuPos=Mu;Vu=Math.max(Vu,q*l);Vd=Math.max(Vd,q*Math.max(0,l-d));Vavg=Math.max(Vavg,q*l/2);sides.push({sign,Mu:M,Vu:q*l,Vavg:q*l/2,length:l});
   }else{
    const M=x=>piles.reduce((a,v)=>a+v.Ru*Math.max(0,point(v)-x),0)/width-wu*(edge-x)**2/2;
    const cuts=[face,edge,...piles.map(point).filter(x=>x>=face&&x<=edge)].sort((a,b)=>a-b);
    const shear=(x,include)=>piles.reduce((a,v)=>a+((include?point(v)>=x:point(v)>x)?v.Ru:0),0)/width-wu*(edge-x);
    // Moment extrema also occur where V=0 between pile reaction jumps.
    const moments=cuts.slice();for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1],va=shear(a,false);if(wu>0){const z=a-va/wu;if(z>a&&z<b)moments.push(z);}}
    for(const x of moments){const m=M(x)*band;if(Math.abs(m)>Math.abs(Mu))Mu=m;MuPos=Math.max(MuPos,m);MuNeg=Math.min(MuNeg,m);}
    for(const x of cuts){Vu=Math.max(Vu,Math.abs(shear(x,false)),Math.abs(shear(x,true)));}
    // Integrate |V| exactly between reaction jumps. Include zero crossings,
    // so opposing shear does not cancel; point jumps have zero measure.
    let integral=0;
    for(let i=0;i<cuts.length-1;i++){
     const a=cuts[i],b=cuts[i+1],va=shear(a,false),vb=shear(b,true),aa=Math.abs(va),bb=Math.abs(vb);
     integral+=(b-a)*(va*vb<0?(aa*aa+bb*bb)/(2*(aa+bb)):(aa+bb)/2);
    }
    const mean=integral/l;Vavg=Math.max(Vavg,mean);
    const cut=Math.min(edge,face+d),lv=edge-cut;
    const vd=piles.reduce((a,v)=>a+v.Ru*F.fraction((point(v)-cut)*1000,p.diameter),0)/width-wu*lv;
    Vd=Math.max(Vd,Math.abs(vd));sides.push({sign,Mu:M(face)*band,Vavg:mean,length:l,Vu:Math.max(...cuts.map(x=>Math.max(Math.abs(shear(x,false)),Math.abs(shear(x,true))))) });
   }
  }
  return {axis,Mu,MuPos,MuNeg,Vu,Vd,Vavg,sides};
 });
 return {axes,load:share*100,Ns,Nu,W,wu,totalS,totalU,bearing,piles};
}
// Gross concrete transformed section only. axis/Mu remain accepted for callers;
// flexural sign and reinforcement do not change this uncracked section model.
function interfaceStress(p,H,joint,values,axis,Vu,Mu){
 const ref=Math.min(...values);let y=0;
 const concrete=values.map((fc,i)=>{const bottom=H-y;y+=p.stages[i].height;return {top:H-y,bottom,ratio:ec(fc)/ec(ref)};});
 const cut=H-joint,A=concrete.reduce((a,c)=>a+c.ratio*1000*(c.bottom-c.top),0);
 const cg=concrete.reduce((a,c)=>a+c.ratio*1000*(c.bottom*c.bottom-c.top*c.top)/2,0)/A;
 const Ig=concrete.reduce((a,c)=>a+c.ratio*1000*((c.bottom-cg)**3-(c.top-cg)**3)/3,0);
 const Qg=Math.abs(concrete.reduce((a,c)=>{const b=Math.min(c.bottom,cut);return b>c.top?a+c.ratio*1000*(cg*(b-c.top)-(b*b-c.top*c.top)/2):a;},0));
 const gross=Math.abs(Vu)*Qg/Ig; // 1 m strip: V*1000 N divided by b=1000 mm
 return {model:'uncracked',gross,tau:gross};
}
function development(p,bar,fy,fc,spacing,available){
 const db=R.BARS[bar].diameter;
 if(spacing<=db||available<=0)return {required:Infinity,available,ok:false};
 const r=Dev.calculate({type:'tension',bar,fy,fck:fc,lambda:1,top:false,epoxy:false,cover:p.cover,clear:spacing-db,ties:false});
 return {required:r.required,available,ok:available+1e-8>=r.required&&r.detailingOK};
}
function jointCheck(p,H,j,joint,values,axes){
 const fc=Math.min(...values),mu=p.surface==='rough'?1:.6,phi=.75;
 const stresses=axes.map(a=>({...interfaceStress(p,H,joint,values,a.axis,a.Vavg??a.Vu,0),axis:a.axis,V:a.Vavg??a.Vu,source:a.Vavg==null?'input':'distance-average'}));
 const tau=Math.max(...stresses.map(a=>a.tau));
 const cap=phi*(p.surface==='rough'?Math.min(.2*fc,3.3+.08*fc,11):Math.min(.2*fc,5.5));
 const lowerFc=Math.min(...values.slice(0,j+1)),upperFc=Math.min(...values.slice(j+1));
 const lower=development(p,p.crossBar,p.fyt,lowerFc,Math.min(p.crossSX,p.crossSY)/Math.max(1,p.crossLegs),joint-p.cover);
 const upper=development(p,p.crossBar,p.fyt,upperFc,Math.min(p.crossSX,p.crossSY)/Math.max(1,p.crossLegs),H-joint-p.cover);
 const area=p.crossLegs*R.BARS[p.crossBar].area*1e6/(p.crossSX*p.crossSY);
 const existingArea=lower.ok&&upper.ok?area:0,existing=phi*mu*existingArea*p.fyt/1e6;
 // User supplies a lower bound valid over every checked region and phase.
 // Pu/A is not permanent normal pressure and is never substituted here.
 const compressionStress=p.compressionMode==='manual'?p.compression/1000:0;
 const compressionCapacity=phi*mu*compressionStress;
 const required=Math.max(0,(tau-existing-compressionCapacity)*1e6/(phi*mu*p.fyd));
 let proposal=null;
 if(required>1e-8&&tau<=cap+1e-8){
  for(let spacing=600;spacing>=100;spacing-=10){
   const provided=R.BARS[p.dowel].area*1e6/(spacing*spacing);
   const lo=development(p,p.dowel,p.fyd,values[j],spacing,p.stages[j].height-p.cover),up=development(p,p.dowel,p.fyd,values[j+1],spacing,p.stages[j+1].height-p.cover);
   if(provided>=required-1e-8&&lo.ok&&up.ok){proposal={spacing,provided,lo,up,length:Math.ceil((lo.required+up.required)/10)*10,capacity:Math.min(cap,existing+compressionCapacity+phi*mu*provided*p.fyd/1e6)};break;}
  }
 }
 const lowerD=development(p,p.dowel,p.fyd,values[j],600,p.stages[j].height-p.cover),upperD=development(p,p.dowel,p.fyd,values[j+1],600,p.stages[j+1].height-p.cover);
 const status=tau>cap+1e-8?'cap':required<=1e-8?'existing':proposal?'proposed':!lowerD.ok||!upperD.ok?'anchorage':'spacing';
 return {index:j,joint,fc,mu,tau,stresses,cap,area,existingArea,existing,compressionStress,compressionCapacity,lower,upper,required,proposal,lowerD,upperD,status,
  ok:status==='existing'||status==='proposed'};
}
function phase(p,g,k,wet,strengths){
 const active=wet?k-1:k,H=p.stages.slice(0,active).reduce((a,s)=>a+s.height,0),loaded=p.stages.slice(0,k).reduce((a,s)=>a+s.height,0);
 const out={stage:k,wet,active,H,loaded,interfaces:[],status:'missing'};
 if(!active)return {...out,status:'fresh',message:p.mode==='soil'?'굳은 단면 없음 · 지반·거푸집의 타설 지지 검토 필요':'굳은 단면 없음 · 거푸집·동바리의 타설 지지 검토 필요'};
 try{
  const values=(strengths[active]||[]).slice(0,active);if(values.length!==active||values.some(fc=>!Number.isFinite(fc)||fc<21||fc>90))throw Error('각 타설층의 내력 적용 강도 21~90 MPa가 필요합니다.');
  const fc=Math.min(...values),f=forces(p,g,k,wet,H,loaded);
  const checks=f.axes.map(a=>{
   const st=steel(p,H,a.axis),c=S.capacity({h:H,fck:fc,fy:p.fy},st.d,st.As),reverseMissing=(a.Mu< -1e-8||a.MuNeg< -1e-8)&&!st.hasTop;
   const phiVc=.75*Math.min(Math.sqrt(fc),8.4)*st.d/6,Vu=a.Vd===null?a.Vu:a.Vd;
   const steelOK=st.As>=S.minimumRatio(p.fy)*1000*H&&p.spacing<=Math.min(3*H,450);
   return {...a,d:st.d,As:st.As,phiMn:c.phiMn,phiVc,shearVu:Vu,steelOK,flexOK:!reverseMissing&&Math.abs(a.Mu)<=c.phiMn&&c.ductile,reverseMissing,shearOK:Vu<=phiVc};
  });
  let z=0;for(let j=0;j<active-1;j++){z+=p.stages[j].height;out.interfaces.push(jointCheck(p,H,j,z,values,f.axes));}
  let punching=null;
  if(p.mode!=='mat'){
   const d=Math.min(...checks.map(a=>a.d)),px=p.cx+d,py=p.cy+d;
   if(-px/2000<=g.bounds.left||px/2000>=g.bounds.right||-py/2000<=g.bounds.bottom||py/2000>=g.bounds.top)punching={status:'outside',ok:false};
   else{
    const rho=checks.reduce((a,c)=>a+c.As/(1000*c.d),0)/2,pc=F.punch(fc,d,px,py,rho);
    const Vu=p.mode==='soil'?f.Nu*(1-px*py/(1e6*g.A)):Math.abs(f.piles.reduce((a,v)=>a+v.Ru*Math.min(1,F.fraction(Math.abs(v.x)*1000-px/2,p.diameter)+F.fraction(Math.abs(v.y)*1000-py/2,p.diameter)),0)-f.wu*(g.A-px*py/1e6));
    const Mx=1.2*f.W*Math.abs(g.footingY)/1000,My=1.2*f.W*Math.abs(g.footingX)/1000;
    // 4.11.2 direct punching only. 4.11-17 side-face torsional shear
    // limits are not direct punching caps. 4.11.7 requires its own check.
    const vu=Vu*1000/(pc.b0*d),phiV=.75*pc.vc,hasMoment=Mx>1e-8||My>1e-8;
    punching={status:hasMoment?'eccentric':'checked',Vu,vu,phiV,directOK:vu<=phiV,ok:vu<=phiV&&!hasMoment,Mx,My,px,py,d};
   }
  }
  return {...out,...f,fc,values,checks,punching,status:'calculated',message:f.bearing&&!f.bearing.ok?'허용지지력 초과':checks.some(a=>!a.flexOK||!a.steelOK)?'휨·배근 확인 필요':punching?.status==='eccentric'?'편심모멘트 전달 · KDS 4.11.7 별도 검토 필요':checks.some(a=>!a.shearOK)||punching&&!punching.ok?'기초 수직 전단 확인 필요':out.interfaces.some(j=>!j.ok)?'접합면 보강 조건 미충족':out.interfaces.some(j=>j.status==='proposed')?'추가 다월바 배근안 제안':'계산 항목 충족'};
 }catch(e){return {...out,message:e.message};}
}
// Additional straight dowels only: one bar per grid point, once per interface.
function quantities(p,g,joints,phases){
 const bar=R.BARS[p.dowel],edge=p.cover+bar.diameter/2;
 const rows=joints.map(j=>{
  const row={index:j.index,bar:p.dowel,spacing:j.spacing,status:'blocked',reason:'접합면 검토 조건 미충족 · 산출 보류',count:null,length:null,totalLength:null,kg:null,tonf:null};
  if(j.missing||j.blocked)return row;
  if(!j.additional)return {...row,status:'none',reason:'추가 다월바 불필요',count:0,length:0,totalLength:0,kg:0,tonf:0};
  if(!(j.spacing>0))return row;
  const clearX=g.bx-2*edge,clearY=g.by-2*edge;
  if(clearX<=0||clearY<=0)return {...row,reason:'다월바 피복 확보 불가 · 산출 보류'};
  const nx=Math.max(2,Math.ceil(clearX/j.spacing-1e-10)+1),ny=Math.max(2,Math.ceil(clearY/j.spacing-1e-10)+1);
  const sx=clearX/(nx-1),sy=clearY/(ny-1),s=Math.min(sx,sy);
  if(s-bar.diameter<Math.max(25,bar.diameter))return {...row,reason:'물량 격자의 철근 순간격 부족 · 산출 보류'};
  // Uniform end-to-end grid may be tighter than the proposed maximum spacing.
  // Verify its anchorage at every phase requiring additional steel.
  let lo=0,up=0;
  for(const v of j.all.filter(v=>v.required>1e-8)){
   const ph=phases.find(r=>r.stage===v.stage&&r.wet===v.wet);
   if(!ph?.values)return row;
   const a=development(p,p.dowel,p.fyd,ph.values[j.index],s,p.stages[j.index].height-p.cover);
   const b=development(p,p.dowel,p.fyd,ph.values[j.index+1],s,p.stages[j.index+1].height-p.cover);
   if(!a.ok||!b.ok)return {...row,reason:'물량 격자의 양측 정착 부족 · 산출 보류'};
   lo=Math.max(lo,a.required);up=Math.max(up,b.required);
  }
  // Round each embedded leg up to 10 mm; do not silently exceed lift depth.
  lo=Math.ceil(lo/10-1e-10)*10;up=Math.ceil(up/10-1e-10)*10;
  if(lo>p.stages[j.index].height-p.cover+1e-8||up>p.stages[j.index+1].height-p.cover+1e-8)return {...row,reason:'10 mm 올림 절단길이의 정착 공간 부족 · 산출 보류'};
  const length=lo+up,count=nx*ny,totalLength=count*length/1000,unitKg=bar.area*.00785,kg=totalLength*unitKg;
  return {...row,status:'ready',reason:'전면 격자 · 직선 다월바',nx,ny,sx,sy,edge,lo,up,count,length,totalLength,unitKg,kg,tonf:kg/1000};
 });
 const complete=rows.every(r=>r.status!=='blocked');
 const total=rows.filter(r=>r.status!=='blocked').reduce((a,r)=>({count:a.count+r.count,totalLength:a.totalLength+r.totalLength,kg:a.kg+r.kg,tonf:a.tonf+r.tonf}),{count:0,totalLength:0,kg:0,tonf:0});
 return {rows,total,complete,area:g.A};
}
function calculate(input){
 const p={...clone(defaults),...input};validate(p);const g=geometry(p);
 const age=p.strengthMode==='estimate'?Age.schedule(p.fck,p.cement,p.temperature,p.stages.map(s=>s.days)):null;
 const strengths=age?age.strengths:p.strengths,phases=[];
 for(let k=1;k<=p.stages.length;k++){phases.push(phase(p,g,k,true,strengths));phases.push(phase(p,g,k,false,strengths));}
 const joints=p.stages.slice(0,-1).map((_,j)=>{
  const all=phases.flatMap(r=>r.interfaces.filter(v=>v.index===j).map(v=>({...v,stage:r.stage,wet:r.wet})));
  const requiredStages=phases.filter(r=>r.active>j+1),missing=requiredStages.some(r=>r.status!=='calculated');
  const governing=all.reduce((a,b)=>!a||b.required>a.required?b:a,null);let blocked=missing||all.some(v=>!v.ok);
  const spacing=all.filter(v=>v.proposal).reduce((s,v)=>Math.min(s,v.proposal.spacing),Infinity);
  // A tighter governing grid can increase ld. Recheck that actual grid at
  // every phase needing added steel, not only the phase governing its area.
  let lo=0,up=0;
  if(Number.isFinite(spacing))for(const v of all.filter(v=>v.required>1e-8)){
   const ph=phases.find(r=>r.stage===v.stage&&r.wet===v.wet);
   const a=development(p,p.dowel,p.fyd,ph.values[j],spacing,p.stages[j].height-p.cover);
   const b=development(p,p.dowel,p.fyd,ph.values[j+1],spacing,p.stages[j+1].height-p.cover);
   lo=Math.max(lo,a.required);up=Math.max(up,b.required);if(!a.ok||!b.ok)blocked=true;
  }
  return {index:j,all,missing,blocked,governing,spacing:Number.isFinite(spacing)?spacing:null,lo,up,additional:all.some(v=>v.required>1e-8)};
 });
 return {p,g,age,phases,joints,quantities:quantities(p,g,joints,phases)};
}
root.FootingJoint={defaults,clone,COLORS,calculate,geometry,forces,interfaceStress,development,jointCheck,quantities};
if(req)module.exports=root.FootingJoint;
})(globalThis);
