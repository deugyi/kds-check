/* PRD DXF import and local progress data. No network or external drawing services. */
(function(root){
'use strict';
const layers={number:'-col_number',name:'-col_name',type:'-col_type',reaction:'-col_reaction'};
const stages=[['planned','미착수','#aeb9c2'],['drilled','천공 완료','#438bd0'],['delivered','자재 반입','#dba238'],['ready','천공·반입 완료','#8d70c8'],['installed','시공 완료','#269b76']];
function text(v){return String(v||'').replace(/\\U\+([0-9a-f]{4})/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).trim();}
function parse(source){
 if(source.startsWith('AutoCAD Binary DXF'))throw Error('바이너리 DXF는 지원하지 않습니다. ASCII DXF로 저장해 주세요.');
 const lines=source.replace(/^\uFEFF/,'').split(/\r?\n/), entities=[];let section='',entity=null,unit=0;
 for(let i=0;i+1<lines.length;i+=2){
  const code=Number(lines[i].trim()),value=lines[i+1].trim();
  if(!Number.isInteger(code))throw Error('DXF 그룹 코드 형식을 확인해 주세요.');
  if(code===9&&value==='$INSUNITS'&&Number(lines[i+2])===70)unit=Number(lines[i+3]);
  if(code===0&&value==='SECTION'){section=lines[i+3]?.trim();continue;}
  if(code===0){
   if(entity)entities.push(entity);entity=null;
   if(value==='ENDSEC'){section='';continue;}
   if(section==='ENTITIES'&&value!=='EOF')entity={kind:value,groups:[]};
  }else if(entity)entity.groups.push([code,value]);
 }
 if(entity)entities.push(entity);
 if(unit!==0&&unit!==4)throw Error('현재 PRD 도면은 mm 단위 DXF를 지원합니다. 도면 단위를 확인해 주세요.');
 const get=(e,c,f='')=>e.groups.find(p=>p[0]===c)?.[1]??f, num=(e,c,f=0)=>Number(get(e,c,f));
 const piles=[], labels={}, paths=[], ignored={};let unsupported=0;
 Object.values(layers).forEach(k=>labels[k]=[]);
 for(const e of entities){
  if(num(e,67)===1)continue;
  const layer=text(get(e,8)),handle=get(e,5);
  if(e.kind==='CIRCLE'){
   const x=num(e,10,NaN),y=num(e,20,NaN),radius=num(e,40,NaN);
   if(![x,y,radius].every(Number.isFinite)||radius<=0)throw Error('잘못된 원 좌표 또는 반지름이 있습니다.');
   if(Math.abs(num(e,230,1)-1)>1e-6)throw Error('XY 평면에 놓인 공 형상만 지원합니다.');
   const diameter=Number(layer.match(/(?:Φ|φ|Ø|ø|%%[cC])\s*(\d+(?:\.\d+)?)/)?.[1])||null;
   if(handle&&!/^[a-f0-9]+$/i.test(handle))throw Error('DXF 객체 식별자 형식을 확인해 주세요.');
   piles.push({key:handle||'circle-'+piles.length,x,y,radius,layer,diameter,number:[],name:[],type:[],reaction:[],warnings:[]});
  }else if(e.kind==='TEXT'&&labels[layer]){
   const aligned=num(e,72)!==0||num(e,73)!==0;
   const x=num(e,aligned?11:10,NaN),y=num(e,aligned?21:20,NaN);
   if(![x,y].every(Number.isFinite))throw Error('문자의 위치 기준점을 읽을 수 없습니다.');
   labels[layer].push({x,y,value:text(get(e,1))});
  }else if(e.kind==='LWPOLYLINE'&&['-perimeter','-zoning'].includes(layer)){
   const points=[];let p;
   for(const [c,v] of e.groups){if(c===10){p=[Number(v),0];points.push(p);}if(c===20&&p)p[1]=Number(v);if(c===42&&Number(v)!==0)unsupported++;}
   if(points.some(p=>!p.every(Number.isFinite)))throw Error('구역 좌표를 확인해 주세요.');
   paths.push({layer,points,closed:!!(num(e,70)&1)||!!(points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.1)});
  }else {ignored[e.kind]=(ignored[e.kind]||0)+1;}
 }
 if(!piles.length)throw Error('모형 공간에 CIRCLE 공 형상이 없습니다. 블록은 분해한 뒤 저장해 주세요.');
 if(piles.length>5000)throw Error('현재 버전은 공 5,000개까지 지원합니다.');
 if(new Set(piles.map(p=>p.key)).size!==piles.length)throw Error('중복 객체 식별자가 있습니다. DXF를 다시 저장해 주세요.');
 if(!labels[layers.number].length)throw Error('공 번호 레이어 -col_number의 TEXT 문자가 필요합니다.');
 let unlinked=0;
 for(const [field,layer] of Object.entries(layers))for(const t of labels[layer]){
  let near=null,dist=Infinity,second=Infinity;
  for(const p of piles){const d=Math.hypot(t.x-p.x,t.y-p.y);if(d<dist){second=dist;dist=d;near=p;}else if(d<second)second=d;}
  // Do not force a one-to-one assignment: misplaced text must remain visible as a warning.
  if(dist>Math.max(near.radius*3,2000)){unlinked++;continue;}
  near[field].push(t.value);if(dist/second>.8)near.warnings.push('문자 연결 위치 확인');
 }
 const ids=new Map();for(const p of piles)for(const n of p.number)ids.set(n,(ids.get(n)||0)+1);
 for(const p of piles){
  if(p.number.length!==1)p.warnings.push(p.number.length?'번호가 여러 개 연결됨':'번호 연결 없음');
  if(p.number.some(n=>ids.get(n)>1))p.warnings.push('다른 공과 번호 중복');
  if(p.name.length>1)p.warnings.push('부재명 여러 개');
  p.warnings=[...new Set(p.warnings)];
 }
 const xs=piles.map(p=>p.x),ys=piles.map(p=>p.y),ox=Math.min(...xs),oy=Math.min(...ys);
 for(const p of piles){p.x-=ox;p.y-=oy;}
 for(const path of paths)path.points=path.points.map(([x,y])=>[x-ox,y-oy]);
 return {piles,paths,origin:[ox,oy],units:'mm',warnings:[...(unit===0?['도면 단위 미지정: mm로 해석했습니다.']:[]),...(unlinked?[`연결하지 못한 문자 ${unlinked}개`]:[]),...(ignored.INSERT?['블록 내부 객체는 읽지 않습니다. 블록을 분해해 주세요.']:[]),...(unsupported?['곡선 구역선은 직선으로 표시됩니다.']:[])],ignored};
}
function decode(buffer){
 const peek=new TextDecoder('ascii').decode(buffer.slice(0,20000));
 let utf8=true;try{new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{utf8=false;}
 return new TextDecoder(utf8?'utf-8':/ANSI_949|ANSI_1361/.test(peek)?'euc-kr':'windows-1252').decode(buffer);
}
function status(record={}){return record.installed?'installed':record.drilled&&record.delivered?'ready':record.drilled?'drilled':record.delivered?'delivered':'planned';}
function validDate(v){if(v==='')return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
function record(input){
 const out={};for(const k of ['drilled','delivered','installed']){out[k]=String(input[k]||'');if(!validDate(out[k]))throw Error('날짜 형식을 확인해 주세요.');}
 out.note=String(input.note||'').slice(0,2000);
 if(out.installed&&[out.drilled,out.delivered].some(d=>d&&d>out.installed))throw Error('시공 일자는 천공·자재 반입 일자보다 빠를 수 없습니다.');
 return out;
}
function validate(data){
 if(data?.version!==1||!/^[a-f0-9]{64}$/.test(data.id)||typeof data.filename!=='string'||!Array.isArray(data.drawing?.piles)||!data.drawing.piles.length||data.drawing.piles.length>5000||!Array.isArray(data.drawing.paths))throw Error('지원하는 PRD 백업 파일이 아닙니다.');
 const keys=new Set();for(const p of data.drawing.piles){
  if(typeof p.key!=='string'||!/^(?:[a-f0-9]+|circle-\d+)$/i.test(p.key)||keys.has(p.key)||![p.x,p.y,p.radius].every(Number.isFinite)||p.radius<=0)throw Error('공 형상 또는 식별자가 올바르지 않습니다.');keys.add(p.key);
  for(const k of ['number','name','type','reaction','warnings'])if(!Array.isArray(p[k])||p[k].some(v=>typeof v!=='string'))throw Error('공 정보 형식을 확인해 주세요.');
 }
 for(const p of data.drawing.paths)if(!Array.isArray(p.points)||p.points.some(x=>!Array.isArray(x)||x.length!==2||!x.every(Number.isFinite)))throw Error('구역 형식이 올바르지 않습니다.');
 if(!Array.isArray(data.drawing.warnings))throw Error('도면 정보 형식을 확인해 주세요.');
 const records={};for(const [k,v] of Object.entries(data.records||{})){if(!keys.has(k))throw Error('도면에 없는 공의 기록이 있습니다.');records[k]=record(v);}
 return {...data,records};
}
root.PRD={parse,decode,stages,status,record,validate};
if(typeof module!=='undefined')module.exports=root.PRD;
})(globalThis);
