/* Read-only daily/weekly reports from saved construction dates. */
(function(root){
'use strict';
const A=root.SiteSlabArea||(typeof require==='function'?require('./site-slab-area.js'):null);
const stages=[
 {id:'prd-drilled',trade:'PRD',stage:'천공',field:'drilled',unit:'공'},
 {id:'prd-delivered',trade:'PRD',stage:'자재 반입',field:'delivered',unit:'공'},
 {id:'prd-installed',trade:'PRD',stage:'시공 완료',field:'installed',unit:'공'},
 {id:'steel-delivered',trade:'철골보',stage:'자재 반입',field:'delivered',unit:'부재'},
 {id:'steel-completed',trade:'철골보',stage:'설치 완료',field:'completed',unit:'부재'},
 {id:'slab-decked',trade:'슬래브',stage:'데크 판개',field:'decked',unit:'m²'},
 {id:'slab-reinforced',trade:'슬래브',stage:'철근 설치',field:'reinforced',unit:'m²'},
 {id:'slab-completed',trade:'슬래브',stage:'타설 완료',field:'completed',unit:'m²'}
];
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s;}
function monday(s){if(!validDate(s))throw Error('기준일을 확인해 주세요.');const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
function summarize(snapshot,start,end){
 if(!validDate(start)||!validDate(end)||start>end)throw Error('실적 기간을 확인해 주세요.');
 if(end>snapshot.asOf)throw Error('종료일은 오늘 이후로 지정할 수 없습니다.');
 const summary=stages.map(s=>({...s,period:0,cumulative:0,undated:0})),byId=new Map(summary.map(s=>[s.id,s]));
 const grouped=new Map(),daily=new Map(),details=[],missing=[];
 const inPeriod=d=>validDate(d)&&d>=start&&d<=end;
 const group=(s,floor,zone)=>{const key=[s.id,floor,zone].join('\0');if(!grouped.has(key))grouped.set(key,{...s,floor,zone,period:0,cumulative:0,undated:0});return grouped.get(key);};
 const day=(s,date,floor,zone)=>{const key=[date,s.id,floor,zone].join('\0');if(!daily.has(key))daily.set(key,{...s,date,floor,zone,quantity:0});return daily.get(key);};
 const count=(s,item,r,floor)=>{
  const b=byId.get(s.id),z=group(s,floor,item.zone||'미분류'),d=r[s.field],known=validDate(d);
  if(known&&d<=end){b.cumulative++;z.cumulative++;}
  const label=r.label||item.label||item.key;
  if(inPeriod(d)){b.period++;z.period++;day(s,d,floor,z.zone).quantity++;details.push({...s,date:d,floor,zone:z.zone,label,quantity:1,note:r.note||''});}
  if(d&&!known||s.id==='steel-completed'&&r.installation_complete===true&&!d){b.undated++;z.undated++;missing.push({...s,floor,zone:z.zone,label,quantity:1,note:r.note||'',reason:d?'날짜 확인 필요':'완료일 미입력'});}
 };
 const prd=snapshot.prd||{items:[],records:{}};
 for(const item of prd.items)for(const s of stages.slice(0,3))count(s,item,prd.records[item.key]||{},'');
 for(const plan of snapshot.plans||[]){
  const floor=plan.name,records=plan.records||[],steel=Object.fromEntries(records.filter(r=>r.trade==='steel').map(r=>[r.item_key,r]));
  for(const item of plan.drawing.members)if(!plan.visibility?.[item.key]?.hidden)for(const s of stages.slice(3,5))count(s,item,steel[item.key]||{},floor);
  if(plan.drawing.slabsReady===false)continue;
  const slabs=Object.fromEntries(records.filter(r=>r.trade==='slab').map(r=>[r.item_key,r])),items=plan.drawing.slabs,zones=plan.drawing.zones;
  // Retain all slab kinds/openings; only the dated stage is filtered. Ongoing
  // reinforcement has no completion date and must not become a daily actual.
  const areaFor=(s,predicate)=>A.summarize(zones,items,Object.fromEntries(items.map(v=>{const r=slabs[v.key]||{};return [v.key,{slab_kind:r.slab_kind,[s.field]:predicate(r[s.field],v.key)?'1':''}];})));
  for(const s of stages.slice(5)){
   const b=byId.get(s.id),before=areaFor(s,d=>validDate(d)&&d<start),c=areaFor(s,d=>validDate(d)&&d<=end),u=areaFor(s,d=>!!d&&!validDate(d));
   b.period+=Math.max(0,c.area[s.field]-before.area[s.field]);b.cumulative+=c.area[s.field];b.undated+=u.area[s.field];
   for(const zone of zones){const z=group(s,floor,zone.id);z.period+=Math.max(0,c.byZone[zone.id][s.field]-before.byZone[zone.id][s.field]);z.cumulative+=c.byZone[zone.id][s.field];z.undated+=u.byZone[zone.id][s.field];}
   // Allocate only newly completed area in date/key order. This keeps daily
   // totals equal to the period total even when legacy regions overlap.
   const dated=items.filter(v=>A.kind(slabs[v.key])!=='opening'&&inPeriod(slabs[v.key]?.[s.field])).sort((a,b)=>slabs[a.key][s.field].localeCompare(slabs[b.key][s.field])||a.key.localeCompare(b.key));
   const accepted=new Set();let previous=before;
   for(const item of dated){const r=slabs[item.key],d=r[s.field];accepted.add(item.key);const a=areaFor(s,(date,key)=>validDate(date)&&(date<start||accepted.has(key))),zoneNames=[];
    for(const zone of zones){const qty=Math.max(0,a.byZone[zone.id][s.field]-previous.byZone[zone.id][s.field]);if(qty>1e-8){day(s,d,floor,zone.id).quantity+=qty;zoneNames.push(zone.id);}}
    details.push({...s,date:d,floor,zone:zoneNames.join(' / ')||item.zone||'미분류',label:r.label||item.key,quantity:Math.max(0,a.area[s.field]-previous.area[s.field]),note:r.note||''});previous=a;
   }
   for(const item of items){const r=slabs[item.key]||{},d=r[s.field];if(A.kind(r)==='opening'||!d||validDate(d))continue;const a=areaFor(s,(_,key)=>key===item.key),quantity=a.area[s.field];if(quantity>0)missing.push({...s,floor,zone:Object.keys(a.byZone).filter(z=>a.byZone[z][s.field]>0).join(' / '),label:r.label||item.key,quantity,note:r.note||'',reason:'날짜 확인 필요'});}
  }
 }
 const sort=(a,b)=>(a.date||'').localeCompare(b.date||'')||a.id.localeCompare(b.id)||a.floor.localeCompare(b.floor)||a.zone.localeCompare(b.zone,undefined,{numeric:true})||(a.label||'').localeCompare(b.label||'',undefined,{numeric:true});
 return {start,end,asOf:snapshot.asOf,summary,zones:[...grouped.values()].sort(sort),daily:[...daily.values()].sort(sort),details:details.sort(sort),missing:missing.sort(sort)};
}
function build(ExcelJS,m){
 const book=new ExcelJS.Workbook();book.creator='서리풀 사이트원';
 const add=(name,headers,rows)=>{const ws=book.addWorksheet(name);ws.addRows([['서리풀 : 남측 · 공종별 실적 보고'],['실적 기간',m.start+' ~ '+m.end,'집계 기준일',m.asOf],headers,...rows]);ws.getRow(1).font={name:'맑은 고딕',size:15,bold:true};ws.getRow(3).eachCell(c=>{c.font={name:'맑은 고딕',bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF215F8D'}};});ws.columns.forEach(c=>{c.width=22;});ws.eachRow(r=>{r.height=28;r.alignment={vertical:'middle',wrapText:true};});ws.views=[{state:'frozen',ySplit:3}];ws.autoFilter={from:{row:3,column:1},to:{row:Math.max(3,ws.rowCount),column:headers.length}};return ws;};
 const summary=add('공종별 실적',['공종','공정','단위','기간 실적','종료일 누계','날짜 미입력·확인 필요'],m.summary.map(s=>[s.trade,s.stage,s.unit,s.period,s.cumulative,s.undated]));
 const zones=add('층·공구별 실적',['공종','공정','층','공구','단위','기간 실적','종료일 누계','날짜 미입력·확인 필요'],m.zones.map(s=>[s.trade,s.stage,s.floor,s.zone,s.unit,s.period,s.cumulative,s.undated]));
 const daily=add('일별 실적',['시공일','공종','공정','층','공구','단위','실적'],m.daily.map(s=>[new Date(s.date+'T00:00:00Z'),s.trade,s.stage,s.floor,s.zone,s.unit,s.quantity]));
 const detail=add('기간 시공기록',['시공일','공종','공정','층','공구','부재·영역 이름','단위','실적','메모'],m.details.map(s=>[new Date(s.date+'T00:00:00Z'),s.trade,s.stage,s.floor,s.zone,s.label,s.unit,s.quantity,s.note]));
 const missing=add('날짜 확인',['공종','공정','층','공구','부재·영역 이름','단위','수량','확인 사항','메모'],m.missing.map(s=>[s.trade,s.stage,s.floor,s.zone,s.label,s.unit,s.quantity,s.reason,s.note]));
 for(const [ws,unit,columns] of [[summary,3,[4,5,6]],[zones,5,[6,7,8]],[daily,6,[7]],[detail,7,[8]],[missing,6,[7]]])ws.eachRow((r,i)=>{if(i<=3)return;r.font={name:'맑은 고딕',size:11};for(const c of columns)r.getCell(c).numFmt=r.getCell(unit).value==='m²'?'#,##0.0':'#,##0';});
 for(const ws of [daily,detail])ws.getColumn(1).numFmt='yyyy-mm-dd';detail.getColumn(9).width=50;missing.getColumn(9).width=50;
 return book;
}
async function download(model,stillAllowed){const ExcelJS=await root.PRDExport.loadLibrary();if(!stillAllowed())return false;const buffer=await build(ExcelJS,model).xlsx.writeBuffer();if(!stillAllowed())return false;const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');link.href=url;link.download=`사이트원_공종별실적_${model.start}_${model.end}.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return true;}
root.SiteReports={stages,validDate,monday,summarize,build,download};if(typeof module!=='undefined')module.exports=root.SiteReports;
})(globalThis);
