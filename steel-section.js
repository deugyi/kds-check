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
 * 얇은판 합산 (2B·tf³ + (H − tf)tw³)/3 은 용접 조립단면에 그대로 맞는다.
 * 압연형강은 웨브-플랜지 접합부의 필릿이 J를 눈에 띄게 키우므로, 필릿반경 r이
 * 주어지면 표준 보정항 2αD⁴ 를 더한다. D는 필릿부에 내접하는 최대 원의 지름,
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
/* Doubly symmetric H. The rolled fillet is left out of A, I and Z — the KS
 * table's own areas are computed the same way — and enters only through J. */
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
/* KS D 3502:2007 열간 압연 H형강.
 * [용도, H, B, tw, tf, r, J] — J는 규격표의 비틀림상수 (cm⁴).
 * J = 0 은 KS D 3502 표에 없는 호칭이라는 뜻이며, 그 때만 필릿 보정식으로
 * J를 산정하고 화면에 그 사실을 표시한다. 자세한 내용은 docs/steel-beam.md. */
const SECTION_ROWS=[
  ['column',100,100,6,8,10,5.42],
  ['column',125,125,6.5,9,10,8.68],
  ['beam',148,100,6,9,11,7.48],
  ['beam',150,75,5,7,8,2.9],
  ['column',150,150,7,10,11,13.8],
  ['beam',194,150,6,9,13,11],
  ['beam',198,99,4.5,7,11,3.85],
  ['beam',200,100,5.5,8,11,5.89],
  ['column',200,200,8,12,13,30.2],
  ['column',200,204,12,12,13,43.6],
  ['column',208,202,10,16,13,67.2],
  ['beam',244,175,7,11,16,23.2],
  ['column',244,252,11,11,16,44.6],
  ['beam',248,124,5,8,12,6.69],
  ['column',248,249,8,13,16,46.6],
  ['beam',250,125,6,9,12,9.8],
  ['column',250,250,9,14,16,59.1],
  ['column',250,255,14,14,16,87.3],
  ['beam',294,200,8,12,18,36.1],
  ['column',294,302,12,12,18,69.1],
  ['beam',298,149,5.5,8,13,8.79],
  ['beam',298,201,9,14,18,53.6],
  ['column',298,299,9,14,18,71.6],
  ['beam',300,150,6.5,9,13,12.7],
  ['column',300,300,10,15,18,89],
  ['column',300,305,15,15,18,128],
  ['column',304,301,11,15,18,95.1],
  ['column',304,301,11,17,18,0],
  ['column',310,305,15,17,18,160],
  ['column',310,305,15,20,18,0],
  ['column',310,310,20,20,18,293],
  ['beam',336,249,8,12,20,44.9],
  ['column',338,351,13,13,20,101],
  ['beam',340,250,9,14,20,66.4],
  ['beam',343,299,10,15,24,0],
  ['column',344,348,10,16,20,121],
  ['column',344,354,16,16,20,180],
  ['beam',346,174,6,9,14,13.7],
  ['beam',350,175,7,11,14,23],
  ['column',350,350,12,19,20,200],
  ['column',350,357,19,19,20,294],
  ['beam',354,176,8,13,14,36.1],
  ['beam',386,299,9,14,22,79.8],
  ['column',388,402,15,15,22,174],
  ['beam',390,300,10,16,22,113],
  ['column',394,398,11,18,22,193],
  ['column',394,405,18,18,22,290],
  ['beam',396,199,7,11,16,27.1],
  ['beam',398,201,9,14,18,0],
  ['beam',400,200,8,13,16,42.1],
  ['column',400,400,13,21,22,304],
  ['column',400,408,21,21,22,450],
  ['beam',404,201,9,15,16,62.1],
  ['column',406,403,16,24,22,467],
  ['column',414,405,18,28,22,721],
  ['column',428,407,20,35,22,1320],
  ['beam',434,299,10,15,24,105],
  ['beam',440,300,11,18,24,162],
  ['beam',446,199,8,12,18,38.6],
  ['beam',450,200,9,14,18,57.1],
  ['column',458,417,30,50,22,3930],
  ['beam',482,300,11,15,26,122],
  ['beam',488,300,11,18,26,170],
  ['beam',496,199,9,14,20,60.9],
  ['column',498,432,45,70,22,11300],
  ['beam',500,200,10,16,20,85.8],
  ['beam',506,201,11,19,20,0],
  ['beam',582,300,12,17,28,177],
  ['beam',588,300,12,20,28,237],
  ['beam',594,302,14,23,28,355],
  ['beam',596,199,10,15,22,83.3],
  ['beam',597,302,14,23,28,0],
  ['beam',600,200,11,17,22,114],
  ['beam',606,201,12,20,22,166],
  ['beam',612,202,13,23,22,235],
  ['beam',692,300,13,20,28,261],
  ['beam',700,300,13,24,28,375],
  ['beam',708,302,15,28,28,579],
  ['beam',792,300,14,22,28,342],
  ['beam',800,300,14,26,28,477],
  ['beam',808,302,16,30,28,717],
  ['beam',890,299,15,23,28,406],
  ['beam',900,300,16,28,28,628],
  ['beam',912,302,18,34,28,1040],
  ['beam',918,303,19,37,28,0],
];
const SECTIONS=SECTION_ROWS.map(([use,H,B,tw,tf,r,Jt])=>({
  use,H,B,tw,tf,r,name:`H-${H}×${B}×${tw}×${tf}`,
  A:2*B*tf+(H-2*tf)*tw,
  listed:Jt>0,                                   // KS D 3502 표에 실린 호칭인가
  J:Jt>0?Jt*1e4:torsionConstant(H,B,tw,tf,r)}));
const SECTION_BY_NAME=new Map(SECTIONS.map(s=>[s.name,s]));
function findSection(name){return SECTION_BY_NAME.get(name)||null;}
// 용도별 목록. 각각 총춤 순서로 정렬되어 있다.
function sectionList(use){return use?SECTIONS.filter(s=>s.use===use):SECTIONS;}
root.SteelSection={E,STEEL,SECTIONS,findSection,sectionList,yieldStrength,
  filletTorsion,torsionConstant,hProps};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SteelSection;
})(typeof globalThis!=='undefined'?globalThis:this);
