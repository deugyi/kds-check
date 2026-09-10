/* Existing column flexural-buckling equations, separated from presentation.
 * mm, MPa, kN. Slender plates and torsional buckling are outside this model. */
(function(root){
'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./steel-section.js'):root.SteelSection;
function calculate(p){
  for(const k of ['H','B','tw','tf','Fy','E','klx','kly'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('치수·재료 강도·유효좌굴길이는 0보다 큰 숫자로 입력하세요.');
  if(!Number.isFinite(p.Pu)||p.Pu<0)throw Error('소요압축력 Pu는 0 이상의 숫자로 입력하세요.');
  if(p.H<=2*p.tf||p.B<=p.tw)throw Error('높이는 플랜지 두께의 2배, 폭은 웨브 두께보다 커야 합니다.');
  const props=S.hProps(p.H,p.B,p.tw,p.tf,null);
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
  return {props,flange,web,nonslender,axes,governing,phiPn:nonslender?governing.phiPn:null,
    ratio:nonslender?p.Pu/governing.phiPn:null,ok:nonslender&&p.Pu<=governing.phiPn};
}
root.SteelColumn={calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SteelColumn;
})(typeof globalThis!=='undefined'?globalThis:this);
