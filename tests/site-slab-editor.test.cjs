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
 const d=G.prepare({...base,slabs:[]});
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

test('large unchanged imported boundaries can be hidden and restored without entering editor validation',()=>{
 const points=Array.from({length:201},(_,i)=>[5000+2000*Math.cos(i*2*Math.PI/201),5000+2000*Math.sin(i*2*Math.PI/201)]),d={...base,slabs:[{key:'complex',points,holes:[],review:true}]},r={item_key:'complex',geometry:{points,holes:[]},hidden:false,version:2};
 assert.equal(E.apply(d,[{...r,hidden:true}]).slabs.length,0);assert.equal(E.apply(d,[r]).slabs[0].points.length,201);assert.equal(E.apply(d,[r]).slabs[0].review,true);
});

test('new area priority partitions neighbours into pieces and holes while preserving union area and records',()=>{
 const old={key:'old',points:rect(1000,1000,8000,8000),holes:[],area:64,zone:'A1'},d=G.prepare({...base,slabs:[old]}),records={old:{slab_kind:'deck',completed:'2026-10-06',note:'keep'},new:{slab_kind:'conventional'}};
 const plan=E.partition(d,'new',{points:rect(4000,0,2000,10000),holes:[]},[{item_key:'old',version:7}],records);
 assert.equal(plan.trimmed,1);assert.equal(plan.removed,0);assert.equal(plan.changes[1].geometry.parts.length,2);assert.equal(plan.changes[1].expected_version,7);assert.deepEqual(plan.expected,{old:7});
 const updated=G.prepare(E.apply({...base,slabs:[old]},plan.changes));assert.equal(updated.slabMap.get('old').area,48);assert.equal(updated.slabMap.get('new').area,20);
 assert.equal(A.summarize(updated.zones,updated.slabs,records).area.total,68);assert.equal(A.summarize(updated.zones,updated.slabs,records).area.completed,48);
 assert.equal(G.hits(updated,'slab',[2000,2000],0)[0].key,'old');assert.equal(G.hits(updated,'slab',[7000,2000],0)[0].key,'old');assert.equal(G.hits(updated,'slab',[5000,2000],0).some(v=>v.key==='old'),false);
 assert.equal(records.old.note,'keep');const cut=E.partition(d,'new',{points:rect(3000,3000,2000,2000),holes:[]},[],records);assert.equal(cut.changes[1].geometry.parts[0].holes.length,1);assert.equal(A.area(E.multi(cut.changes[1].geometry)),60);
 assert.equal(E.partition(d,'new',{points:rect(0,0,10000,10000),holes:[]},[],records).changes[1].hidden,true);
});
test('shared boundary snapping preserves exact coordinates; hidden and unconfirmed alternatives do not partition actual regions',()=>{
 const x=3000.123456789,old={key:'old',points:rect(1000,1000,x-1000,2000),holes:[]},review={key:'review',points:rect(5000,1000,2000,2000),holes:[],review:true};const d=G.prepare({...base,slabs:[old,review]});
 assert.deepEqual(E.snap([x+.02,1700],d,{},20).point,[x,1700]);assert.equal(E.snap([x+.02,1700],d,{vertical:{hidden:true}},20,'old').label,'자유점');
 const next={points:rect(4000,0,4000,4000),holes:[]};assert.equal(E.partition(d,'new',next).changes.length,1);assert.equal(E.partition(d,'new',next,[],{review:{slab_kind:'deck'}}).changes.length,2);
 const adjacent=E.partition(d,'new',{points:rect(x,1000,2000,2000),holes:[]});assert.equal(adjacent.trimmed,0);assert.equal(adjacent.overlap,0);
 const hidden=G.prepare(E.apply({...base,slabs:[old]},[{item_key:'old',geometry:E.geometry(old),hidden:true}]));assert.equal(E.partition(hidden,'new',{points:rect(0,0,10000,10000),holes:[]}).changes.length,1);
});
test('new shape is clipped to the true zone outline rather than its bounding rectangle',()=>{
 const d=G.prepare({...base,zones:[{id:'A1',points:[[0,0],[10000,0],[0,10000]]}],slabs:[]});const plan=E.partition(d,'new',{points:rect(4000,4000,4000,4000),holes:[]});assert.equal(A.area(E.multi(plan.geometry)),2);assert.throws(()=>E.partition(d,'new',{points:rect(8000,8000,1000,1000),holes:[]}),/존 안/);
});
