const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../steel-section.js');

/* The KS D 3502 list imported from the H tab of Calc_Sheet.xlsx. */
test('the KS section list is complete and free of duplicates',()=>{
  assert.equal(S.SECTIONS.length,80);
  assert.equal(S.sectionList('beam').length,48);
  assert.equal(S.sectionList('column').length,32);
  assert.equal(S.sectionList().length,80);
  assert.equal(new Set(S.SECTIONS.map(s=>s.name)).size,80);
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
