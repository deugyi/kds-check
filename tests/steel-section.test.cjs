const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../steel-section.js');

/* The palette from the H tab of Calc_Sheet.xlsx, merged with the KS D 3502:2007
 * table. 78 designations carry the standard's own J; 7 are not in the table. */
test('the KS section list is complete and free of duplicates',()=>{
  assert.equal(S.SECTIONS.length,85);
  assert.equal(S.sectionList('beam').length,51);
  assert.equal(S.sectionList('column').length,34);
  assert.equal(S.sectionList().length,85);
  assert.equal(new Set(S.SECTIONS.map(s=>s.name)).size,85);
  assert.equal(S.SECTIONS.filter(s=>s.listed).length,78);
  // Every entry carries the four dimensions plus the rolled fillet radius.
  for(const s of S.SECTIONS)
    for(const k of ['H','B','tw','tf','r'])
      assert.ok(Number.isFinite(s[k])&&s[k]>0,`${s.name}의 ${k}`);
});
test('section names are built from the dimensions',()=>{
  for(const s of S.SECTIONS)
    assert.equal(s.name,`H-${s.H}×${s.B}×${s.tw}×${s.tf}`);
  const ref=S.findSection('H-600×200×11×17');
  assert.deepEqual([ref.H,ref.B,ref.tw,ref.tf],[600,200,11,17]);
  assert.equal(ref.use,'beam');
  assert.equal(S.findSection('H-1×1×1×1'),null);
});
/* The tabulated area matches the fillet-free formula exactly, so the imported
 * list agrees with hProps rather than contradicting it. */
test('the tabulated area matches hProps, which ignores the fillet',()=>{
  for(const s of S.SECTIONS){
    const p=S.hProps(s.H,s.B,s.tw,s.tf,null);
    assert.ok(Math.abs(p.A-s.A)<1e-9,`${s.name}: ${p.A} != ${s.A}`);
    assert.equal(s.A,2*s.B*s.tf+(s.H-2*s.tf)*s.tw);
  }
});
/* J is the one property the fillet enters. The KS H tab carries no J column,
 * so it is computed with the standard rolled-fillet correction. */
test('the fillet raises J and only J',()=>{
  const [H,B,tw,tf,r]=[400,400,13,21,22];
  const thin=(2*B*Math.pow(tf,3)+(H-tf)*Math.pow(tw,3))/3;
  assert.ok(Math.abs(S.torsionConstant(H,B,tw,tf,0)-thin)<1e-9);
  assert.equal(S.filletTorsion(tw,tf,0),0);
  assert.equal(S.filletTorsion(tw,tf,NaN),0);
  const withFillet=S.torsionConstant(H,B,tw,tf,r);
  assert.ok(withFillet>thin);
  assert.ok(Math.abs(withFillet-thin-S.filletTorsion(tw,tf,r))<1e-9);
  // Every other property is untouched by r.
  const a=S.hProps(H,B,tw,tf,null,0),b=S.hProps(H,B,tw,tf,null,r);
  for(const k of ['A','Ix','Sx','Zx','Iy','rx','ry','ho','Cw','rts','hw','Zy'])
    assert.equal(a[k],b[k],k);
  assert.ok(b.J>a.J);
  // A supplied J overrides the fillet calculation.
  assert.equal(S.hProps(H,B,tw,tf,1.23e6,r).J,1.23e6);
});
/* J is read straight from KS D 3502:2007 rather than computed. Spot values are
 * transcribed from the standard's table in cm^4. */
test('listed sections carry the KS D 3502 tabulated J exactly',()=>{
  const table={'H-400×400×13×21':304,'H-600×200×11×17':114,'H-300×300×10×15':89,
    'H-900×300×16×28':628,'H-200×100×5.5×8':5.89,'H-100×100×6×8':5.42,
    'H-498×432×45×70':11300,'H-294×200×8×12':36.1,'H-350×350×12×19':200};
  for(const [name,J] of Object.entries(table)){
    const s=S.findSection(name);
    assert.equal(s.listed,true,name);
    assert.equal(s.J,J*1e4,name);
  }
  // The fillet correction is only a fallback, and it is never silently exact.
  for(const s of S.SECTIONS)
    if(s.listed)assert.notEqual(s.J,S.torsionConstant(s.H,s.B,s.tw,s.tf,s.r));
    else assert.equal(s.J,S.torsionConstant(s.H,s.B,s.tw,s.tf,s.r));
});
test('the seven designations outside KS D 3502 are flagged, not guessed',()=>{
  const outside=S.SECTIONS.filter(s=>!s.listed).map(s=>s.name);
  assert.deepEqual(outside.sort(),['H-304×301×11×17','H-310×305×15×20',
    'H-343×299×10×15','H-398×201×9×14','H-506×201×11×19','H-597×302×14×23',
    'H-918×303×19×37'].sort());
  // Each has a near neighbour that IS in the table, which is why they stay visible.
  for(const s of S.SECTIONS.filter(x=>!x.listed))
    assert.ok(s.J>0&&Number.isFinite(s.J),s.name);
});
/* The tabulated r is what makes the standard's own area come out right:
 * A_table = 2 B tf + (H - 2 tf) tw + 4 r^2 (1 - pi/4). Checking it here pins
 * every r in the list against an independent number from the same table. */
test('the tabulated fillet radius reproduces the KS areas',()=>{
  const areas={'H-600×200×11×17':134.4,'H-400×400×13×21':218.7,'H-294×200×8×12':72.38,
    'H-298×149×5.5×8':40.80,'H-346×174×6×9':52.68,'H-900×300×16×28':309.8};
  for(const [name,A] of Object.entries(areas)){
    const s=S.findSection(name);
    const full=(s.A+4*s.r*s.r*(1-Math.PI/4))/100;
    assert.ok(Math.abs(full-A)/A<.004,`${name}: ${full.toFixed(2)} vs ${A}`);
    // Our own A deliberately excludes the fillets, so it is the smaller number.
    assert.ok(s.A/100<A);
  }
});
test('the list is ordered by depth and geometrically sane',()=>{
  for(let i=1;i<S.SECTIONS.length;i++)
    assert.ok(S.SECTIONS[i].H>=S.SECTIONS[i-1].H,'춤 순서');
  for(const s of S.SECTIONS){
    assert.ok(2*s.tf<s.H,`${s.name}: 플랜지가 총춤의 절반 이상`);
    assert.ok(s.tw<=s.tf,`${s.name}: 웨브가 플랜지보다 두꺼움`);
    assert.ok(s.tw<s.B,`${s.name}`);
  }
});
test('every listed section works through the beam engine',()=>{
  const B=require('../steel-beam.js');
  let compact=0;
  for(const s of S.SECTIONS){
    const o=B.calculate({H:s.H,B:s.B,tw:s.tw,tf:s.tf,Fy:325,E:210000,
      rolled:true,J:null,Lb:3000,Cb:1.0,Mu:0,Vu:0});
    if(o.supported){compact++;assert.ok(o.flexure.phiMn>0);}
    else assert.match(o.message,/조밀단면이 아닙니다/);
  }
  // Rolled KS shapes are compact-webbed at this grade; none should be rejected.
  assert.equal(compact,S.SECTIONS.length);
});
