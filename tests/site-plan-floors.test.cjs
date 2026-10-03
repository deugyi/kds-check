const {test}=require('node:test'),assert=require('node:assert/strict');
global.PRDZones=require('../prd-zones.js');const G=require('../site-plan.js'),O=require('../site-overview.js');
test('floor aggregation namespaces records and hiding even when member keys repeat',()=>{
 const drawing={members:[{key:'same',zone:'A1'}],zones:[{id:'A1'}],slabs:[{key:'slab',zone:'A1'}]};
 const sources=G.floorSources([{id:'B1',drawing,records:[{trade:'steel',item_key:'same',completed:'2026-10-01'},{trade:'slab',item_key:'slab',completed:'2026-10-02'}],visibility:{same:{hidden:true}}},{id:'B2',drawing:{...drawing,slabs:[],slabsReady:false},records:[{trade:'steel',item_key:'same',completed:'2026-10-03'}]}]);
 const model=O.summarize(sources);assert.equal(model.trades[1].total,1);assert.equal(model.trades[1].completed,1);assert.equal(model.trades[2].total,1);assert.equal(model.trades[2].completed,1);
 assert.equal(sources.steel.records['B1:same'].completed,'2026-10-01');assert.equal(sources.steel.records['B2:same'].completed,'2026-10-03');
 assert.equal(G.floorSources([{id:'B2',drawing:{...drawing,slabs:[],slabsReady:false}}]).slab.items,undefined);
});
