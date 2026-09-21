const {test}=require('node:test');
const assert=require('node:assert/strict');
const Z=require('../prd-zones.js'),P=require('../prd.js'),base=require('../prd-default.json');
test('fixed drawing maps all 790 unique objects into the ten named construction zones',()=>{
 const z=Z.build(base.drawing);assert.equal(z.zones.length,10);assert.equal(z.issues.length,0);
 assert.deepEqual(Object.fromEntries(z.zones.map(z=>[z.id,z.keys.length])),{A1:120,A2:118,A3:115,B1:70,B2:81,B3:77,C1:44,C2:37,C3:88,C4:40});
 const keys=z.zones.flatMap(z=>z.keys);assert.equal(keys.length,790);assert.equal(new Set(keys).size,790);
 for(const p of base.drawing.piles)for(const n of p.number)assert.equal(z.membership[p.key],n.split('-')[0]);
});
test('polygon membership includes edges and handles concave outlines',()=>{const shape=[[0,0],[10,0],[10,4],[4,4],[4,10],[0,10]];assert.equal(Z.contains(2,8,shape),true);assert.equal(Z.contains(8,8,shape),false);assert.equal(Z.contains(10,2,shape),true);assert.equal(Z.contains(20,2,shape),false);});
test('shared boundary or outside pile is explicitly unassigned without double counting',()=>{const d={paths:[{layer:'-zoning',zoneName:'A1',closed:true,points:[[0,0],[10,0],[10,10],[0,10]]},{layer:'ZONING',zoneName:'A2',closed:true,points:[[10,0],[20,0],[20,10],[10,10]]}],piles:[{key:'A',x:5,y:5},{key:'B',x:10,y:5},{key:'C',x:50,y:5}]};const z=Z.build(d);assert.equal(z.membership.A,'A1');assert.equal(z.membership.B,'unassigned');assert.equal(z.membership.C,'unassigned');assert.equal(z.zones.flatMap(z=>z.keys).length,1);assert.equal(z.issues.length,2);});
test('zone grouping is geometric even when pile labels are missing or wrong',()=>{const copy=JSON.parse(JSON.stringify(base.drawing));copy.piles[0].number=['C4-FAKE'];const original=Z.build(base.drawing),after=Z.build(copy);assert.deepEqual(after.membership,original.membership);});
test('cumulative work totals count dates independently while status buckets remain exclusive',()=>{const piles=[{key:'A',warnings:[]},{key:'B',warnings:['duplicate']},{key:'C',warnings:[]}],records={A:{drilled:'2026-09-20',delivered:'2026-09-20',installed:'2026-09-21'},B:{delivered:'2026-09-21'}};const s=Z.summary(piles,records,P.status);assert.deepEqual(s.work,{drilled:1,delivered:2,installed:1});assert.deepEqual(s.stages,{planned:1,drilled:0,delivered:1,ready:0,installed:1});assert.equal(s.total,3);assert.equal(s.warnings,1);assert.ok(Math.abs(s.percent-100/3)<1e-10);});
test('empty scope has zero progress, clearing dates reduces cumulative counts',()=>{assert.equal(Z.summary([],{},P.status).percent,0);const ps=[{key:'A',warnings:[]}];assert.equal(Z.summary(ps,{A:{installed:'2026-09-21'}},P.status).percent,100);assert.equal(Z.summary(ps,{A:{installed:''}},P.status).percent,0);});
test('all default zone label centers lie inside their polygons',()=>{for(const z of Z.build(base.drawing).zones)assert.equal(Z.contains(...z.center,z.points),true,z.id);});
