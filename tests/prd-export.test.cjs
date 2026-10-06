const {test}=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
global.PRD=require('../prd.js');global.PRDDashboard=require('../prd-dashboard.js');
global.PRDMaterials=require('../prd-materials.js');
const E=require('../prd-export.js'),Z=require('../prd-zones.js'),base=require('./prd-fixture.cjs');
test('XLSX round trip preserves Korean identifiers, literal memo, actual dates, totals and blank delivery',async()=>{
 const piles=base.drawing.piles.slice(0,2),records={[piles[0].key]:{drilled:'2026-09-21',installed:'2026-09-22',note:'=HYPERLINK("https://example.test","한글")'}};
 const book=E.build(ExcelJS,{piles,records,zones:Z.build(base.drawing),scope:'A1',filter:'전체 상태',asOf:'2026-09-30'});
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await book.xlsx.writeBuffer());
 assert.deepEqual(loaded.worksheets.map(s=>s.name),['공구별 집계','공별 기록','주간 실적']);
 const detail=loaded.getWorksheet('공별 기록'),summary=loaded.getWorksheet('공구별 집계');
 assert.equal(detail.rowCount,6);assert.equal(detail.getCell('A5').value,piles[0].number[0]);
 assert.equal(detail.getCell('G5').value.toISOString(),'2026-09-21T00:00:00.000Z');
 assert.equal(detail.getCell('H5').value,null);assert.equal(detail.getCell('J5').value,records[piles[0].key].note);
 assert.equal(detail.getCell('J5').formula,undefined);assert.equal(summary.getCell('B5').value,2);assert.equal(summary.getCell('G5').value,.5);
 assert.equal(detail.views[0].ySplit,4);assert.ok(detail.autoFilter);assert.match(detail.getCell('A2').value,/A1.*2공/);
 const weekly=loaded.getWorksheet('주간 실적');assert.equal(weekly.getCell('C11').value,1);assert.equal(weekly.getCell('D11').value,1);
});
test('an empty filtered export has headers and a zero summary',async()=>{
 const b=E.build(ExcelJS,{piles:[],records:{},zones:Z.build(base.drawing),scope:'B3',filter:'시공 완료',asOf:'2026-09-30'});
 const b2=new ExcelJS.Workbook();await b2.xlsx.load(await b.xlsx.writeBuffer());
 assert.equal(b2.getWorksheet('공별 기록').rowCount,4);assert.equal(b2.getWorksheet('공구별 집계').getCell('G5').value,0);
});
test('export uses saved specifications and only the requested material columns, preserving literal text and blanks',async()=>{
 const pile=base.drawing.piles[0],specifications={diameter:1200,column_spec:'=1+1',insert_spec:'H-400×400×13×21'};
 const b=E.build(ExcelJS,{piles:[pile],records:{[pile.key]:{specifications}},zones:Z.build(base.drawing),scope:'A1',filter:'전체',asOf:'2026-10-06'}),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await b.xlsx.writeBuffer());
 assert.deepEqual(loaded.worksheets.map(s=>s.name),['공구별 집계','공별 기록','주간 실적']);const d=loaded.getWorksheet('공별 기록');assert.equal(d.getCell('E5').value,1200);assert.equal(d.getCell('K5').value,'=1+1');assert.equal(d.getCell('K5').formula,undefined);assert.equal(d.getCell('L5').value,specifications.insert_spec);assert.equal(d.getCell('G5').value,null);
 const empty=E.build(ExcelJS,{piles:[pile],records:{[pile.key]:{specifications:{diameter:null,column_spec:'',insert_spec:''}}},zones:Z.build(base.drawing),asOf:'2026-10-06'});assert.equal(empty.getWorksheet('공별 기록').getCell('E5').value,null);
});
