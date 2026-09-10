/* Existing column flexural-buckling equations, separated from presentation.
 * mm, MPa, kN. Slender plates and torsional buckling are outside this model. */
(function(root){
'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./steel-section.js'):root.SteelSection;
const B=typeof module!=='undefined'&&module.exports?require('./steel-beam.js'):root.SteelBeam;
function interaction(Pu,Pr,Mux,Mrx,Muy,Mry){
  const axial=Pu/Pr,x=Math.abs(Mux)/Mrx,y=Math.abs(Muy)/Mry;
  const high=axial>=.2,value=high?axial+8/9*(x+y):axial/2+x+y;
  return {axial,x,y,value,high,limit:Math.max(0,high?(1-axial)*9/8:1-axial/2),
    ok:axial<=1&&x<=1&&y<=1&&value<=1,clause:high?'4.4-1':'4.4-2'};
}
function weakFlexure(p,s){
  const Sy=2*s.Iy/p.B,lambda=p.B/(2*p.tf),lp=.38*Math.sqrt(p.E/p.Fy),lr=Math.sqrt(p.E/p.Fy);
  const Mp=Math.min(p.Fy*s.Zy,1.6*p.Fy*Sy)/1e6;
  const grade=lambda<=lp?'조밀':lambda<=lr?'비조밀':'세장';
  const Mn=grade==='조밀'?Mp:grade==='비조밀'?Mp-(Mp-.7*p.Fy*Sy/1e6)*(lambda-lp)/(lr-lp):Math.min(Mp,.69*p.E/lambda**2*Sy/1e6);
  return {Sy,Zy:s.Zy,lambda,lp,lr,Mp,Mn,phiMn:.9*Mn,grade,clause:grade==='조밀'?'4.3-37':grade==='비조밀'?'4.3-38':'4.3-39/40'};
}
function calculate(p){
  p={Mux:0,Muy:0,Lb:p.kly,Cb:1,rolled:true,...p};
  for(const k of ['H','B','tw','tf','Fy','E','klx','kly'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('치수·재료 강도·유효좌굴길이는 0보다 큰 숫자로 입력하세요.');
  if(!Number.isFinite(p.Pu)||p.Pu<0)throw Error('소요압축력 Pu는 0 이상의 숫자로 입력하세요.');
  if(p.H<=2*p.tf||p.B<=p.tw)throw Error('높이는 플랜지 두께의 2배, 폭은 웨브 두께보다 커야 합니다.');
  if(!Number.isFinite(p.Mux)||!Number.isFinite(p.Muy))throw Error('강축·약축 모멘트를 숫자로 입력하세요.');
  if(!Number.isFinite(p.Lb)||p.Lb<=0||!Number.isFinite(p.Cb)||p.Cb<=0)throw Error('횡비지지길이 Lb와 Cb는 0보다 커야 합니다.');
  const props=S.hProps(p.H,p.B,p.tw,p.tf,p.J,p.r);
  const flange={ratio:p.B/(2*p.tf),limit:.56*Math.sqrt(p.E/p.Fy)};
  const web={ratio:(p.H-2*p.tf)/p.tw,limit:1.49*Math.sqrt(p.E/p.Fy)};
  const nonslender=flange.ratio<=flange.limit&&web.ratio<=web.limit;
  const axis=(key,length,r)=>{
    const slenderness=length/r,Fe=Math.PI**2*p.E/slenderness**2,limit=4.71*Math.sqrt(p.E/p.Fy);
    const inelastic=slenderness<=limit||p.Fy/Fe<=2.25;
    const Fcr=inelastic?Math.pow(.658,p.Fy/Fe)*p.Fy:.877*Fe;
    return {key,length,r,slenderness,Fe,limit,inelastic,Fcr,phiPn:.9*Fcr*props.A/1000};
  };
  const axes=[axis('X',p.klx,props.rx),axis('Y',p.kly,props.ry)];
  const governing=axes[0].slenderness>=axes[1].slenderness?axes[0]:axes[1];
  const cls=B.classify(props,p),strong=cls.web.grade==='조밀'?B.flexure(props,{...p,Mu:Math.abs(p.Mux)},cls):null;
  const weak=weakFlexure(p,props),Iyc=p.tf*p.B**3/12,flangeInertiaRatio=Iyc/props.Iy;
  const supported=p.rolled&&nonslender&&!!strong&&flangeInertiaRatio>=.1&&flangeInertiaRatio<=.9;
  const combined=supported?interaction(p.Pu,governing.phiPn,p.Mux,strong.phiMn,p.Muy,weak.phiMn):null;
  const reason=!p.rolled?'용접 조립단면의 판요소 분류 별도 검토':!nonslender?'압축 세장판 단면의 강도 별도 검토':!strong?'강축 비조밀·세장 웨브의 휨강도 별도 검토':!supported?'Iyc/Iy 적용 범위(0.1–0.9) 밖':'2축대칭 압연 H형강 · 2차 효과 반영 설계력 입력 조건';
  return {props,flange,web,nonslender,axes,governing,phiPn:nonslender?governing.phiPn:null,
    ratio:nonslender?p.Pu/governing.phiPn:null,ok:nonslender&&p.Pu<=governing.phiPn,
    flexure:{strong,weak,cls},combined,supported,reason,flangeInertiaRatio};
}
root.SteelColumn={calculate,weakFlexure,interaction};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SteelColumn;
})(typeof globalThis!=='undefined'?globalThis:this);
