const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../supabase/functions/_shared/progress-core.js'),ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
const day='2026-10-12',line=(quantity=2,unit='부재')=>({floor:'지하1층',zone:'B2',process:'철골보',quantity,unit});
test('message submissions require an explicit real working date, preserve locations and normalize units',()=>{
 const r=P.parseMessage('/수정\n2026-10-12\n외부 / 전체 / 토사 반출 / 1,200.125 / m3\n지하1층 / B2 / 철골보 / 20 / 부재\n비고: 특이사항 없음',day);
 assert.equal(r.revision,true);assert.equal(r.items[0].quantity,1200.125);assert.equal(r.items[0].unit,'m³');assert.equal(r.items[1].zone,'B2');assert.equal(r.note,'특이사항 없음');
 assert.equal(P.parseMessage('2026-10-12\n작업 없음',day).no_work,true);
 for(const text of ['2026-02-30\n작업 없음','2026-10-13\n작업 없음','오늘\n작업 없음','2026-10-12\n작업 없음\n외부 / 전체 / 토사 반출 / 1 / m3','2026-10-12\n지하1층 / B2 / 철골보 / 1.2 / 부재','2026-10-12\n외부 / 전체 / 토사 반출 / -2 / m3','2026-10-12\n외부 / 전체 / 토사 반출 / 1,2 / m3'])assert.throws(()=>P.parseMessage(text,day));
});
test('only approved quantities count; periods and units stay separate and repeated report IDs are not added twice',()=>{
 const rows=[{id:'a',state:'approved',work_date:day,items:[line(2),line(3,'t')]},{id:'a',state:'approved',work_date:day,items:[line(2)]},{id:'b',state:'pending',work_date:day,items:[line(1000)]},{id:'c',state:'returned',work_date:day,items:[line(1000)]},{id:'d',state:'approved',work_date:'2026-10-11',items:[line(1000)]},{id:'e',state:'approved',work_date:day,no_work:true,items:[]}];
 assert.deepEqual(P.summarize(rows,day,day).sort((a,b)=>a.unit<b.unit?-1:1),[{process:'철골보',quantity:3,unit:'t'},{process:'철골보',quantity:2,unit:'부재'}]);assert.equal(P.approved(rows,day,day).length,2);
});
test('approved-only XLSX preserves dates, units, no-work submissions and literal user notes',async()=>{
 const reports=[{id:'a',company_id:'c',state:'approved',work_date:day,items:[line(2)],note:'=1+1',source:'telegram',reviewed_at:'2026-10-12T05:00:00Z'},{id:'b',company_id:'c',state:'pending',work_date:day,items:[line(999)]},{id:'z',company_id:'c',state:'approved',work_date:day,no_work:true,items:[]}];
 const original=await P.workbook(ExcelJS,reports,[{id:'c',name:'업체'}],day,day),wb=new ExcelJS.Workbook();await wb.xlsx.load(await original.xlsx.writeBuffer());
 assert.deepEqual(wb.worksheets.map(s=>s.name),['공정별 실적','업체별 실적','승인 실적 목록']);assert.equal(wb.worksheets[0].getRow(4).getCell(2).value,2);const s=wb.worksheets[2];assert.ok(s.getRow(4).getCell(1).value instanceof Date);assert.equal(s.getRow(4).getCell(8).value,'=1+1');assert.equal(s.getRow(5).getCell(5).value,'작업 없음');assert.equal(s.getRow(3).getCell(11).value,'승인 상태');assert.equal(s.getRow(4).getCell(11).value,'승인됨');assert.equal(s.getRow(5).getCell(11).value,'승인됨');assert.equal(s.rowCount,5);
});
test('Kakao approved feedback export links its planned job, keeps reasons and leaves pending amounts out',async()=>{
 const r={id:'r',company_id:'c',plan_id:'p',state:'approved',work_date:day,source:'kakao',items:[{...line(5,'개소'),plan_item:1}],task_feedback:[{task_no:1,state:'partial',reason:'잔여 용접'}]},pending={...r,id:'pending',state:'pending',items:[line(999)]};
 const source=await P.workbook(ExcelJS,[r,pending],[{id:'c',name:'업체'}],day,day,[{id:'p',document:{tasks:[{no:1,description:'수평재 용접'}]}}]),wb=new ExcelJS.Workbook();await wb.xlsx.load(await source.xlsx.writeBuffer());
 assert.equal(wb.getWorksheet('공정별 실적').getRow(4).getCell(2).value,5);assert.equal(wb.getWorksheet('승인 실적 목록').getRow(4).getCell(9).value,'카카오톡');assert.equal(wb.getWorksheet('승인 실적 목록').getRow(4).getCell(12).value,1);const s=wb.getWorksheet('계획별 작업결과');assert.equal(s.getRow(4).getCell(4).value,'수평재 용접');assert.equal(s.getRow(4).getCell(5).value,'일부 완료');assert.equal(s.getRow(4).getCell(6).value,'잔여 용접');assert.equal(s.rowCount,4);
});
