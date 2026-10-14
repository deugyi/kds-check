(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SiteProgress=api;})(globalThis,function(){
'use strict';
const units=['m³','m²','t','대','장','부재','공','개','m','개소'];
const states={pending:'감독자 승인 대기',returned:'보완 요청',approved:'승인됨'};
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const [y,m,d]=s.split('-').map(Number),v=new Date(Date.UTC(y,m-1,d));return v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d;}
function unit(s){return ({m3:'m³','㎥':'m³','루베':'m³',m2:'m²','㎡':'m²',ton:'t','톤':'t'})[String(s).trim().toLowerCase()]||String(s).trim();}
function quantity(value){const s=String(value).trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(s))throw Error('수량은 0 이상의 숫자로 입력해 주세요. 소수점은 셋째 자리까지 사용할 수 있습니다.');const n=Number(s.replaceAll(',',''));if(!Number.isFinite(n)||n>1e9)throw Error('수량 범위를 확인해 주세요.');return n;}
function item(v){const r={floor:String(v.floor||'').trim(),zone:String(v.zone||'').trim(),process:String(v.process||'').trim(),quantity:quantity(v.quantity),unit:unit(v.unit)};
 if(!r.floor||r.floor.length>50||!r.zone||r.zone.length>50||!r.process||r.process.length>80||!units.includes(r.unit))throw Error('층·공구·공정·단위를 확인해 주세요. 위치가 없으면 전체 또는 외부로 입력할 수 있습니다.');
 if(['대','장','부재','공','개','개소'].includes(r.unit)&&!Number.isInteger(r.quantity))throw Error('대·장·부재·공·개·개소 수량은 정수로 입력해 주세요.');return r;}
function validate(v,asOf=today()){if(!validDate(v.work_date)||v.work_date<'2020-01-01'||v.work_date>asOf)throw Error('작업일을 확인해 주세요. 미래 날짜는 등록할 수 없습니다.');
 const note=String(v.note||'').trim();if(note.length>2000)throw Error('비고는 2,000자 이내로 입력해 주세요.');const no_work=v.no_work===true;
 if(!Array.isArray(v.items)||v.items.length>50||(!no_work&&!v.items.length)||(no_work&&v.items.length))throw Error('실적 항목을 입력하거나 작업 없음을 선택해 주세요.');
 return {work_date:v.work_date,no_work,note,items:v.items.map(item)};}
function parseMessage(text,asOf=today()){if(typeof text!=='string'||text.length>12000)throw Error('메시지는 12,000자 이내로 전송해 주세요.');const lines=text.trim().split(/\r?\n/).map(v=>v.trim()).filter(Boolean);let revision=false;
 if(['/실적','/수정'].includes(lines[0]))revision=lines.shift()==='/수정';
 const work_date=lines.shift(),items=[];let no_work=false,note='';
 for(const line of lines){if(/^작업\s*없음$/.test(line)){no_work=true;continue;}if(/^(비고|특이사항)\s*:/.test(line)){note+=(note?'\n':'')+line.replace(/^(비고|특이사항)\s*:\s*/,'');continue;}
 const p=line.split(/[|/]/).map(v=>v.trim());if(p.length!==5)throw Error('실적은 층 / 공구 / 공정 / 수량 / 단위 순서로 전송해 주세요.');items.push({floor:p[0],zone:p[1],process:p[2],quantity:p[3],unit:p[4]});}
 return {...validate({work_date,items,no_work,note},asOf),revision};}
