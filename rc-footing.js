/* Rectangular, centred isolated footings. mm / MPa; external kN / kN.m.
 * See docs/rc-footing.md for the deliberately bounded calculation model. */
(function(root){
'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const S=typeof module!=='undefined'&&module.exports?require('./rc-slab-uplift.js'):root.RCSlabUplift;
const T=typeof module!=='undefined'&&module.exports?require('./rc-footing-shear.js'):root.RCFootingShear;
const defaults={shearBar:'D13',fyt:400,mode:'soil',fck:30,fy:400,bx:3000,by:3000,h:700,cx:600,cy:600,cover:80,barX:'D22',barY:'D22',spacingX:150,spacingY:150,Ns:1500,Mxs:0,Mys:0,Nu:2100,Mxu:0,Myu:0,weightFactor:1.2,qa:200,nx:2,ny:2,sx:1800,sy:1800,diameter:500,pileAllow:800};
const clamp=x=>Math.max(0,Math.min(1,x));
function fraction(distance,diameter){return clamp(.5+distance/diameter);}
function punch(fck,d,bx,by,rho){
 const b0=2*(bx+by),ks=Math.max(.75,Math.min(1.1,(300/d)**.25)),kbo=Math.min(1.25,4/Math.sqrt(b0/d));
 rho=Math.max(.005,Math.min(.03,rho));
 const fte=.2*Math.sqrt(fck),cu=d*(25*Math.sqrt(rho/fck)-300*rho/fck),cot=Math.sqrt(fte*(fte+2*fck/3))/fte;
 const vc=Math.min(ks*kbo*fte*cot*cu/d,.58*fck*cu/d);
 return {b0,ks,kbo,rho,cu,vc,phiVc:.75*vc*b0*d/1000};
}
function calculate(input){
 const p={...defaults,...input};
 for(const k of ['fck','fy','bx','by','h','cx','cy','cover','spacingX','spacingY','Ns','Nu','weightFactor'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error(k+' 입력은 0보다 큰 유한한 수여야 합니다.');
 for(const k of ['Mxs','Mys','Mxu','Myu'])if(!Number.isFinite(p[k]))throw Error('모멘트를 숫자로 입력해 주세요.');
 if(!['soil','pile'].includes(p.mode)||!R.BARS[p.barX]||!R.BARS[p.barY]||!R.FY.includes(p.fy)||p.fck<21||p.fck>90)throw Error('재료 또는 기초 형식 입력을 확인하세요.');
 if(p.cx>=p.bx||p.cy>=p.by)throw Error('기둥은 기초보다 작아야 합니다.');
 if(p.bx>30000||p.by>30000||p.h>5000)throw Error('독립기초 지원 범위는 평면 30m, 두께 5m 이하입니다.');
 if(!['D10','D13','D16'].includes(p.shearBar)||![400,500].includes(p.fyt))throw Error('전단철근 규격·강도를 확인하세요.');
 const reserve=R.BARS[p.shearBar].diameter;
 const dx=p.h-p.cover-reserve-R.BARS[p.barX].diameter/2,dy=p.h-p.cover-reserve-R.BARS[p.barX].diameter-R.BARS[p.barY].diameter/2,d=Math.min(dx,dy);
 if(d<=0||p.cover*2+R.BARS[p.barX].diameter+R.BARS[p.barY].diameter>=p.h)throw Error('피복과 철근층을 배치할 두께가 부족합니다.');
 const B=p.bx/1000,L=p.by/1000,A=B*L,W=A*p.h/1000*24,wu=W*p.weightFactor/A;
 const totalS=p.Ns+W,totalU=p.Nu+p.weightFactor*W,notes=[];
 let piles=[],bearing,pressure,pileLayout=null;
 if(p.mode==='soil'){
  if(!(p.qa>0&&Number.isFinite(p.qa)))throw Error('허용지내력은 0보다 커야 합니다.');
  pressure=(x,y,u=false)=>(u?totalU:totalS)/A+(u?p.Myu:p.Mys)*x/(L*B**3/12)+(u?p.Mxu:p.Mxs)*y/(B*L**3/12);
  const qs=[-1,1].flatMap(x=>[-1,1].map(y=>pressure(x*B/2,y*L/2))),qu=[-1,1].flatMap(x=>[-1,1].map(y=>pressure(x*B/2,y*L/2,true)));
  bearing={min:Math.min(...qs),max:Math.max(...qs),limit:p.qa,unit:'kPa'};
  if(Math.min(...qs,...qu)<-1e-8)throw Error('지반 접촉면에 인장이 발생합니다. 전면 접촉 가정 범위를 벗어나므로 부분 접촉 해석이 필요합니다.');
 }else{
  for(const k of ['nx','ny'])if(!Number.isInteger(p[k])||p[k]<2||p[k]>6)throw Error('파일 배치는 각 방향 2~6개로 입력하세요.');
  for(const k of ['sx','sy','diameter','pileAllow'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('파일 간격·직경·허용지지력을 확인하세요.');
  if(p.sx<p.diameter||p.sy<p.diameter)throw Error('파일이 서로 겹칩니다.');
  if((p.nx-1)*p.sx+p.diameter>p.bx-2*p.cover||(p.ny-1)*p.sy+p.diameter>p.by-2*p.cover)throw Error('파일 외면과 기초 가장자리 사이에 입력 피복 이상의 여유가 필요합니다.');
  for(let j=0;j<p.ny;j++)for(let i=0;i<p.nx;i++)piles.push({id:piles.length+1,x:(i-(p.nx-1)/2)*p.sx/1000,y:(j-(p.ny-1)/2)*p.sy/1000});
  const xx=piles.reduce((s,v)=>s+v.x*v.x,0),yy=piles.reduce((s,v)=>s+v.y*v.y,0);
  piles=piles.map(v=>({...v,Rs:totalS/piles.length+p.Mys*v.x/xx+p.Mxs*v.y/yy,Ru:totalU/piles.length+p.Myu*v.x/xx+p.Mxu*v.y/yy}));
  const edgeX=(p.bx-(p.nx-1)*p.sx)/2,edgeY=(p.by-(p.ny-1)*p.sy)/2;
  pileLayout={spacingMin:2.5*p.diameter,edgeMin:1.25*p.diameter,edgeX,edgeY,spacingXOK:p.sx>=2.5*p.diameter,spacingYOK:p.sy>=2.5*p.diameter,edgeXOK:edgeX>=1.25*p.diameter,edgeYOK:edgeY>=1.25*p.diameter,minBx:Math.ceil(((p.nx-1)*Math.max(p.sx,2.5*p.diameter)+2.5*p.diameter)/50)*50,minBy:Math.ceil(((p.ny-1)*Math.max(p.sy,2.5*p.diameter)+2.5*p.diameter)/50)*50};
  pileLayout.ok=pileLayout.spacingXOK&&pileLayout.spacingYOK&&pileLayout.edgeXOK&&pileLayout.edgeYOK;
  bearing={min:Math.min(...piles.map(v=>v.Rs)),max:Math.max(...piles.map(v=>v.Rs)),limit:p.pileAllow,unit:'kN/본'};
  if(piles.some(v=>Math.min(v.Rs,v.Ru)<-1e-8))throw Error('인발 파일이 발생합니다. 압축 파일 전용 모델이며 인발 지지력과 접합부 별도 해석이 필요합니다.');
  notes.push('파일캡의 스트럿-타이, 파일 주변 국부 뚫림·군파일 위험둘레, 파일 두부 정착 및 군효과는 별도 검토가 필요합니다. 파일 기초 전체 적합 판정은 제공하지 않습니다.');
 }
 // Exact integral of net linear soil pressure over rectangular regions.
 function integral(x0,x1,y0,y1){
  const area=(x1-x0)*(y1-y0),ix=(x1*x1-x0*x0)/2*(y1-y0),iy=(y1*y1-y0*y0)/2*(x1-x0);
  return p.Nu/A*area+p.Myu/(L*B**3/12)*ix+p.Mxu/(B*L**3/12)*iy;
 }
 const rows=[];
 for(const axis of ['X','Y']){
  const along=axis==='X'?B:L,width=axis==='X'?L:B,c=(axis==='X'?p.cx:p.cy)/1000,dd=axis==='X'?dx:dy,bar=R.BARS[p['bar'+axis]],spacing=p['spacing'+axis],As=bar.area*1000/spacing;
  const cap=S.capacity(p,dd,As),AsMin=S.minimumRatio(p.fy)*1000*p.h;
  let maxM=0,maxV=0,reverse=false;
  for(const sign of [-1,1]){
   const face=c/2,cut=face+dd/1000,l=Math.max(0,along/2-face),lv=Math.max(0,along/2-cut);
   let M,V;
   if(p.mode==='soil'){
    const q0=p.Nu/A,k=(axis==='X'?p.Myu/(L*B**3/12):p.Mxu/(B*L**3/12))*sign;
    M=width*(q0*l*l/2+k*(l**3/3+face*l*l/2));
    V=width*(q0*lv+k*((along/2)**2-Math.min(cut,along/2)**2)/2);
   }else{
    M=piles.reduce((s,v)=>s+v.Ru*Math.max(0,sign*(axis==='X'?v.x:v.y)-face),0)-wu*width*l*l/2;
    V=piles.reduce((s,v)=>s+v.Ru*fraction((sign*(axis==='X'?v.x:v.y)-cut)*1000,p.diameter),0)-wu*width*lv;
   }
   if(M < -1e-8)reverse=true;
   maxM=Math.max(maxM,Math.abs(M));maxV=Math.max(maxV,Math.abs(V));
  }
  // Uniform short-direction reinforcement also meets the central-band allocation.
  const beta=Math.max(B,L)/Math.min(B,L),band=along<width?2*beta/(beta+1):1;
  const Mu=maxM/width*band,phiVc=.75*Math.min(Math.sqrt(p.fck),8.4)*width*dd/6;
  rows.push({axis,d:dd,As,AsMin,bar:p['bar'+axis],spacing,band,Mu,phiMn:cap.phiMn,Vu:maxV,phiVc,ductile:cap.ductile,steelOK:As>=AsMin&&spacing<=Math.min(2*p.h,300)&&spacing-bar.diameter>=Math.max(25,bar.diameter),reverse,flexOK:Mu<=cap.phiMn&&cap.ductile&&!reverse,shearOK:maxV<=phiVc});
 }
 if(rows.some(v=>v.reverse))notes.push('반대 부호 휨이 발생하여 상부 철근 검토가 필요합니다. 하부 철근만으로 충족 판정하지 않습니다.');
 const px=p.cx+d,py=p.cy+d;
 if(px>=p.bx||py>=p.by)throw Error('기둥면 d/2 위험둘레가 기초 밖으로 나갑니다. 가장자리 위험둘레 해석이 필요합니다.');
 let Vu;
 if(p.mode==='soil')Vu=p.Nu-integral(-px/2000,px/2000,-py/2000,py/2000);
 else Vu=piles.reduce((s,v)=>s+v.Ru*Math.min(1,fraction(Math.abs(v.x)*1000-px/2,p.diameter)+fraction(Math.abs(v.y)*1000-py/2,p.diameter)),0)-wu*(A-px*py/1e6);
 Vu=Math.abs(Vu);
 const rho=(rows[0].As/(1000*dx)+rows[1].As/(1000*dy))/2,pc=punch(p.fck,d,px,py,rho);
 const jx=d*(px*py*py/2+py**3/6),jy=d*(py*px*px/2+px**3/6);
 const vu=Vu*1000/(pc.b0*d)+Math.abs(p.Mxu)*1e6*py/2/jx+Math.abs(p.Myu)*1e6*px/2/jy;
 const phiV=.75*Math.min(pc.vc,.63*Math.sqrt(p.fck),.25*p.fck);
 const punching={...pc,px,py,d,Vu,vu,phiV,ratio:vu/phiV,ok:vu<=phiV,hasMoment:!!(p.Mxu||p.Myu)};
 notes.push('중앙 기둥·일정 두께·보통중량 콘크리트·기초입니다. 전단철근 외면까지 피복을 적용하고, 보강이 불필요해도 선택 전단철근 직경만큼 유효깊이를 보수적으로 확보합니다. 철근은 하부 X층, 그 위 Y층으로 전체 폭에 균등 배치합니다.');
 notes.push('정착길이·기둥 지압 및 다월·침하·활동·전체 안정은 별도 검토입니다. 여러 하중조합은 각각 입력하여 검토하세요.');
 if(punching.hasMoment)notes.push('편심 뚫림은 모멘트 전량을 선형 둘레 전단응력으로 부담하는 보수적 예비 검토입니다. KDS 4.11.7의 휨·전단·비틀림 분담 상세 검토를 대체하지 않습니다.');
 const result={p,dx,dy,d,W,totalS,totalU,piles,bearing,pileLayout,rows,punching,notes,depthOK:d>=(p.mode==='soil'?150:300),pressure};
 result.reinforcement=T.design(result,punch);
 return result;
}
root.RCFooting={defaults,fraction,punch,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCFooting;
})(typeof globalThis!=='undefined'?globalThis:this);
