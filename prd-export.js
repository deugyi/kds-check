/* Browser-side XLSX export. No drawing or record data leaves the browser. */
(function(root){
'use strict';
let library;
function loadLibrary(){
 if(root.ExcelJS)return Promise.resolve(root.ExcelJS);
 if(!library)library=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='vendor/exceljs-4.4.0.min.js';
  script.onload=()=>{if(root.ExcelJS)resolve(root.ExcelJS);else{library=null;script.remove();reject(Error('엑셀 기능을 불러오지 못했습니다. 다시 시도해 주세요.'));}};
  script.onerror=()=>{library=null;script.remove();reject(Error('엑셀 기능을 불러오지 못했습니다. 다시 시도해 주세요.'));};
  document.head.appendChild(script);
 });
 return library;
}
const zoneName=id=>id==='unassigned'?'미분류':id;
const date=value=>value?new Date(value+'T00:00:00Z'):null;
function sheet(book,name,widths,headers,rows){
 const ws=book.addWorksheet(name,{views:[{state:'frozen',ySplit:4}],pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
 ws.columns=widths.map(width=>({width}));
 ws.mergeCells(1,1,1,headers.length);ws.getCell(1,1).value='서리풀 : 남측 · PRD · '+name;
 ws.getRow(1).font={name:'맑은 고딕',size:16,bold:true,color:{argb:'FF215F8D'}};ws.getRow(1).height=30;
 ws.addRow([]);ws.addRow([]);ws.getRow(4).values=headers;ws.getRow(4).height=28;
 for(const values of rows)ws.addRow(values);
 ws.eachRow((row,n)=>{if(n===1)return;row.font={name:'맑은 고딕',size:11};row.alignment={vertical:'middle',wrapText:true};if(n>4)row.height=30;});
 ws.getRow(4).eachCell(c=>{c.font={name:'맑은 고딕',size:11,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF215F8D'}};});
 ws.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,ws.rowCount),column:headers.length}};
 ws.pageSetup.printTitlesRow='1:4';
 return ws;
}
function build(ExcelJS,snapshot){
 const {piles,records,zones,scope,filter,asOf}=snapshot;
 const m=root.PRDDashboard.summarize(piles,records,zones,asOf);
 const book=new ExcelJS.Workbook();book.creator='서리풀 현장';book.created=new Date();
 const a=m.all;
 const summary=sheet(book,'공구별 집계',[18,16,16,16,16,16,16],['공구','전체 공수','천공 기록','자재 반입','시공 완료','잔여 공수','시공 완료율'],
  [['합계',a.total,a.drilled,a.delivered,a.installed,a.remaining,a.percent/100],...m.zones.filter(z=>z.total).map(z=>[zoneName(z.id),z.total,z.drilled,z.delivered,z.installed,z.remaining,z.percent/100])]);
 const stageNames=Object.fromEntries(root.PRD.stages.map(s=>[s[0],s[1]]));
 const rows=piles.map(p=>{const r=records[p.key]||{};return [p.number.join(' / ')||'번호 미연결',zoneName(zones.membership[p.key]||'unassigned'),p.name.join(' / '),p.type.join(' / '),Number.isFinite(p.diameter)?p.diameter:p.layer,stageNames[root.PRD.status(r)],date(r.drilled),date(r.delivered),date(r.installed),r.note||''];});
 const detail=sheet(book,'공별 기록',[20,12,18,18,20,20,16,16,18,55],['공 번호','공구','부재명','타입','공 직경(mm)','상태','천공일','자재 반입일','타설일(완료일)','메모'],rows);
 const weekly=sheet(book,'주간 실적',[18,18,16,16],['시작일','종료일','천공 (공)','시공 완료 (공)'],m.weeks.map(w=>[date(w.start),date(w.end),w.drilled,w.installed]));
 const extra=[],checks=[];
 for(const p of piles){const d=root.PRDMaterials?.read(snapshot.materials?.[p.key]);if(!d)continue;const number=p.number.join(' / '),zone=zoneName(zones.membership[p.key]||'unassigned'),source=`${d.source.file} · ${d.source.sheet} ${d.source.row}행`;
  for(const f of d.fields)extra.push([number,zone,f.group,f.label,f.date?date(f.date):f.value,f.qualifier,source,f.cell]);
  for(const i of d.issues)checks.push([number,zone,i.kind,i.field,i.source,i.existing,i.action,source]);
 }
 const material=extra.length?sheet(book,'자재·검측 상세',[18,10,10,38,34,28,46,12],['공 번호','공구','분류','항목','원본 값','설명','원본 위치','셀'],extra):null;
 const review=checks.length?sheet(book,'원본 대조 확인',[18,10,28,26,35,25,65,46],['공 번호','공구','확인 종류','항목','원본','기존','처리·확인 사항','원본 위치'],checks):null;
 for(const ws of [summary,detail,weekly,material,review].filter(Boolean)){
  ws.mergeCells(2,1,2,ws.columnCount);ws.getCell(2,1).value=`기준일 ${asOf} · 공구: ${scope} · 상태: ${filter} · 내보낸 기록 ${piles.length}공`;
  ws.mergeCells(3,1,3,ws.columnCount);ws.getCell(3,1).value=ws===weekly?'최근 8주 월요일~일요일 · 기준일 이후 실적 제외':ws===material||ws===review?'근입일은 타설일과 별도입니다. 원본 날짜와 기존 기록이 다르면 확인 전까지 기존 기록을 유지합니다.':'다운로드 시점의 저장 기록 · 날짜가 비어 있으면 미입력 · 자재 반입 미입력은 미반입을 뜻하지 않습니다.';
  ws.getRow(3).font={name:'맑은 고딕',size:10,color:{argb:'FF667085'}};ws.getRow(3).height=30;
 }
 summary.getColumn(7).numFmt='0.0%';
 for(const c of [7,8,9])detail.getColumn(c).numFmt='yyyy-mm-dd';
 for(const c of [1,2])weekly.getColumn(c).numFmt='yyyy-mm-dd';
 if(material)material.getColumn(5).eachCell((c,n)=>{if(n>4&&c.value instanceof Date)c.numFmt='yyyy-mm-dd';});
 return book;
}
async function download(snapshot,stillAllowed){
 const ExcelJS=await loadLibrary();if(!stillAllowed())return false;
 const book=build(ExcelJS,snapshot),buffer=await book.xlsx.writeBuffer();
 if(!stillAllowed())return false;
 const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=`서리풀_남측_PRD_${snapshot.scope}_${snapshot.asOf}.xlsx`;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);return true;
}
root.PRDExport={build,download,loadLibrary};if(typeof module!=='undefined')module.exports=root.PRDExport;
})(globalThis);
