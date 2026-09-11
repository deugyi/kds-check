/* KDS 14 31 10, strong-axis bending of welded singly symmetric I-sections.
 * Rectangular flanges, constant web thickness, uniform Fy. mm / MPa / kN / kN.m.
 * RH+T reduction and connection assumptions are documented in docs/steel-rh-tee.md.
 */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const B=node?require('./steel-beam.js'):root.SteelBeam;
const S=node?require('./steel-section.js'):root.SteelSection;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function properties(p){
  for(const k of ['H','bt','tt','bb','tb','tw'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('조립 I형 단면 치수는 양수여야 합니다.');
  const {H,bt,tt,bb,tb,tw}=p,h=H-tt-tb;
  if(h<=0||tw>=Math.min(bt,bb))throw Error('조립 I형 단면의 플랜지·웨브 치수를 확인하세요.');
  const plates=[{b:bt,t:tt,y0:0},{b:tw,t:h,y0:tt},{b:bb,t:tb,y0:H-tb}];
  const A=plates.reduce((s,r)=>s+r.b*r.t,0),y=plates.reduce((s,r)=>s+r.b*r.t*(r.y0+r.t/2),0)/A;
  const Ix=plates.reduce((s,r)=>s+r.b*r.t**3/12+r.b*r.t*(r.y0+r.t/2-y)**2,0);
  const Iy=plates.reduce((s,r)=>s+r.t*r.b**3/12,0);
  let remaining=A/2,pna=0;
  for(const r of plates){if(remaining<=r.b*r.t){pna=r.y0+remaining/r.b;break;}remaining-=r.b*r.t;}
  const integral=(a,b,c)=>b<=c?(c-a)**2/2-(c-b)**2/2:a>=c?(b-c)**2/2-(a-c)**2/2:((c-a)**2+(b-c)**2)/2;
  const Zx=plates.reduce((s,r)=>s+r.b*integral(r.y0,r.y0+r.t,pna),0);
  const It=tt*bt**3/12,Ib=tb*bb**3/12,ho=H-(tt+tb)/2;
  // Thin rectangular plates only: no middle flange or fillet contribution.
  const J=(bt*tt**3+bb*tb**3+(H-(tt+tb)/2)*tw**3)/3;
  const Cw=It*Ib/(It+Ib)*ho**2;
  return {A,y,Ix,Iy,Zx,pna,h,ho,J,Cw,It,Ib,St:Ix/y,Sb:Ix/(H-y),rx:Math.sqrt(Ix/A),ry:Math.sqrt(Iy/A),plates};
}
function direction(p,o,reverse){
  const {H,tw,Fy,E,Lb,Cb}=p;
  const bc=reverse?p.bb:p.bt,tc=reverse?p.tb:p.tt;
  const yc=reverse?H-o.y:o.y,yp=reverse?H-o.pna:o.pna;
  const Sxc=reverse?o.Sb:o.St,Sxt=reverse?o.St:o.Sb;
  const Iyc=reverse?o.Ib:o.It,ratio=Iyc/o.Iy;
  const hc=2*(yc-tc),hp=2*(yp-tc),r=Math.sqrt(E/Fy),lambda=hc/tw,lrw=5.70*r;
  const Mp=Fy*o.Zx/1e6,Myc=Fy*Sxc/1e6,Myt=Fy*Sxt/1e6,My=Math.min(Myc,Myt);
  const symmetric=Math.abs(p.bt-p.bb)<1e-8&&Math.abs(p.tt-p.tb)<1e-8;
  const lpw=symmetric?3.76*r:hp>0?Math.min(lrw,(hc/hp)*r/(.54*Mp/My-.09)**2):lrw;
  const web=lambda<=lpw?'조밀':lambda<=lrw?'비조밀':'세장';
  const aw=hc*tw/(bc*tc),kc=clamp(4/Math.sqrt(o.h/tw),.35,.76);
  const FL=web==='세장'?.7*Fy:Sxt/Sxc>=.7?.7*Fy:Math.max(.5*Fy,Fy*Sxt/Sxc);
  const lf=bc/(2*tc),lpf=.38*r,lrf=.95*Math.sqrt(kc*E/FL);
  const flange=lf<=lpf?'조밀':lf<=lrf?'비조밀':'세장';
  const result={reverse,Sxc,Sxt,hc,hp,lambda,lpw,lrw,web,flange,lf,lpf,lrf,aw,kc,FL,Mp,Myc,Myt,ratio};
  if(hc<=0||ratio<.1||ratio>.9||o.h/tw>=260||aw>10)return {...result,supported:false,message:'압축영역·플랜지 비율·웨브 세장비가 구현 범위를 벗어납니다.'};
  if(symmetric&&web==='조밀'){
    const props={...o,Sx:Sxc,rts:Math.sqrt(Math.sqrt(o.Iy*o.Cw)/Sxc)};
    const cls={web:{ratio:o.h/tw,grade:web},flange:{ratio:lf,lp:lpf,lr:lrf,grade:flange}};
    const m=B.flexure(props,{...p,B:bc,tf:tc,Mu:0},cls);
    return {...result,supported:true,phiMn:m.phiMn,Mn:m.Mn,Lp:m.Lp,Lr:m.Lr,ltb:m.ltb,compression:Mp,local:m.flb??Mp,tension:Mp,governing:m.Mn===m.ltb?'항복·횡비틀림좌굴':'플랜지 국부좌굴',clause:'4.3.2.1.1.2·3'};
  }
  const rt=bc/Math.sqrt(12*(o.ho/H+aw*o.h**2/(6*o.ho*H)));
  const Lp=1.1*rt*r;
  let Lr,compression,ltb,local,tension,Rpc=null,Rpt=null,Rpg=null;
  if(web==='세장'){
    Rpg=Math.min(1,1-aw/(1200+300*aw)*(lambda-lrw));
    if(Rpg<=0)return {...result,supported:false,message:'웨브 휨강도 감소계수 범위 초과'};
    Lr=Math.PI*rt*Math.sqrt(E/(.7*Fy));
    compression=Rpg*Myc;
    const Fltb=Lb<=Lp?Fy:Lb<=Lr?Math.min(Fy,Cb*Fy*(1-.3*(Lb-Lp)/(Lr-Lp))):Math.min(Fy,Cb*Math.PI**2*E/(Lb/rt)**2);
    ltb=Rpg*Fltb*Sxc/1e6;
    const Flocal=flange==='조밀'?Fy:flange==='비조밀'?Fy*(1-.3*(lf-lpf)/(lrf-lpf)):.9*E*kc/lf**2;
    local=Rpg*Flocal*Sxc/1e6;tension=Myt;
  }else{
    const plastic=(Myf)=>{const factor=Math.min(Mp,1.6*Myf)/Myf;return ratio<=.23?1:lambda<=lpw?factor:factor-(factor-1)*(lambda-lpw)/(lrw-lpw);};
    Rpc=plastic(Myc);Rpt=plastic(Myt);compression=Rpc*Myc;tension=Sxt>=Sxc?compression:Rpt*Myt;
    const J=ratio<=.23?0:o.J,q=J/(Sxc*o.ho);
    // Algebraically stable even when the code requires J = 0.
    Lr=1.95*rt*E/FL*Math.sqrt(q+Math.sqrt(q*q+6.76*(FL/E)**2));
    ltb=Lb<=Lp?compression:Lb<=Lr?Math.min(compression,Cb*(compression-(compression-FL*Sxc/1e6)*(Lb-Lp)/(Lr-Lp))):Math.min(compression,Cb*Math.PI**2*E/(Lb/rt)**2*Math.sqrt(1+.078*q*(Lb/rt)**2)*Sxc/1e6);
    local=flange==='조밀'?compression:flange==='비조밀'?compression-(compression-FL*Sxc/1e6)*(lf-lpf)/(lrf-lpf):.9*E*kc*Sxc/lf**2/1e6;
  }
  const states=[['압축플랜지 항복',compression],['횡비틀림좌굴',ltb],['압축플랜지 국부좌굴',local],['인장플랜지 항복',tension]];
  states.sort((a,b)=>a[1]-b[1]);const Mn=states[0][1];
  return {...result,supported:Number.isFinite(Mn)&&Mn>0,Mn,phiMn:.9*Mn,Lp,Lr,rt,compression,ltb,local,tension,Rpc,Rpt,Rpg,governing:states[0][0],clause:web==='세장'?'4.3.2.1.1.5':'4.3.2.1.1.4'};
}
function calculate(p){
  for(const k of ['Fy','E','Lb','Cb'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('강도·탄성계수·횡지지 조건을 확인하세요.');
  const props=properties(p),positive=direction(p,props,false),negative=direction(p,props,true);
  const shear=B.shear(props,{...p,rolled:false,Vu:0},{web:{ratio:props.h/p.tw}});
  return {props,positive,negative,shear};
}
root.SteelBuiltupI={properties,direction,calculate};if(node)module.exports=root.SteelBuiltupI;
})(typeof globalThis!=='undefined'?globalThis:this);