function approved(reports,start,end){if(!validDate(start)||!validDate(end)||start>end)throw Error('조회 기간을 확인해 주세요.');const seen=new Set();return reports.filter(r=>{if(r.state!=='approved'||r.work_date<start||r.work_date>end||seen.has(r.id))return false;seen.add(r.id);return true;});}
function summarize(reports,start,end){const map=new Map();for(const r of approved(reports,start,end)){if(r.no_work)continue;for(const v of r.items){const k=v.process+'\0'+v.unit;if(!map.has(k))map.set(k,{process:v.process,unit:v.unit,quantity:0});map.get(k).quantity+=Number(v.quantity);}}return [...map.values()].map(v=>({...v,quantity:Math.round(v.quantity*1000)/1000})).sort((a,b)=>a.process.localeCompare(b.process,'ko')||a.unit.localeCompare(b.unit));}
function dailyStates(reports,companyId,day){const rs=reports.filter(r=>r.company_id===companyId&&r.work_date===day);return ['approved','pending','returned'].map(state=>({state,count:rs.filter(r=>r.state===state).length})).filter(v=>v.count);}
function help(day=today()){return '다음 양식으로 실적을 전송해 주세요.\n\n'+day+'\n외부 / 전체 / 토사 반출 / 120 / m3\n지하1층 / B2 / 데크 슬래브 / 50 / 장\n지하1층 / B2 / 철골보 / 20 / 부재\n지하1층 / B2 / 콘크리트 타설 / 35 / m3\n비고: 특이사항 없음\n\n위 수량은 양식 예시입니다. 실제 날짜와 실적으로 바꿔 주세요.\n같은 날짜에도 다른 공종은 별도 메시지로 추가할 수 있습니다. 같은 공종의 층·공구별 항목은 한 메시지에 모아 주세요.\n작업이 없는 날: 날짜 다음 줄에 작업 없음\n기존 실적 수정: 첫 줄에 /수정 추가 후 기존 건에 포함된 공종의 전체 항목 전송\n접수 후 상태는 감독자 승인 대기입니다. 감독자가 승인하면 승인됨으로 표시되고 정식 등록됩니다.';}
async function workbook(ExcelJS,reports,companies,start,end,plans=[]){const wb=new ExcelJS.Workbook(),names=new Map(companies.map(c=>[c.id,c.name]));wb.creator='사이트원';
 const sheet=(name,headers,widths)=>{const s=wb.addWorksheet(name);s.addRow(['공정별 진행현황']);s.addRow([start+' ~ '+end+' · 감독자 승인 실적 기준']);s.addRow(headers);s.views=[{state:'frozen',ySplit:3}];headers.forEach((h,i)=>s.getColumn(i+1).width=widths[i]||18);s.getRow(3).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF245A83'}};return s;};
 const summary=sheet('공정별 실적',['공정','수량','단위'],[25,18,12]);for(const v of summarize(reports,start,end))summary.addRow([v.process,v.quantity,v.unit]);summary.getColumn(2).numFmt='#,##0.###';
 const byCompany=sheet('업체별 실적',['업체','공정','수량','단위'],[25,25,18,12]);for(const c of companies)for(const v of summarize(reports.filter(r=>r.company_id===c.id),start,end))byCompany.addRow([c.name,v.process,v.quantity,v.unit]);byCompany.getColumn(3).numFmt='#,##0.###';
 const details=sheet('승인 실적 목록',['작업일','업체','층','공구','공정','수량','단위','비고','접수 경로','감독자 승인 시각','승인 상태','계획 항목번호'],[14,25,15,12,24,16,10,45,14,24,18,18]);
 for(const r of approved(reports,start,end)){const date=new Date(r.work_date+'T00:00:00Z'),base=v=>[date,names.get(r.company_id)||'업체',v.floor||'',v.zone||'',r.no_work?'작업 없음':v.process,v.quantity??'',v.unit||'',r.note||'',r.source==='telegram'?'텔레그램':r.source==='kakao'?'카카오톡':'사이트원',r.reviewed_at?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'medium'}).format(new Date(r.reviewed_at)): '',states[r.state],v.plan_item??''];
 if(r.no_work)details.addRow(base({}));else for(const v of r.items)details.addRow(base(v));}
 details.getColumn(1).numFmt='yyyy-mm-dd';details.getColumn(6).numFmt='#,##0.###';
 const linked=approved(reports,start,end).filter(r=>r.plan_id&&r.task_feedback?.length);
 if(linked.length){const results=sheet('계획별 작업결과',['작업일','업체','계획 항목번호','예정 작업','작업 결과','잔여·미실시 사유','승인 상태'],[14,25,18,40,18,45,18]);for(const r of linked){const p=plans.find(v=>v.id===r.plan_id);for(const f of r.task_feedback)results.addRow([new Date(r.work_date+'T00:00:00Z'),names.get(r.company_id)||'업체',f.task_no,p?.document.tasks.find(t=>t.no===f.task_no)?.description||'',({done:'완료',partial:'일부 완료',not_done:'미실시'})[f.state]||f.state,f.reason||'',states[r.state]]);}results.getColumn(1).numFmt='yyyy-mm-dd';}
 for(const s of wb.worksheets){s.autoFilter={from:{row:3,column:1},to:{row:Math.max(s.rowCount,3),column:s.columnCount}};s.eachRow((row,n)=>{if(n!==3)row.font={name:'맑은 고딕',size:11};row.alignment={vertical:'top',wrapText:true};});}return wb;}
return {units,states,today,validDate,unit,quantity,item,validate,parseMessage,approved,summarize,dailyStates,help,workbook};
});
