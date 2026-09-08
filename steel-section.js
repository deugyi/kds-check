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
/* KS 규격 H형강 (KS D 3502). Calc_Sheet.xlsx의 H 탭에서 가져왔다.
 * [용도, H, B, tw, tf, r] — r은 압연 필릿반경이며 표시용으로만 보관한다.
 * hProps는 필릿을 공제하지 않고, 원표의 단면적도 같은 규약으로 적혀 있다. */
const SECTION_ROWS=[
  ['column',100,100,6,8,10],
  ['column',125,125,6.5,9,10],
  ['beam',148,100,6,9,11],
  ['beam',150,75,5,7,8],
  ['column',150,150,7,10,11],
  ['beam',194,150,6,9,13],
  ['beam',198,99,4.5,7,11],
  ['beam',200,100,5.5,8,11],
  ['column',200,200,8,12,13],
  ['column',200,204,12,12,13],
  ['column',208,202,10,16,13],
  ['beam',244,175,7,11,16],
  ['column',244,252,11,11,16],
  ['beam',248,124,5,8,12],
  ['column',248,249,8,13,16],
  ['beam',250,125,6,9,12],
  ['column',250,250,9,14,16],
  ['column',250,255,14,14,16],
  ['beam',294,200,8,12,13],
  ['column',294,302,12,12,18],
  ['beam',298,149,5.5,8,16],
  ['column',298,299,9,14,18],
  ['beam',300,150,6.5,9,13],
  ['column',300,300,10,15,18],
  ['column',300,305,15,15,18],
  ['column',304,301,11,17,18],
  ['column',310,305,15,20,18],
  ['column',310,310,20,20,18],
  ['beam',336,249,8,12,20],
  ['column',338,351,13,13,20],
  ['beam',340,250,9,14,20],
  ['beam',343,299,10,15,24],
  ['column',344,348,10,16,20],
  ['column',344,354,16,16,20],
  ['beam',346,174,6,9,14],
  ['beam',350,175,7,11,14],
  ['column',350,350,12,19,20],
  ['column',350,357,19,19,20],
  ['beam',354,176,8,13,14],
  ['beam',386,299,9,14,22],
  ['column',388,402,15,15,22],
  ['beam',390,300,10,16,22],
  ['column',394,398,11,18,22],
  ['column',394,405,18,18,22],
  ['beam',396,199,7,11,16],
  ['beam',398,201,9,14,18],
  ['beam',400,200,8,13,16],
  ['column',400,400,13,21,22],
  ['column',400,408,21,21,22],
  ['beam',404,201,9,15,16],
  ['column',406,403,16,24,22],
  ['column',414,405,18,28,22],
  ['column',428,407,20,35,22],
  ['beam',440,300,11,18,24],
  ['beam',446,199,8,12,18],
  ['beam',450,200,9,14,18],
  ['column',458,417,30,50,22],
  ['beam',482,300,11,15,26],
  ['beam',488,300,11,18,26],
  ['beam',496,199,9,14,20],
  ['column',498,432,45,70,22],
  ['beam',500,200,10,16,20],
  ['beam',506,201,11,19,20],
  ['beam',582,300,12,17,28],
  ['beam',588,300,12,20,28],
  ['beam',596,199,10,15,22],
  ['beam',597,302,14,23,28],
  ['beam',600,200,11,17,22],
  ['beam',606,201,12,20,22],
  ['beam',612,202,13,23,22],
  ['beam',692,300,13,20,28],
  ['beam',700,300,13,24,28],
  ['beam',708,302,15,28,28],
  ['beam',792,300,14,22,28],
  ['beam',800,300,14,26,28],
  ['beam',808,302,16,30,28],
  ['beam',890,299,15,23,28],
  ['beam',900,300,16,28,28],
  ['beam',912,302,18,34,28],
  ['beam',918,303,19,37,28],
];
const SECTIONS=SECTION_ROWS.map(([use,H,B,tw,tf,r])=>({
  use,H,B,tw,tf,r,name:`H-${H}×${B}×${tw}×${tf}`,
  A:2*B*tf+(H-2*tf)*tw,J:torsionConstant(H,B,tw,tf,r)}));
const SECTION_BY_NAME=new Map(SECTIONS.map(s=>[s.name,s]));
function findSection(name){return SECTION_BY_NAME.get(name)||null;}
// 용도별 목록. 각각 총춤 순서로 정렬되어 있다.
function sectionList(use){return use?SECTIONS.filter(s=>s.use===use):SECTIONS;}
root.SteelSection={E,STEEL,SECTIONS,findSection,sectionList,yieldStrength,
  filletTorsion,torsionConstant,hProps};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SteelSection;
})(typeof globalThis!=='undefined'?globalThis:this);
