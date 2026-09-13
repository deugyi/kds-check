const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../rebar-spec'),R=require('../rc-beam');
test('KS 2025 nominal table has 19 ordered unique rows, including D7 and corrected D57 mass',()=>{
 assert.equal(S.bars.length,19);assert.equal(new Set(S.bars.map(b=>b.name)).size,19);
 assert.equal(S.find('D7').diameter,7);assert.equal(S.find('D7').area,38.48);
 assert.equal(S.find('D57').mass,20.2);assert.equal(S.find('D57').area,2579);
 for(let i=0;i<S.bars.length;i++){
  const b=S.bars[i];if(i)assert.ok(b.diameter>S.bars[i-1].diameter);
  assert.ok(Math.abs(b.mass-b.area*.00785)/(b.area*.00785)<.005);
  assert.ok(b.ribMin<=b.ribMax);
 }
});
test('all existing RC beam nominal diameters and areas match the KS reference table',()=>{
 for(const [name,b] of Object.entries(R.BARS)){
  assert.equal(S.find(name).diameter,b.diameter,name);assert.equal(S.find(name).area,b.area,name);
 }
});
