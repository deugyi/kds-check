const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../site-slab-area.js');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const zones=[{id:'A1',points:rect(0,0,10000,10000)},{id:'A2',points:rect(10000,0,10000,10000)}];
const item=(key,x,y,w,h,extra={})=>({key,points:rect(x,y,w,h),...extra});
test('date-free reinforcement contributes to its stage area without implying casting or counting openings',()=>{
 const r=A.summarize(zones,[item('work',0,0,15000,10000),item('open',0,0,2000,10000)],{work:{slab_kind:'deck',reinforcement_in_progress:true},open:{slab_kind:'opening',reinforcement_in_progress:true}});
 assert.equal(r.area.reinforced,130);assert.equal(r.area.completed,0);assert.equal(r.area.decked,0);assert.equal(r.area.percent,0);assert.equal(r.byZone.A1.reinforced,80);assert.equal(r.byZone.A2.reinforced,50);
});
test('whole zone area is retained and unspecified parts are deducted as default openings',()=>{
 const result=A.summarize(zones,[item('cast',0,0,2000,10000)],{cast:{slab_kind:'deck',completed:'2026-10-06'}});
 assert.equal(result.area.gross,200);assert.equal(result.area.opening,180);assert.equal(result.area.total,20);assert.equal(result.area.completed,20);assert.equal(result.area.percent,100);
 assert.equal(result.byZone.A1.percent,100);assert.equal(result.byZone.A2.percent,null);
});
test('overlapping openings and completion regions are counted once and clipped to each zone',()=>{
 const items=[item('cast1',-10000,0,25000,10000),item('cast2',10000,0,10000,10000),item('open1',9000,0,2000,10000,{review:true}),item('open2',10000,0,2000,10000,{review:true}),item('outside',30000,0,1000,1000)];
 const records={cast1:{slab_kind:'deck',completed:'2026-10-06',decked:'2026-10-01'},cast2:{slab_kind:'conventional',completed:'2026-10-06'},open1:{slab_kind:'opening',completed:'2026-10-06'},open2:{slab_kind:'opening'},outside:{slab_kind:'opening'}};
 const r=A.summarize(zones,items,records);assert.equal(r.area.gross,200);assert.equal(r.area.opening,30);assert.equal(r.area.total,170);assert.equal(r.area.completed,170);assert.equal(r.area.percent,100);assert.equal(r.area.decked,120);
 assert.equal(r.byZone.A1.opening,10);assert.equal(r.byZone.A2.opening,20);assert.equal(r.byZone.A1.completed,90);assert.equal(r.byZone.A2.completed,80);
});
test('polygon holes remain uncast; opening dates never contribute to construction progress',()=>{
 const items=[item('slab',0,0,10000,10000,{holes:[rect(1000,1000,2000,2000)]}),item('open',5000,0,5000,10000)];
 const records={slab:{slab_kind:'deck',reinforced:'2026-10-05',completed:'2026-10-06'},open:{slab_kind:'opening',decked:'2026-10-04',completed:'2026-10-06'}};
 const r=A.summarize(zones.slice(0,1),items,records).area;assert.equal(r.total,46);assert.equal(r.completed,46);assert.equal(r.reinforced,46);assert.equal(r.decked,0);assert.equal(r.percent,100);
});
test('fully deducted and missing boundaries produce no misleading percentage; overlapping zones have one gross area',()=>{
 const r=A.summarize(zones,[item('all',0,0,20000,10000)],{all:{slab_kind:'opening'}}).area;assert.equal(r.total,0);assert.equal(r.percent,null);
 assert.deepEqual(A.summarize([],[],{}).area,A.zero());
 assert.equal(A.summarize([zones[0],{id:'B',points:rect(5000,0,10000,10000)}],[],{}).area.gross,150);
});
test('large drawing coordinates retain small polygon areas',()=>{
 const x=1e9,y=-1e9;assert.equal(A.summarize([{id:'A',points:rect(x,y,10000,10000)}],[item('s',x,y,2000,2000)],{s:{slab_kind:'deck',completed:'2026-10-06'}}).area.completed,4);
});

test('unrecorded and blank types start as openings, dated defaults do not count, and classification survives overlapping untouched candidates',()=>{
 const items=[item('panel',0,0,2000,10000),item('review',0,0,10000,10000,{review:true})];
 const blank=A.summarize(zones,items,{panel:{slab_kind:'',completed:'2026-10-06'}}).area;assert.equal(blank.gross,200);assert.equal(blank.opening,200);assert.equal(blank.total,0);assert.equal(blank.completed,0);assert.equal(blank.percent,null);
 const typed=A.summarize(zones,items,{panel:{slab_kind:'deck',completed:'2026-10-06'}}).area;assert.equal(typed.total,20);assert.equal(typed.opening,180);assert.equal(typed.completed,20);assert.equal(typed.percent,100);
 const explicit=A.summarize(zones,items,{panel:{slab_kind:'deck',completed:'2026-10-06'},review:{slab_kind:'opening'}}).area;assert.equal(explicit.total,0);assert.equal(explicit.completed,0);
});
