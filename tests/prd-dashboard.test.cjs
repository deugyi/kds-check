const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../prd-dashboard.js');
const piles=['a','b','c','d'].map(key=>({key}));
const zoneData={zones:[{id:'A1'},{id:'B1'}],membership:{a:'A1',b:'A1',c:'B1',d:'unassigned'}};
test('completed records without drilling stay independent; unknown records do not affect totals',()=>{
 const m=D.summarize(piles,{a:{drilled:'2026-09-20',installed:'2026-09-21'},b:{installed:'2026-09-22'},c:{drilled:'2026-09-28'},outside:{installed:'2026-09-28'}},zoneData,'2026-09-29');
 assert.deepEqual(m.all,{total:4,drilled:2,delivered:0,installed:2,remaining:2,percent:50});
 assert.equal(m.zones[0].percent,100);assert.equal(m.zones[2].id,'unassigned');
 assert.equal(m.zones.reduce((sum,z)=>sum+z.total,0),4);
 assert.equal(m.latest,'2026-09-28');
});
test('weekly totals use Monday boundaries and exclude later dates from actuals',()=>{
 const m=D.summarize(piles,{a:{drilled:'2026-09-20',installed:'2026-09-21'},b:{drilled:'2026-09-27',installed:'2026-09-28'},c:{drilled:'2026-09-30'},d:{drilled:'2026-01-01'}},zoneData,'2026-09-29');
 assert.deepEqual(m.weeks[5],{start:'2026-09-14',end:'2026-09-20',drilled:1,installed:0});
 assert.deepEqual(m.weeks[6],{start:'2026-09-21',end:'2026-09-27',drilled:1,installed:1});
 assert.deepEqual(m.weeks[7],{start:'2026-09-28',end:'2026-10-04',drilled:0,installed:1});
});
test('empty and invalid dates cannot make non-finite percentages or bars',()=>{
 const empty=D.summarize([],{},zoneData,'2026-01-01');assert.equal(empty.weeks[7].start,'2025-12-29');
 assert.equal(empty.all.percent,0);assert.equal(empty.latest,null);
 assert.doesNotMatch(D.render(empty),/NaN|Infinity|undefined/);
 const m=D.summarize(piles,{a:{installed:'2026-02-30'},b:{drilled:''}},zoneData,'2026-09-29');assert.equal(m.all.installed,0);
 assert.throws(()=>D.summarize([],{},zoneData,'bad'),/INVALID_REPORT_DATE/);
});
test('graphics have a numeric alternative and escape drawing labels',()=>{
 const model=D.summarize(piles,{},zoneData,'2026-09-29');model.zones[0].id='<img src=x>';
 const html=D.render(model);assert.match(html,/<table>/);assert.match(html,/scope="row"/);assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img/);
});
