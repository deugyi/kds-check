const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../number-input-step.js'),'utf8');
function field(value,min='1',step='50'){
 return {value:String(value),min,step,get valueAsNumber(){return this.value===''?NaN:Number(this.value);},matches:()=>true,hasAttribute:k=>k==='min',getAttribute(k){return this[k];}};
}
function load(inputs){const events={};vm.runInNewContext(source,{document:{querySelectorAll:()=>inputs,addEventListener:(k,f)=>events[k]=f}});return (kind,input)=>events[kind]({target:input});}
function nativeStep(x,dir){const s=Number(x.step),m=Number(x.min),v=Number(x.value);x.value=String(Math.max(m,m+(dir>0?Math.floor((v-m)/s)+1:Math.ceil((v-m)/s)-1)*s));}
test('first and repeated native increments preserve exact 50 mm delta',()=>{
 for(const initial of [600,1550,1551,498,350])for(const dir of [-1,1]){
  const x=field(initial),event=load([x]);
  for(let n=1;n<=3;n++){event('pointerdown',x);nativeStep(x,dir);event('input',x);assert.equal(Number(x.value),initial+dir*50*n);}
 }
});
test('generated fields, RH selection and keyboard input are aligned before stepping',()=>{
 const event=load([]),x=field(1000);event('focusin',x);nativeStep(x,1);assert.equal(x.value,'1050');
 x.value='792';event('keydown',x);nativeStep(x,1);assert.equal(x.value,'842');
 x.value='351';event('input',x);nativeStep(x,-1);assert.equal(x.value,'301');
});
test('minimum is respected and blank/invalid input is not silently replaced',()=>{
 const x=field(50),event=load([x]);nativeStep(x,-1);assert.equal(x.value,'50');
 for(const v of ['', '-20']){x.value=v;event('input',x);assert.equal(x.value,v);assert.equal(x.min,'1');}
 x.value='25';event('input',x);assert.equal(x.min,'25');nativeStep(x,-1);assert.equal(x.value,'25');
});
test('100/25/5 steps work and unit/any/decimal step controls remain unchanged',()=>{
 for(const [v,s] of [[3000,100],[200,25],[40,5],[210000,1000]]){
  const x=field(v,'1',String(s));load([x]);nativeStep(x,1);assert.equal(Number(x.value),v+s);
 }
 for(const s of ['1','any','0.1']){const x=field(8,'1',s);load([x]);assert.equal(x.min,'1');assert.equal(x.value,'8');}
});
