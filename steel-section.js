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
/* Doubly symmetric H. The rolled fillet is ignored throughout: J comes out
 * smaller and h/tw larger than the mill table, both on the safe side. */
function hProps(H,Bf,tw,tf,Jman){
  const hw=H-2*tf,A=2*Bf*tf+hw*tw;
  const Ix=(Bf*Math.pow(H,3)-(Bf-tw)*Math.pow(hw,3))/12,Sx=2*Ix/H;
  const Zx=Bf*tf*(H-tf)+tw*hw*hw/4;
  const Iy=2*tf*Math.pow(Bf,3)/12+hw*Math.pow(tw,3)/12;
  const ho=H-tf,Cw=Iy*ho*ho/4;
  let J=(2*Bf*Math.pow(tf,3)+(H-tf)*Math.pow(tw,3))/3;
  if(Number.isFinite(Jman)&&Jman>0)J=Jman;
  return {A,Ix,Sx,Zx,Iy,rx:Math.sqrt(Ix/A),ry:Math.sqrt(Iy/A),ho,Cw,J,
    rts:Math.sqrt(Math.sqrt(Iy*Cw)/Sx),hw,Zy:tf*Bf*Bf/2+hw*tw*tw/4};
}
root.SteelSection={E,STEEL,yieldStrength,hProps};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SteelSection;
})(typeof globalThis!=='undefined'?globalThis:this);
