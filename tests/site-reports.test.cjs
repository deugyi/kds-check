const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../site-reports.js'),ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
const rectangle=(key,x1,y1,x2,y2)=>({key,zone:'A1',points:[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],holes:[]});
function fixture(){return {asOf:'2026-10-12',prd:{items:[{key:'p1',label:'A1-001',zone:'A1'},{key:'p2',label:'A2-001',zone:'A2'}],records:{p1:{drilled:'2026-10-01',delivered:'2026-10-06',installed:'2026-10-08',note:'=1+1'},p2:{drilled:'2026-10-11',installed:'2026-10-13'}}},plans:[{id:'B1',name:'지하1층',drawing:{members:[{key:'same',zone:'A1'},{key:'dated',zone:'A2'},{key:'hidden',zone:'A1'}],slabsReady:true,zones:[{id:'A1',points:[[0,0],[10000,0],[10000,10000],[0,10000]]}],slabs:[rectangle('s1',0,0,4000,4000),rectangle('s2',2000,0,6000,4000),rectangle('o',0,0,1000,4000)]},records:[{trade:'steel',item_key:'same',installation_complete:true,label:'B1SB4'},{trade:'steel',item_key:'dated',completed:'2026-10-08'},{trade:'steel',item_key:'hidden',completed:'2026-10-08'},{trade:'slab',item_key:'s1',slab_kind:'deck',completed:'2026-10-08',reinforcement_in_progress:true},{trade:'slab',item_key:'s2',slab_kind:'deck',completed:'2026-10-09'},{trade:'slab',item_key:'o',slab_kind:'opening',completed:'2026-10-08'}],visibility:{hidden:{hidden:true}}},{id:'B2',name:'지하2층',drawing:{members:[{key:'same',zone:'A1'}],zones:[],slabs:[],slabsReady:false},records:[{trade:'steel',item_key:'same',completed:'2026-10-07',label:'B2SB4'}],visibility:{}}]};}
const row=(m,id)=>m.summary.find(s=>s.id===id);
test('period/cumulative counts use construction dates; hidden, undated and future work cannot enter daily actuals',()=>{
 const m=R.summarize(fixture(),'2026-10-05','2026-10-11');
 assert.equal(row(m,'prd-drilled').period,1);assert.equal(row(m,'prd-drilled').cumulative,2);
 assert.equal(row(m,'prd-installed').period,1);assert.equal(row(m,'steel-completed').period,2);assert.equal(row(m,'steel-completed').undated,1);
 assert.equal(m.missing[0].label,'B1SB4');assert.equal(m.details.some(v=>v.label==='hidden'),false);assert.equal(m.details.some(v=>v.date==='2026-10-13'),false);
 assert.deepEqual(m.details.filter(v=>v.id==='steel-completed').map(v=>v.floor).sort(),['지하1층','지하2층']);
});
test('slab stages subtract openings and allocate overlapping areas once, reconciling daily and detailed totals',()=>{
 const m=R.summarize(fixture(),'2026-10-05','2026-10-11');
 assert.equal(row(m,'slab-completed').period,20);assert.equal(row(m,'slab-completed').cumulative,20);
 assert.equal(row(m,'slab-reinforced').period,0);
 assert.deepEqual(m.daily.filter(s=>s.id==='slab-completed').map(s=>s.quantity),[12,8]);
 assert.equal(m.details.filter(s=>s.id==='slab-completed').reduce((n,s)=>n+s.quantity,0),20);
 const later=R.summarize(fixture(),'2026-10-09','2026-10-11');assert.equal(row(later,'slab-completed').period,8);assert.equal(row(later,'slab-completed').cumulative,20);
});
test('invalid dates go to confirmation instead of actuals and an unavailable slab floor is excluded',()=>{
 const s=fixture();s.prd.records.p2.delivered='2026-02-30';s.plans[1].drawing.slabs=[rectangle('future',0,0,9000,9000)];s.plans[1].records.push({trade:'slab',item_key:'future',slab_kind:'deck',completed:'2026-10-08'});
 const m=R.summarize(s,'2026-10-05','2026-10-11');assert.equal(row(m,'prd-delivered').period,1);assert.equal(row(m,'prd-delivered').undated,1);assert.equal(row(m,'slab-completed').period,20);
});
test('report ranges reject invalid/reversed/future days and weekly boundaries cross months correctly',()=>{
 assert.equal(R.monday('2026-10-01'),'2026-09-28');assert.equal(R.monday('2026-10-11'),'2026-10-05');assert.equal(R.validDate('2026-02-30'),false);
 for(const [a,b] of [['bad','2026-10-11'],['2026-10-11','2026-10-05'],['2026-10-01','2026-10-13']])assert.throws(()=>R.summarize(fixture(),a,b));
});
test('XLSX round trip includes reports, real dates and literal notes without invented undated dates',async()=>{
 const m=R.summarize(fixture(),'2026-10-05','2026-10-11'),book=R.build(ExcelJS,m),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await book.xlsx.writeBuffer());
 assert.deepEqual(loaded.worksheets.map(s=>s.name),['공종별 실적','층·공구별 실적','일별 실적','기간 시공기록','날짜 확인']);
 assert.equal(loaded.getWorksheet('공종별 실적').getCell('D11').value,20);assert.equal(loaded.getWorksheet('공종별 실적').getCell('F8').value,1);
 const details=loaded.getWorksheet('기간 시공기록');assert.ok(details.getCell('A4').value instanceof Date);const notes=[];details.eachRow((r,i)=>{if(i>3)notes.push(r.getCell(9).value);});assert.ok(notes.includes('=1+1'));assert.equal(details.getCell('I4').formula,undefined);
 assert.equal(loaded.getWorksheet('날짜 확인').getCell('E4').value,'B1SB4');assert.equal(loaded.getWorksheet('날짜 확인').getCell('H4').value,'완료일 미입력');
});
