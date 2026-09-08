/* Steel beam flexure and shear, KDS 14 31 10 (4.3).
 * Doubly symmetric H-sections bent about the strong axis, compact web only.
 * Units: mm, MPa; reported strength in kN and kN.m.
 * Clauses and omissions: docs/steel-beam.md.
 */
(function(root){
'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./steel-section.js'):root.SteelSection;
const PHI_B=.90;                       // KDS 14 31 10, 4.3.1(1)
function positive(v,name){if(!Number.isFinite(v)||v<=0)throw Error(`${name}은 0보다 큰 숫자여야 합니다.`);}
function nonnegative(v,name){if(!Number.isFinite(v)||v<0)throw Error(`${name}은 0 이상의 숫자여야 합니다.`);}
function validate(p){
  for(const [k,n] of [['H','총춤 H'],['B','폭 B'],['tw','웨브 두께 tw'],['tf','플랜지 두께 tf'],
    ['Fy','항복강도 Fy'],['E','탄성계수 E'],['Lb','비지지길이 Lb'],['Cb','Cb']])positive(p[k],n);
  for(const [k,n] of [['Mu','소요휨모멘트 Mu'],['Vu','소요전단력 Vu']])nonnegative(p[k],n);
  if(2*p.tf>=p.H)throw Error('플랜지 두께가 총춤의 절반 이상입니다.');
  if(p.tw>=p.B)throw Error('웨브 두께가 플랜지 폭 이상입니다.');
  if(p.J!==null&&p.J!==undefined&&p.J!==''&&!(Number.isFinite(p.J)&&p.J>0))
    throw Error('J를 직접 입력할 때는 0보다 큰 숫자여야 합니다.');
}
/* 표 4.3-2 판폭두께비. The rolled fillet is not deducted from the web, which
 * overstates h/tw and is therefore safe. */
function classify(props,p){
  const r=Math.sqrt(p.E/p.Fy);
  const flangeRatio=p.B/(2*p.tf),lpf=.38*r,lrf=1.00*r;
  const h=p.H-2*p.tf,webRatio=h/p.tw,lpw=3.76*r,lrw=5.70*r;
  const grade=(v,lp,lr)=>v<=lp?'조밀':v<=lr?'비조밀':'세장';
  return {h,flange:{ratio:flangeRatio,lp:lpf,lr:lrf,grade:grade(flangeRatio,lpf,lrf)},
    web:{ratio:webRatio,lp:lpw,lr:lrw,grade:grade(webRatio,lpw,lrw)}};
}
/* 4.3.2.1.1.2 횡비틀림좌굴 and 4.3.2.1.1.3 압축플랜지 국부좌굴. */
function flexure(props,p,cls){
  const Mp=p.Fy*props.Zx/1e6,Msr=.7*p.Fy*props.Sx/1e6,c=1.0;
  const Lp=1.76*props.ry*Math.sqrt(p.E/p.Fy);
  const q=props.J*c/(props.Sx*props.ho);
  const Lr=1.95*props.rts*(p.E/(.7*p.Fy))*Math.sqrt(q)*
    Math.sqrt(1+Math.sqrt(1+6.76*Math.pow(.7*p.Fy/p.E/q,2)));
  let ltb,mode,Fcr=null;
  if(p.Lb<=Lp){ltb=Mp;mode='Lb ≤ Lp — 횡비틀림좌굴 미고려 (4.3.2.1.1.2(2)①)';}
  else if(p.Lb<=Lr){
    ltb=Math.min(Mp,p.Cb*(Mp-(Mp-Msr)*(p.Lb-Lp)/(Lr-Lp)));
    mode='Lp < Lb ≤ Lr — 식 (4.3-3)';
  }else{
    const s=p.Lb/props.rts;
    Fcr=p.Cb*Math.PI*Math.PI*p.E/(s*s)*Math.sqrt(1+.078*q*s*s);
    ltb=Math.min(Mp,Fcr*props.Sx/1e6);
    mode='Lb > Lr — 식 (4.3-4)(4.3-5)';
  }
  let flb=null,kc=null,flbMode=null;
  if(cls.flange.grade!=='조밀'){
    if(cls.flange.grade==='비조밀'){
      flb=Mp-(Mp-Msr)*(cls.flange.ratio-cls.flange.lp)/(cls.flange.lr-cls.flange.lp);
      flbMode='비조밀 플랜지 — 식 (4.3-9)';
    }else{
      kc=Math.min(.76,Math.max(.35,4/Math.sqrt(cls.web.ratio)));
      flb=.9*p.E*kc*props.Sx/(cls.flange.ratio*cls.flange.ratio)/1e6;
      flbMode='세장 플랜지 — 식 (4.3-10)';
    }
  }
  const Mn=flb===null?ltb:Math.min(ltb,flb);
  return {Mp,Msr,Lp,Lr,q,Fcr,ltb,mode,flb,kc,flbMode,Mn,phi:PHI_B,phiMn:PHI_B*Mn,
    ratio:Mn>0?p.Mu/(PHI_B*Mn):Infinity,ok:p.Mu<=PHI_B*Mn+1e-9};
}
/* 4.3.2.1.2.2 전단. Rolled sections with a stocky web get phi_v = 1.0. */
function shear(props,p,cls){
  const Aw=p.H*p.tw,r=Math.sqrt(p.E/p.Fy),stocky=2.24*r,kv=5;
  let phi=.90,Cv,mode;
  if(p.rolled&&cls.web.ratio<=stocky){
    phi=1.00;Cv=1.0;mode='압연 H형강이고 h/tw ≤ 2.24√(E/Fy) — φv = 1.0, Cv = 1.0 (4.3.2.1.2.2(1)가)';
  }else{
    const a1=1.10*Math.sqrt(kv*p.E/p.Fy),a2=1.37*Math.sqrt(kv*p.E/p.Fy);
    if(cls.web.ratio<=a1){Cv=1.0;mode='식 (4.3-86) Cv = 1.0';}
    else if(cls.web.ratio<=a2){Cv=a1/cls.web.ratio;mode='식 (4.3-87) Cv = 1.10√(kvE/Fy)/(h/tw)';}
    else{Cv=1.51*p.E*kv/(cls.web.ratio*cls.web.ratio*p.Fy);mode='식 (4.3-88) Cv = 1.51Ekv/((h/tw)²Fy)';}
    mode+=' , φv = 0.90 (4.3.2.1.2.2(1)나)';
  }
  const Vn=.6*p.Fy*Aw*Cv/1000,stiffener=2.46*r;
  return {Aw,kv,Cv,phi,mode,stocky,Vn,phiMn:null,phiVn:phi*Vn,stiffenerLimit:stiffener,
    needsStiffener:cls.web.ratio>stiffener,
    ratio:Vn>0?p.Vu/(phi*Vn):Infinity,ok:p.Vu<=phi*Vn+1e-9};
}
function calculate(p){
  validate(p);
  const props=S.hProps(p.H,p.B,p.tw,p.tf,p.J,p.r);
  const cls=classify(props,p);
  const notes=[];
  const manualJ=Number.isFinite(p.J)&&p.J>0;
  if(p.rolled&&!manualJ&&!(Number.isFinite(p.r)&&p.r>0))
    notes.push('압연형강인데 필릿반경 r을 모르므로 J를 얇은판 합산으로만 산정했습니다. 규격표값보다 작게(안전측) 나옵니다.');
  if(cls.web.grade!=='조밀')
    return {props,cls,notes,supported:false,
      message:'웨브가 조밀단면이 아닙니다. 비조밀·세장 웨브는 4.3.2.1.1.4/5의 대상이며 이 화면에서 다루지 않습니다.'};
  const M=flexure(props,p,cls),V=shear(props,p,cls);
  return {props,cls,notes,supported:true,message:'',flexure:M,shear:V,ok:M.ok&&V.ok};
}
root.SteelBeam={PHI_B,classify,flexure,shear,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SteelBeam;
})(typeof globalThis!=='undefined'?globalThis:this);
