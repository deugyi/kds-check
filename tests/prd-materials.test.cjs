const {test}=require('node:test'),assert=require('node:assert/strict');
global.PRD=require('../prd.js');const M=require('../prd-materials.js');
const raw={schema:1,fields:[{id:'diameter',value:'D1200'},{id:'column_spec',value:'BH-650×650×70×70'},{id:'insert_spec',value:'H-400×400×13×21'},{id:'weight',value:39.3}]};
test('Excel specifications initialize the three inputs; drawing defaults cover unimported piles',()=>{
 assert.deepEqual(M.specifications({}, {diameter:1000},raw),{diameter:1200,column_spec:'BH-650×650×70×70',insert_spec:'H-400×400×13×21'});
 assert.deepEqual(M.specifications({}, {diameter:1000}),{diameter:1000,column_spec:'',insert_spec:''});
 assert.equal(M.read(raw).fields.length,3);assert.equal(M.read({schema:2}),null);
});
test('saved edits and deliberate blanks take priority over the original Excel values',()=>{
 const s={diameter:null,column_spec:'',insert_spec:''};assert.deepEqual(M.specifications({specifications:s},{diameter:1000},raw),s);
 const edit={diameter:1400,column_spec:'=literal <text>',insert_spec:' H-350 '};assert.deepEqual(M.specifications({specifications:edit},{},raw),{...edit,insert_spec:'H-350'});
});
test('invalid diameter and oversized specification fail before saving; older date-only records still work',()=>{
 for(const diameter of [0,-1,'wrong',true,Infinity])assert.throws(()=>global.PRD.record({specifications:{diameter}}),/천공 직경/);
 assert.throws(()=>global.PRD.specifications({column_spec:'x'.repeat(121)}),/120자/);
 assert.deepEqual(global.PRD.record({note:'old'}),{drilled:'',delivered:'',installed:'',note:'old'});
 assert.equal(global.PRD.record({specifications:{diameter:'1200.5'}}).specifications.diameter,1200.5);
});
