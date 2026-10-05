const {test}=require('node:test'),assert=require('node:assert/strict');
global.PRDZones=require('../prd-zones.js');
const G=require('../site-plan.js'),E=require('../site-slab-editor.js'),A=require('../site-slab-area.js');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const base={bounds:[0,0,10000,10000],zones:[{id:'A1',points:rect(0,0,10000,10000)}],members:[{key:'horizontal',a:[1000,3000],b:[5000,3000]},{key:'vertical',a:[3000,1000],b:[3000,5000]}],slabs:[{key:'base',points:rect(1000,1000,2000,2000),holes:[],area:4,zone:'A1'}],columns:[],background:[]};
test('reject crossed boundaries, duplicate points, invalid numbers and invalid holes; support valid cutouts',()=>{
 assert.throws(()=>E.validate({points:[[0,0],[3000,3000],[0,3000],[3000,0]],holes:[]}),/교차/);
 assert.throws(()=>E.validate({points:[[0,0],[0,0],[3000,3000]],holes:[]}),/겹치는/);
 assert.throws(()=>E.validate({points:[[0,0],[NaN,0],[3000,3000]],holes:[]}),/좌표/);
 assert.throws(()=>E.validate({points:rect(0,0,3000,3000),holes:[rect(4000,0,1000,1000)]}),/안에/);
 assert.throws(()=>E.validate({points:rect(0,0,5000,5000),holes:[rect(1000,1000,2000,2000),rect(2000,2000,2000,2000)]}),/겹/);
 assert.equal(A.area([[E.validate({points:rect(0,0,5000,5000),holes:[]}).points]]),25);
 const valid=E.validate({points:rect(0,0,5000,5000),holes:[rect(1000,1000,2000,2000)]});assert.equal(A.area([[valid.points,...valid.holes]]),21);
});
test('snap to beam endpoints, intersections, beam lines and zone edges, excluding hidden beams',()=>{
 const d=G.prepare(base);
 assert.deepEqual(E.snap([1010,3010],d,{},50).point,[1000,3000]);
 assert.equal(E.snap([3010,3010],d,{},50).label,'보 교점');
 assert.deepEqual(E.snap([2200,3010],d,{},50).point,[2200,3000]);
 assert.equal(E.snap([2200,3010],d,{horizontal:{hidden:true}},50).label,'자유점');
 assert.deepEqual(E.snap([10,2000],d,{},50).point,[0,2000]);
});
test('geometry overrides keep keys and records, custom regions join exports and floor area, hide and restore are reversible',()=>{
 const regions=[{item_key:'base',geometry:{points:rect(1000,1000,4000,2000),holes:[]},hidden:false,version:1},{item_key:'USER-SLAB-test',geometry:{points:rect(6000,1000,1000,1000),holes:[]},hidden:false,version:1}],records={base:{slab_kind:'deck',completed:'2026-10-06'},'USER-SLAB-test':{slab_kind:'conventional'}};
 const updated=G.prepare(E.apply(base,regions));assert.equal(base.slabs[0].area,4);assert.equal(updated.slabMap.get('base').area,8);assert.equal(updated.slabs.length,2);
 const area=A.summarize(updated.zones,updated.slabs,records).area;assert.equal(area.total,9);assert.equal(area.completed,8);
 const source=G.floorSources([{id:'B1',drawing:updated,records:Object.entries(records).map(([key,r])=>({...r,trade:'slab',item_key:key})),visibility:{}}]);assert.equal(source.slab.area.total,9);
 const hidden=E.apply(base,regions.map(r=>({...r,hidden:true})));assert.equal(hidden.slabs.length,0);assert.equal(A.summarize(hidden.zones,hidden.slabs,records).area.total,0);
 assert.equal(E.apply({...base,slabs:[],slabsReady:false},regions).slabsReady,true);
});
