const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../site-slab-catalog.js');
const a={code:'S1',thickness_mm:180,type:'T1',attributes:[{label:'상부 주근',value:'D10'}]},b={code:'S1s',thickness_mm:200,type:'T2',attributes:[]};
test('catalog uses exact member names and specifications without guessing custom values',()=>{
 const d={slabCatalog:[a,b]};assert.equal(C.match(d,'S1s').type,'T2');assert.equal(C.match(d,' S1 ').type,'T1');assert.equal(C.match(d,C.specification(a)).code,'S1');
 for(const s of ['', 'S1 extra', 'S1 · 두께 200 mm · T2', 's1'])assert.equal(C.match(d,s),null);
 assert.equal(C.match({},'S1'),null);assert.equal(C.details(a)[3][1],'D10');
 assert.equal(C.color({color:'#dcefeb'}),'#dcefeb');assert.equal(C.color({color:'red;background:url(x)'}),'#dcebf6');
});
test('catalog rejects invalid entries, duplicates and oversized values without modifying the source',()=>{
 const bad=[null,{}, {...a,thickness_mm:'180'},{...a,thickness_mm:Infinity},{...a,code:'x'.repeat(81)},{...a,type:''}];
 assert.equal(C.entries({slabCatalog:[...bad,a,a,b]}).length,2);
 const source={slabCatalog:[{...a,attributes:[...a.attributes,{label:'bad',value:'x'.repeat(201)},null]}]},before=structuredClone(source);
 assert.equal(C.entries(source)[0].attributes.length,1);assert.deepEqual(source,before);
});
