const {test}=require('node:test'),assert=require('node:assert/strict');
global.PRDZones=require('../prd-zones.js');const G=require('../site-plan.js');
test('slab types and dates preserve legacy casting records and optional stages',()=>{
 const old=G.record({label:'old',completed:'2026-10-02'},'slab');
 assert.equal(old.slab_kind,'');assert.equal(old.decked,'');assert.equal(old.reinforced,'');assert.equal(old.completed,'2026-10-02');
 const value={slab_kind:'deck',decked:'2026-09-29',reinforced:'2026-10-01',completed:'2026-10-02'};
 assert.equal(G.record(value,'slab').decked,'2026-09-29');
 for(const invalid of [{...value,reinforced:'2026-09-28'},{...value,completed:'2026-09-30'},{slab_kind:'deck',decked:'2026-10-02',completed:'2026-10-01'}])assert.throws(()=>G.record(invalid,'slab'),/순서/);
 for(const date of ['2026-02-30','0000-01-01','2026-13-01'])assert.throws(()=>G.record({...value,decked:date},'slab'),/날짜/);
 assert.throws(()=>G.record({...value,slab_kind:'invalid'},'slab'),/종류/);
 assert.equal(G.record({slab_kind:'conventional',reinforced:'2026-10-01',completed:'2026-10-02'},'slab').decked,'');
 assert.equal(G.record({slab_kind:'temporary'},'slab').completed,'');assert.equal(G.record({...value,slab_kind:'opening'},'slab').completed,value.completed);assert.equal(G.itemColor('slab',{}, {slab_kind:'opening',completed:value.completed}),'#ffffff');
 assert.notEqual(G.itemColor('slab',{},value),G.itemColor('slab',{}, {...value,slab_kind:'temporary'}));
 assert.equal(G.record({...value,delivered:'2026-09-25'},'slab').delivered,'');
 assert.equal(G.record({...value,delivered:'2026-09-25'},'steel').slab_kind,undefined);
});
