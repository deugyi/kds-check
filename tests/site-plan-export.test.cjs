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
test('slab XLSX preserves three types and construction dates including legacy casting records',async()=>{
 const b=E.build(ExcelJS,{trade:'slab',items:['s','d','c','t'].map(key=>({key,display:'슬래브 '+key,zone:'C1',area:8.5})),records:{s:{completed:'2026-10-01'},d:{slab_kind:'deck',decked:'2026-09-28',reinforced:'2026-09-29',completed:'2026-10-01',note:'=literal'},c:{slab_kind:'conventional',reinforced:'2026-09-30'},t:{slab_kind:'temporary'}},scope:'C1',asOf:'2026-10-01',duplicatePairs:[]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await b.xlsx.writeBuffer());
 const detail=round.getWorksheet('시공 기록');assert.equal(detail.getCell('E4').value,8.5);assert.equal(detail.getCell('G4').value,'미지정');assert.equal(detail.getCell('H4').value,null);assert.equal(detail.getCell('J4').value.toISOString(),'2026-10-01T00:00:00.000Z');
 assert.deepEqual(['G3','H3','I3','J3','K3'].map(k=>detail.getCell(k).value),['슬래브 종류','데크 판개일','철근 설치일','타설일','메모']);
 assert.deepEqual(['G5','G6','G7'].map(k=>detail.getCell(k).value),['데크슬래브','재래식 슬래브','가설 슬래브']);
 for(const [column,date] of [['H','2026-09-28'],['I','2026-09-29'],['J','2026-10-01']]){assert.equal(detail.getCell(column+'5').value.toISOString(),date+'T00:00:00.000Z');assert.equal(detail.getCell(column+'5').numFmt,'yyyy-mm-dd');}
 assert.equal(detail.getCell('H6').value,null);assert.equal(detail.getCell('K5').value,'=literal');assert.equal(detail.getCell('K5').formula,undefined);assert.equal(round.getWorksheet('중복선 검토').rowCount,3);
});
