(function(root,factory){'use strict';const api=factory(root.SiteProgress||(typeof module==='object'?require('./progress-core.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.SiteMorning=api;})(globalThis,function(P){
'use strict';
const feedbackStates={done:'완료',partial:'일부 완료',not_done:'미실시'};
const normalizeCompany=s=>String(s||'').normalize('NFKC').replace(/\s/g,'');
function dateFrom(s,asOf){const m=/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*[월화수목금토일]요일)?\s*$/.exec(s);const d=m?[m[1],m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-'):s;if(!P.validDate(d)||d<'2020-01-01'||d>asOf)throw Error('작업일은 YYYY-MM-DD 또는 YYYY년 M월 D일로 입력해 주세요. 미래 날짜는 접수하지 않습니다.');return d;}
function plain(s,max=500){const v=String(s||'').trim();if(!v||v.length>max)throw Error('항목 내용과 길이를 확인해 주세요.');return v;}
function linesOf(text){if(typeof text!=='string'||text.length>12000)throw Error('메시지는 12,000자 이내로 입력해 주세요.');return text.trim().split(/\r?\n/).map(v=>v.trim()).filter(Boolean);}
function count(s){const v=P.quantity(s);if(!Number.isInteger(v)||v>10000)throw Error('인원과 장비 대수는 10,000 이하 정수로 입력해 주세요.');return v;}
function location(text){let s=text.trim(),zone=null,floor=null,detail=null;const z=/^([A-Z]\d{1,2}|전체)\s+/i.exec(s);if(z){zone=z[1].toUpperCase();s=s.slice(z[0].length);}const f=/^(?:B(\d{1,2})F|지하\s*(\d{1,2})\s*층|(\d{1,2})F|(\d{1,2})층)\s+/i.exec(s);if(f){floor=f[1]||f[2]?'지하'+Number(f[1]||f[2])+'층':Number(f[3]||f[4])+'층';s=s.slice(f[0].length);}if(s.startsWith('정반대 ')){detail='정반대';s=s.slice(4);}return {zone,floor,location:detail,description:plain(s)};}
function parseMorning(text,asOf=P.today()){
 const lines=linesOf(text);let revision=false,expected=0;if(['/아침계획','아침계획','/계획수정'].includes(lines[0]))revision=lines.shift()==='/계획수정';
 let work_date=null,company_name=null,section='',total=null,newcomers='',staffing=[],equipment=[],tasks=[],materials=[];
 for(const line of lines){const version=/^계획버전\s*:\s*(\d+)$/.exec(line);if(version){expected=Number(version[1]);continue;}
 if(!work_date&&(/^\d{4}\s*(?:-|년)/.test(line))){work_date=dateFrom(line,asOf);continue;}
 const h=/^(?:\d+\s*[.)]\s*)?(업체명|출력인원|투입인원|장비|작업내용|작업계획|자재반입|신규자)\s*:?\s*(.*)$/.exec(line);
 let value;if(h){section=({투입인원:'출력인원',작업계획:'작업내용'})[h[1]]||h[1];value=h[2].trim();if(!value)continue;}else value=line.replace(/^[-•]\s*/,'').trim();
 if(section==='업체명'){if(company_name)throw Error('업체명은 한 번만 입력해 주세요.');company_name=plain(value,100);}
 else if(section==='출력인원'){const m=/^(.+?)\s*:?\s*(\d[\d,]*)\s*명$/.exec(value);if(!m)throw Error('출력인원은 직종 : 인원명 형태로 입력해 주세요.');const role=m[1].replace(/\s*:$/,'').trim(),n=count(m[2]);if(role==='총원'||role==='합계'){if(total!==null)throw Error('총원은 한 번만 입력해 주세요.');total=n;}else staffing.push({role:plain(role,80),count:n});}
 else if(section==='장비'){const m=/^(.+?)\s+(\d[\d,]*)\s*대$/.exec(value);if(!m)throw Error('장비는 장비명·규격과 대수로 입력해 주세요.');equipment.push({name:plain(m[1],120),count:count(m[2]),unit:'대'});}
 else if(section==='작업내용')tasks.push({no:tasks.length+1,...location(value),raw:plain(value)});
 else if(section==='자재반입'){const loc=location(value),m=/(?:^|\s)(카고|T\/R)\s*(\d[\d,]*)\s*대/i.exec(value);materials.push({...loc,vehicle:m?.[1]||null,vehicle_count:m?count(m[2]):null,raw:plain(value)});}
 else if(section==='신규자')newcomers+=(newcomers?'\n':'')+value;
 else throw Error('날짜와 업체명·출력인원·장비·작업내용·자재반입·신규자 항목으로 메시지를 정리해 주세요.');
 }
 if(!work_date||!company_name||!tasks.length||tasks.length>50||staffing.length>30||equipment.length>50||materials.length>50||newcomers.length>2000)throw Error('작업일·업체명·작업내용을 확인해 주세요. 작업 항목은 최대 50개입니다.');
 if(revision&&expected<1)throw Error('계획 수정에는 계획버전: 현재 버전 번호를 함께 입력해 주세요.');
 if(new Set(staffing.map(x=>x.role)).size!==staffing.length)throw Error('출력인원 분류가 중복되었습니다.');
 if(total!==null&&staffing.length&&total!==staffing.reduce((s,v)=>s+v.count,0))throw Error('총원과 직종별 인원 합계가 다릅니다. 원문을 확인해 주세요.');
 return {work_date,company_name,reported_headcount:total,staffing,equipment,tasks,materials,newcomers,revision,expected};
}
function parseFeedback(text,asOf=P.today()){
 const lines=linesOf(text),revision=['/작업결과수정','작업결과수정'].includes(lines[0]);if(!['/작업결과','작업결과','/작업결과수정','작업결과수정'].includes(lines.shift()))throw Error('첫 줄에 작업결과를 입력해 주세요.');
 const work_date=dateFrom(lines.shift()||'',asOf),version=/^계획버전\s*:\s*(\d+)$/.exec(lines.shift()||'');if(!version||Number(version[1])<1)throw Error('날짜 다음 줄에 계획버전: 번호를 입력해 주세요.');
 let expected_report=0;if(revision){const rv=/^실적버전\s*:\s*(\d+)$/.exec(lines.shift()||'');if(!rv||Number(rv[1])<1)throw Error('작업결과 수정에는 실적버전: 현재 번호를 함께 입력해 주세요.');expected_report=Number(rv[1]);}
 const outcomes=new Map(),rows=[],extras=[];let note='';
 for(const line of lines){if(/^비고\s*:/.test(line)){note+=(note?'\n':'')+line.replace(/^비고\s*:\s*/,'');continue;}const p=line.split(/\s*\/\s*/);if(p[0]==='추가'){if(p.length!==7)throw Error('추가 / 층 / 공구 / 공정 / 수량 / 단위 / 비고 형식으로 입력해 주세요.');const v=P.item({floor:p[1],zone:p[2],process:p[3],quantity:p[4],unit:p[5]});if(v.quantity<=0)throw Error('진행한 작업의 실제 수량은 0보다 커야 합니다.');extras.push(v);if(p[6]&&p[6]!=='-')note+=(note?'\n':'')+'추가 작업: '+p[6];continue;}
 if(p.length!==6||!/^\d+$/.test(p[0]))throw Error('계획번호 / 상태 / 실제 작업 / 수량 / 단위 / 잔여·미실시 사유 형식으로 전송해 주세요.');
 const no=Number(p[0]),state=Object.keys(feedbackStates).find(k=>feedbackStates[k]===p[1]),reason=p[5]==='-'?'':p[5];if(no<1||no>50||!state||reason.length>2000)throw Error('계획번호·상태·사유를 확인해 주세요.');
 if(state!=='done'&&!reason.trim())throw Error('일부 완료와 미실시는 잔여 작업 또는 미실시 사유를 입력해 주세요.');const old=outcomes.get(no);if(old&&(old.state!==state||old.reason!==reason))throw Error('같은 계획번호의 진행 상태와 사유를 통일해 주세요.');outcomes.set(no,{task_no:no,state,reason});
 if(state==='not_done'){if(p.slice(2,5).some(v=>v!=='-'))throw Error('미실시는 실제 작업·수량·단위에 -를 입력해 주세요.');continue;}
 const q=P.quantity(p[3]),u=P.unit(p[4]);if(q<=0||!P.units.includes(u)||(['대','장','부재','공','개','개소'].includes(u)&&!Number.isInteger(q)))throw Error('실제 수량과 단위를 확인해 주세요.');rows.push({task_no:no,process:plain(p[2],80),quantity:q,unit:u});
 }
 if(!outcomes.size||rows.length+extras.length>50||note.length>2000)throw Error('계획별 작업결과를 확인해 주세요. 실적 항목은 최대 50개입니다.');
 return {work_date,expected_plan:Number(version[1]),expected_report,feedback:[...outcomes.values()],rows,extras,note,revision};
}
function validateFeedback(plan,feedback,items){
 const tasks=plan.document.tasks;if(!Array.isArray(feedback)||feedback.length!==tasks.length)throw Error('모든 계획 항목의 작업결과를 입력해 주세요.');const seen=new Set();
 for(const f of feedback){if(seen.has(f.task_no)||!tasks.some(t=>t.no===f.task_no)||!feedbackStates[f.state])throw Error('계획별 진행 상태를 확인해 주세요.');seen.add(f.task_no);if(f.state!=='done'&&!String(f.reason||'').trim())throw Error('잔여 작업 또는 미실시 사유를 입력해 주세요.');const actual=items.filter(v=>v.plan_item===f.task_no);if((f.state==='not_done'&&actual.length)||(f.state!=='not_done'&&!actual.length))throw Error('진행 상태와 실제 수량을 확인해 주세요.');}
 for(const v of items)if(v.quantity<=0||(v.plan_item!=null&&!seen.has(v.plan_item)))throw Error('실제 수량과 연결된 계획번호를 확인해 주세요.');
 return feedback.map(f=>({task_no:f.task_no,state:f.state,reason:String(f.reason||'').trim()}));
}
function help(day=P.today()){return '아침 작업계획은 날짜·업체명·출력인원·장비·작업내용·자재반입·신규자가 있는 메시지를 그대로 보내 주세요.\n\n실적은 아래 양식입니다.\n'+day+'\n층 / 공구 / 공정 / 실제 수량 / 단위\n\n아침 계획의 결과 회신은 회신 안내를 눌러 계획번호와 버전을 확인해 주세요. 실제 수량은 감독자 승인 후 정식 등록됩니다.';}
return {feedbackStates,normalizeCompany,parseMorning,parseFeedback,validateFeedback,help};
});
