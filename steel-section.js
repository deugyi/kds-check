/* Shared steel material table and doubly symmetric H-section properties.
 * KDS 14 31 05 표 3.4-1 (판두께별 Fy) and 표 3.5-1 (E).
 */
(function(root){
'use strict';
const E=210000;
const STEEL={
  SS235:{Fu:330,t:[[16,235],[40,225],[75,205],[100,205],[1e9,195]]},
  SS275:{Fu:410,t:[[16,275],[40,265],[75,245],[100,245],[1e9,235]]},
  SM275:{Fu:410,t:[[16,275],[40,265],[75,255],[100,245],[1e9,235]]},
  SS315:{Fu:490,t:[[16,315],[40,305],[75,295],[100,295],[1e9,275]]},
  SM355:{Fu:490,t:[[16,355],[40,345],[75,335],[100,325],[1e9,305]]},
  SM420:{Fu:520,t:[[16,420],[40,410],[75,400],[100,390],[1e9,380]]},
  SM460:{Fu:570,t:[[16,460],[40,450],[75,430],[100,420],[1e9,420]]},
  SN275:{Fu:410,t:[[40,275],[100,255],[1e9,255]]},
  SN355:{Fu:490,t:[[40,355],[100,335],[1e9,335]]},
  SN460:{Fu:570,t:[[40,460],[100,440],[1e9,440]]},
  SHN275:{Fu:410,t:[[1e9,275]]},
  SHN355:{Fu:490,t:[[1e9,355]]},
  SHN420:{Fu:520,t:[[1e9,420]]},
  SHN460:{Fu:570,t:[[1e9,460]]},
  'SM275-TMC':{Fu:410,t:[[1e9,275]]},
  'SM355-TMC':{Fu:490,t:[[1e9,355]]},
  'SM420-TMC':{Fu:520,t:[[1e9,420]]},
  'SM460-TMC':{Fu:570,t:[[1e9,460]]}
};
// Fy drops with plate thickness, so the flange thickness picks the row.
function yieldStrength(grade,tf){
  const s=STEEL[grade];
  if(!s)return null;
  for(const [limit,Fy] of s.t)if(tf<=limit)return Fy;
  return s.t[s.t.length-1][1];
}
/* 비틀림상수 J.
 * 얇은판 합산 (2B·tf³ + (H − tf)tw³)/3 은 개방 단면의 근사식이다.
 * 아래 필릿 보정은 hProps에 명시적인 J 없이 r만 전달했을 때의 예비 경로이다.
 * 현재 목록 95종에는 기존 표값 또는 얇은판 근사 J가 명시되어 이 경로를 쓰지 않는다.
 * 예비 경로에서는 보정항 2αD⁴를 더한다. D는 필릿부에 내접하는 최대 원의 지름,
 * α는 그 원의 기여를 맞춘 계수이다 (CISC, Torsional Section Properties of
 * Steel Shapes, 2002 — AISC 형강표의 J도 같은 식으로 산정한다).
 * 규격표 J를 알고 있으면 Jman으로 덮어쓸 수 있다. */
function filletTorsion(tw,tf,r){
  if(!Number.isFinite(r)||r<=0)return 0;
  const D=(Math.pow(tf+r,2)+tw*(r+tw/4))/(2*r+tf);
  const a=-.042+.2204*(tw/tf)+.1355*(r/tf)-.0865*(tw*r/(tf*tf))-.0725*(tw*tw/(tf*tf));
  return 2*a*Math.pow(D,4);
}
function torsionConstant(H,Bf,tw,tf,r){
  return (2*Bf*Math.pow(tf,3)+(H-tf)*Math.pow(tw,3))/3+filletTorsion(tw,tf,r);
}
/* Doubly symmetric H: A, I and Z intentionally omit fillets in this engine.
 * They are calculated properties, not the published KS reference values. */
function hProps(H,Bf,tw,tf,Jman,r){
  const hw=H-2*tf,A=2*Bf*tf+hw*tw;
  const Ix=(Bf*Math.pow(H,3)-(Bf-tw)*Math.pow(hw,3))/12,Sx=2*Ix/H;
  const Zx=Bf*tf*(H-tf)+tw*hw*hw/4;
  const Iy=2*tf*Math.pow(Bf,3)/12+hw*Math.pow(tw,3)/12;
  const ho=H-tf,Cw=Iy*ho*ho/4;
  let J=torsionConstant(H,Bf,tw,tf,r);
  if(Number.isFinite(Jman)&&Jman>0)J=Jman;
  return {A,Ix,Sx,Zx,Iy,rx:Math.sqrt(Ix/A),ry:Math.sqrt(Iy/A),ho,Cw,J,
    rts:Math.sqrt(Math.sqrt(Iy*Cw)/Sx),hw,Zy:tf*Bf*Bf/2+hw*tw*tw/4};
}
/* The active designation/dimension catalog is KS D 3502:2022 supplementary table 9.
 * Legacy J values are retained only for identical H/B/tw/tf/r (74 rows).
 * Remaining 21 rows explicitly use the thin-wall approximation, not a KS J value.
 * [H, B, tw, tf, r, J(cm⁴)] from the previously verified 2007-based table. */
const LEGACY_J_ROWS=[
 [100,100,6,8,10,5.42],
 [125,125,6.5,9,10,8.68],
 [148,100,6,9,11,7.48],
 [150,75,5,7,8,2.9],
 [150,150,7,10,11,13.8],
 [194,150,6,9,13,11],
 [198,99,4.5,7,11,3.85],
 [200,100,5.5,8,11,5.89],
 [200,200,8,12,13,30.2],
 [200,204,12,12,13,43.6],
 [208,202,10,16,13,67.2],
 [244,175,7,11,16,23.2],
 [244,252,11,11,16,44.6],
 [248,124,5,8,12,6.69],
 [248,249,8,13,16,46.6],
 [250,125,6,9,12,9.8],
 [250,250,9,14,16,59.1],
 [250,255,14,14,16,87.3],
 [294,200,8,12,18,36.1],
 [294,302,12,12,18,69.1],
 [298,149,5.5,8,13,8.79],
 [298,201,9,14,18,53.6],
 [298,299,9,14,18,71.6],
 [300,150,6.5,9,13,12.7],
 [300,300,10,15,18,89],
 [300,305,15,15,18,128],
 [310,310,20,20,18,293],
 [336,249,8,12,20,44.9],
 [338,351,13,13,20,101],
 [340,250,9,14,20,66.4],
 [344,348,10,16,20,121],
 [344,354,16,16,20,180],
 [346,174,6,9,14,13.7],
 [350,175,7,11,14,23],
 [350,350,12,19,20,200],
 [350,357,19,19,20,294],
 [354,176,8,13,14,36.1],
 [388,402,15,15,22,174],
 [390,300,10,16,22,113],
 [394,398,11,18,22,193],
 [394,405,18,18,22,290],
 [396,199,7,11,16,27.1],
 [400,200,8,13,16,42.1],
 [400,400,13,21,22,304],
 [400,408,21,21,22,450],
 [406,403,16,24,22,467],
 [414,405,18,28,22,721],
 [428,407,20,35,22,1320],
 [434,299,10,15,24,105],
 [440,300,11,18,24,162],
 [446,199,8,12,18,38.6],
 [450,200,9,14,18,57.1],
 [458,417,30,50,22,3930],
 [482,300,11,15,26,122],
 [488,300,11,18,26,170],
 [496,199,9,14,20,60.9],
 [498,432,45,70,22,11300],
 [500,200,10,16,20,85.8],
 [582,300,12,17,28,177],
 [588,300,12,20,28,237],
 [594,302,14,23,28,355],
 [596,199,10,15,22,83.3],
 [600,200,11,17,22,114],
 [606,201,12,20,22,166],
 [612,202,13,23,22,235],
 [692,300,13,20,28,261],
 [700,300,13,24,28,375],
 [708,302,15,28,28,579],
 [792,300,14,22,28,342],
 [800,300,14,26,28,477],
 [808,302,16,30,28,717],
 [890,299,15,23,28,406],
 [900,300,16,28,28,628],
 [912,302,18,34,28,1040]
];
const spec=typeof module!=='undefined'&&module.exports?require('./steel-spec.js'):root.SteelSpec;
if(!spec?.catalogs?.H)throw Error('KS D 3502:2022 reference catalog must load before steel-section.js');
const sectionKey=s=>[s.H,s.B,s.tw,s.tf,s.r].join('|');
const oldJ=new Map(LEGACY_J_ROWS.map(([H,B,tw,tf,r,J])=>[sectionKey({H,B,tw,tf,r}),J*1e4]));
function thinWallJ(H,B,tw,tf){return (2*B*tf**3+(H-tf)*tw**3)/3;}
const SECTIONS=spec.catalogs.H.map(ref=>{
 const {H,B,tw,tf,r}=ref,key=sectionKey(ref),table=oldJ.has(key);
 return Object.freeze({use:H/B>=.8&&H/B<=1.25?'column':'beam',H,B,tw,tf,r,
  name:`H-${H}×${B}×${tw}×${tf}`,A:2*B*tf+(H-2*tf)*tw,listed:true,
  standard:'KS D 3502:2022',J:table?oldJ.get(key):thinWallJ(H,B,tw,tf),
  JMethod:table?'table':'thin-wall',
  JSource:table?'KS D 3502:2007 기반 단면표 · 동일 치수·r 대조':'J 표값 없음 · 얇은판 합산 (필릿 제외 근사)'});
}).sort((a,b)=>a.H-b.H||a.B-b.B||a.tw-b.tw||a.tf-b.tf);
Object.freeze(SECTIONS);
function sectionSource(s){return `${s.standard} · ${s.name} · ${s.JSource}`;}
const SECTION_BY_NAME=new Map(SECTIONS.map(s=>[s.name,s]));
function findSection(name){return SECTION_BY_NAME.get(name)||null;}
// 용도별 목록. 각각 총춤 순서로 정렬되어 있다.
function sectionList(use){return use?SECTIONS.filter(s=>s.use===use):SECTIONS;}
root.SteelSection={E,STEEL,SECTIONS,findSection,sectionList,yieldStrength,
  filletTorsion,torsionConstant,thinWallJ,sectionSource,hProps};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SteelSection;
})(typeof globalThis!=='undefined'?globalThis:this);
