const {test}=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
global.PRDZones=require('../prd-zones.js');global.SitePlan=require('../site-plan.js');
const E=require('../site-plan-export.js');
test('steel XLSX preserves input labels, literal notes, dates and duplicate pairs',async()=>{
 const items=[{key:'a',display:'보 0001',zone:'A1',a:[0,0],b:[3000,0],duplicate_group:'D001'},{key:'b',display:'거더 0002',zone:'A1',a:[0,5],b:[3000,5],duplicate_group:'D001'}];
 const records={a:{label:'부재 A',spec:'H-400',delivered:'2026-09-21',completed:'2026-09-22',note:'=HYPERLINK("x","한글")'}};
 const b=E.build(ExcelJS,{trade:'steel',items,records,scope:'A1',asOf:'2026-10-01',duplicatePairs:[{group:'D001',keys:['a','b'],gap_mm:5,overlap_mm:3000,mixed_layers:true},{group:'D002',keys:['c','d'],gap_mm:3,overlap_mm:2000}]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await b.xlsx.writeBuffer());
 assert.deepEqual(round.worksheets.map(v=>v.name),['공구별 집계','시공 기록','중복선 검토']);
 const detail=round.getWorksheet('시공 기록'),summary=round.getWorksheet('공구별 집계'),review=round.getWorksheet('중복선 검토');
 assert.equal(detail.getCell('B4').value,'부재 A');assert.equal(detail.getCell('E4').value,3);
 assert.equal(detail.getCell('G4').value.toISOString(),'2026-09-21T00:00:00.000Z');assert.equal(detail.getCell('H4').value.toISOString(),'2026-09-22T00:00:00.000Z');
 assert.equal(detail.getCell('I4').value,records.a.note);assert.equal(detail.getCell('I4').formula,undefined);
 assert.equal(summary.getCell('B4').value,2);assert.equal(summary.getCell('E4').value,.5);assert.equal(review.rowCount,4);assert.equal(review.getCell('B4').value,'부재 A');assert.equal(review.getCell('D4').value,5);
});
test('slab XLSX reports area and casting date with blank delivery and no duplicate lines',async()=>{
 const b=E.build(ExcelJS,{trade:'slab',items:[{key:'s',display:'슬래브 0001',zone:'C1',area:8.5}],records:{s:{completed:'2026-10-01'}},scope:'C1',asOf:'2026-10-01',duplicatePairs:[]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await b.xlsx.writeBuffer());
 assert.equal(round.getWorksheet('시공 기록').getCell('E4').value,8.5);assert.equal(round.getWorksheet('시공 기록').getCell('G4').value,null);assert.equal(round.getWorksheet('시공 기록').getCell('H4').value.toISOString(),'2026-10-01T00:00:00.000Z');assert.equal(round.getWorksheet('중복선 검토').rowCount,3);
});
