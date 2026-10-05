const {test}=require('node:test'),assert=require('node:assert/strict');
global.PRDZones=require('../prd-zones.js');const G=require('../site-plan.js'),O=require('../site-overview.js');
test('floor aggregation namespaces records and hiding even when member keys repeat',()=>{
 const drawing={members:[{key:'same',zone:'A1'}],zones:[{id:'A1',points:[[0,0],[1000,0],[1000,1000],[0,1000]]}],slabs:[{key:'slab',zone:'A1',points:[[0,0],[1000,0],[1000,1000],[0,1000]]}]};
 const sources=G.floorSources([{id:'B1',drawing,records:[{trade:'steel',item_key:'same',completed:'2026-10-01'},{trade:'slab',item_key:'slab',slab_kind:'deck',completed:'2026-10-02'}],visibility:{same:{hidden:true}}},{id:'B2',drawing:{...drawing,slabs:[],slabsReady:false},records:[{trade:'steel',item_key:'same',completed:'2026-10-03'}]}]);
 const model=O.summarize(sources);assert.equal(model.trades[1].total,1);assert.equal(model.trades[1].completed,1);assert.equal(model.trades[2].total,1);assert.equal(model.trades[2].completed,1);
 assert.equal(sources.steel.records['B1:same'].completed,'2026-10-01');assert.equal(sources.steel.records['B2:same'].completed,'2026-10-03');
 assert.equal(G.floorSources([{id:'B2',drawing:{...drawing,slabs:[],slabsReady:false}}]).slab.items,undefined);
});

test('slab areas on vertically stacked floors are added, never merged in plan coordinates',()=>{
 const points=[[0,0],[10000,0],[10000,10000],[0,10000]],drawing={members:[],zones:[{id:'A1',points}],slabs:[{key:'same',zone:'A1',points}]};
 const sources=G.floorSources([{id:'B1',drawing,records:[{trade:'slab',item_key:'same',slab_kind:'deck',completed:'2026-10-06'}]},{id:'B2',drawing,records:[{trade:'slab',item_key:'same',slab_kind:'opening'}]}]);
 const m=O.summarize(sources);assert.equal(m.trades[2].gross,200);assert.equal(m.trades[2].opening,100);assert.equal(m.trades[2].total,100);assert.equal(m.trades[2].completed,100);assert.equal(m.zones[0].trades[2].percent,100);
});
