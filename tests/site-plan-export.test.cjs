const {test}=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
global.PRDZones=require('../prd-zones.js');global.SitePlan=require('../site-plan.js');
const E=require('../site-plan-export.js');
test('date-free steel completion exports its status and counts without inventing a date or size',async()=>{
 const items=[{key:'a',display:'보 0001',zone:'A3',a:[0,0],b:[3000,0],kind:'beam'},{key:'b',display:'보 0002',zone:'A3',a:[0,10],b:[3000,10],kind:'beam'}];
 const book=E.build(ExcelJS,{trade:'steel',items,records:{a:{installation_complete:true,note:'keep'}},scope:'A3',asOf:'2026-10-06',duplicatePairs:[]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await book.xlsx.writeBuffer());
 const summary=round.getWorksheet('공구별 집계'),detail=round.getWorksheet('시공 기록');
 assert.equal(summary.getCell('C3').value,'설치 완료');assert.equal(summary.getCell('C4').value,1);assert.equal(summary.getCell('E4').value,.5);
 assert.equal(detail.getCell('K3').value,'설치 상태');assert.equal(detail.getCell('K4').value,'설치 완료');assert.equal(detail.getCell('K5').value,'설치 완료 미확인');
 assert.equal(detail.getCell('H4').value,null);assert.equal(detail.getCell('D4').value,'');assert.equal(detail.getCell('I4').value,'keep');
});
test('slab member table exports known attributes and leaves cropped or unavailable fields blank',async()=>{
 const b=E.build(ExcelJS,{trade:'slab',floor:'지하1층',items:[],records:{},scope:'전체',asOf:'2026-10-06',duplicatePairs:[],area:{},slabCatalog:[{code:'S1',thickness_mm:180,type:'T1',attributes:[{label:'상부 주근',value:'=literal'}]},{code:'S2',thickness_mm:200,type:'T2',attributes:[]}]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await b.xlsx.writeBuffer());const sheet=round.getWorksheet('슬래브 부재표');
 assert.equal(sheet.getCell('B4').value,180);assert.equal(sheet.getCell('C5').value,'T2');assert.equal(sheet.getCell('D4').value,'=literal');assert.equal(sheet.getCell('D4').formula,undefined);assert.equal(sheet.getCell('D5').value,'');assert.equal(sheet.rowCount,5);
});
test('selected floor appears in exported workbook titles',async()=>{
 const b=E.build(ExcelJS,{trade:'steel',floor:'지하2층',items:[],records:{},scope:'전체',asOf:'2026-10-03',duplicatePairs:[]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await b.xlsx.writeBuffer());
 for(const name of ['공구별 집계','시공 기록'])assert.equal(round.getWorksheet(name).getCell('A1').value,'서리풀 : 남측 · 지하2층 · 철골보');
});
test('steel XLSX preserves input labels, literal notes, dates and duplicate pairs',async()=>{
 const items=[{key:'a',display:'보 0001',zone:'A1',a:[0,0],b:[3000,0],duplicate_group:'D001'},{key:'b',display:'거더 0002',zone:'A1',a:[0,5],b:[3000,5],duplicate_group:'D001'}];
 const records={a:{label:'부재 A',spec:'H-400',delivered:'2026-09-21',completed:'2026-09-22',note:'=HYPERLINK("x","한글")'}};
 const b=E.build(ExcelJS,{trade:'steel',items,records,scope:'A1',asOf:'2026-10-01',duplicatePairs:[{group:'D001',keys:['a','b'],gap_mm:5,overlap_mm:3000,mixed_layers:true},{group:'D002',keys:['c','d'],gap_mm:3,overlap_mm:2000}]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await b.xlsx.writeBuffer());
 assert.deepEqual(round.worksheets.map(v=>v.name),['공구별 집계','시공 기록','중복 부재 검토']);
 const detail=round.getWorksheet('시공 기록'),summary=round.getWorksheet('공구별 집계'),review=round.getWorksheet('중복 부재 검토');
 assert.equal(detail.getCell('B4').value,'부재 A');assert.equal(detail.getCell('E4').value,3);
 assert.equal(detail.getCell('G4').value.toISOString(),'2026-09-21T00:00:00.000Z');assert.equal(detail.getCell('H4').value.toISOString(),'2026-09-22T00:00:00.000Z');
 assert.equal(detail.getCell('I4').value,records.a.note);assert.equal(detail.getCell('I4').formula,undefined);
 assert.equal(summary.getCell('B4').value,2);assert.equal(summary.getCell('E4').value,.5);assert.equal(review.rowCount,4);assert.equal(review.getCell('B4').value,'부재 A');assert.equal(review.getCell('D4').value,5);
});
test('slab XLSX preserves three types and construction dates including legacy casting records',async()=>{
 const b=E.build(ExcelJS,{trade:'slab',area:{gross:100,opening:8.5,total:91.5,decked:8.5,reinforced:17,completed:17,remaining:74.5,percent:100*17/91.5},areaByZone:{},items:['s','d','c','t','o'].map(key=>({key,display:'슬래브 '+key,zone:'C1',area:8.5})),records:{s:{completed:'2026-10-01'},d:{slab_kind:'deck',decked:'2026-09-28',reinforced:'2026-09-29',completed:'2026-10-01',note:'=literal'},c:{slab_kind:'conventional',reinforced:'2026-09-30'},t:{slab_kind:'temporary'},o:{slab_kind:'opening',completed:'2026-10-01'}},scope:'C1',asOf:'2026-10-01',duplicatePairs:[]});
 const round=new ExcelJS.Workbook();await round.xlsx.load(await b.xlsx.writeBuffer());
 const summary=round.getWorksheet('공구별 집계');assert.equal(summary.getCell('B4').value,100);assert.equal(summary.getCell('C4').value,8.5);assert.equal(summary.getCell('D4').value,91.5);assert.equal(summary.getCell('G4').value,17);assert.equal(summary.getCell('I4').value,17/91.5);const detail=round.getWorksheet('시공 기록');assert.equal(detail.getCell('E4').value,8.5);assert.equal(detail.getCell('G4').value,'오프닝');assert.equal(detail.getCell('H4').value,null);assert.equal(detail.getCell('J4').value.toISOString(),'2026-10-01T00:00:00.000Z');
 assert.deepEqual(['G3','H3','I3','J3','K3'].map(k=>detail.getCell(k).value),['슬래브 종류','데크 판개일','철근 설치일','타설일','메모']);
 assert.deepEqual(['G5','G6','G7'].map(k=>detail.getCell(k).value),['데크슬래브','재래식 슬래브','가설 슬래브']);
 for(const [column,date] of [['H','2026-09-28'],['I','2026-09-29'],['J','2026-10-01']]){assert.equal(detail.getCell(column+'5').value.toISOString(),date+'T00:00:00.000Z');assert.equal(detail.getCell(column+'5').numFmt,'yyyy-mm-dd');}
 assert.equal(detail.getCell('G8').value,'오프닝');assert.equal(detail.getCell('H6').value,null);assert.equal(detail.getCell('K5').value,'=literal');assert.equal(detail.getCell('K5').formula,undefined);assert.equal(round.getWorksheet('중복 부재 검토').rowCount,3);
});
