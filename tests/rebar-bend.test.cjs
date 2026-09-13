const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../rebar-bend');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('main hook radius classes and the 60mm floor use nominal diameters',()=>{
 const a=B.calculate('D10','main180');near(a.radius,28.59);near(a.diameter,57.18);near(a.extension,60);
 near(B.calculate('D25','main90').extension,304.8);
 near(B.calculate('D25','main180').extension,101.6);
 near(B.calculate('D29','main90').radius,114.4);
 near(B.calculate('D35','main90').radius,139.6);
 near(B.calculate('D38','main90').radius,190.5);
});
test('stirrup 90-degree extension switches at D19; 135-degree remains 6db',()=>{
 const a=B.calculate('D16','stirrup90');near(a.radius,31.8);near(a.extension,95.4);
 const b=B.calculate('D19','stirrup90');near(b.radius,57.3);near(b.extension,229.2);
 near(B.calculate('D19','stirrup135').extension,114.6);
 assert.equal(B.calculate('D29','stirrup135').supported,false);
 assert.equal(B.calculate('D8','main90').supported,false);
 assert.throws(()=>B.calculate('D999','main90'));assert.throws(()=>B.calculate('D10','seismic'));
});
