/* Design-load schedule adapted from the supplied Rev01 workbook.
 * Material defaults are template assumptions, not a table of KDS-mandated values.
 * Source: 01-마감표!A3:C23; 02-설계하중표!D6:I12.
 */
(function(root){'use strict';
const MATERIALS=[
 ['rc','콘크리트 슬래브','volume',24],['plain','무근콘크리트','volume',23],
 ['epoxy','에폭시 페인트','area',.05],['ceiling','천정','area',.2],
 ['stone','석재마감','volume',27],['mortar','몰탈','volume',20],
 ['water','물','volume',10],['eps','EPS 블럭','area',.1],['finish','마감','area',1],
 ['pad','장비패드','volume',24],['light','경량기포콘크리트','volume',10],
 ['partition','경량칸막이','area',1],['waterproof','방수층','area',.1],
 ['cushion','완충재','area',.1],['soil','흙','volume',18],['deck','데크 플레이트','area',.2],
 ['ceiling-multi','천정 (다단)','area',1.5],['tile','타일','area',.5],
 ['mat','방진매트','volume',15],['access','엑세스 플로어','area',.6],['drain','배수판','volume',12.5]
].map(([id,name,mode,value])=>Object.freeze({id,name,mode,value}));
Object.freeze(MATERIALS);
const clone=v=>JSON.parse(JSON.stringify(v));
function example(){return {use:'지붕층 바닥 (옥탑지붕층)',content:'태양광 설치',remark:'',live:3,layers:[
 {material:'plain',thickness:100},{material:'waterproof',thickness:0},
 {material:'rc',thickness:150},{material:'ceiling',thickness:0}
]};}
function initial(){return {version:1,project:'',materials:clone(MATERIALS),cases:[example()]};}
function nonnegative(v,label){if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error(label+'은 0 이상의 숫자로 입력하세요.');return v;}
function text(v,label,required=false){if(typeof v!=='string'||v.length>200||(required&&!v.trim()))throw Error(label+'을 200자 이내로 입력하세요.');}
function catalog(items){
 if(!Array.isArray(items)||!items.length||items.length>100)throw Error('마감재는 1~100개로 구성하세요.');
 const map=new Map();for(const m of items){
  if(!m||typeof m.id!=='string'||!m.id||map.has(m.id))throw Error('마감재 식별자가 중복되거나 없습니다.');
  text(m.name,'마감재 이름',true);
  if(!['volume','area'].includes(m.mode))throw Error('마감재 계산 방식을 확인하세요.');
  nonnegative(m.value,m.name+' 기준값');map.set(m.id,m);
 }return map;
}
function calculate(item,materials){
 const map=materials instanceof Map?materials:catalog(materials);
 if(!item)throw Error('하중표를 확인하세요.');
 text(item.use,'용도',true);text(item.content,'내용');text(item.remark,'비고');nonnegative(item.live,'활하중 L');
 if(!Array.isArray(item.layers)||!item.layers.length||item.layers.length>12)throw Error('고정하중 항목은 1~12개로 구성하세요.');
 const rows=item.layers.map((v,i)=>{
  const m=map.get(v.material);if(!m)throw Error((i+1)+'번째 마감재를 선택하세요.');
  // An explicit material mode replaces the Excel blank/zero-thickness switch.
  // Missing thickness must never silently remove a volume material's load.
  const h=m.mode==='volume'?nonnegative(v.thickness,m.name+' 두께'):0;
  const q=m.mode==='volume'?h/1000*m.value:m.value;
  if(!Number.isFinite(q))throw Error('계산 가능한 크기의 두께·기준값을 입력하세요.');
  return {material:m.id,name:m.name,mode:m.mode,value:m.value,thickness:h,q};
 });
 const D=rows.reduce((sum,v)=>sum+v.q,0),L=item.live,service=D+L,u12=1.2*D+1.6*L,u14=1.4*D,qu=Math.max(u12,u14);
 if(![D,service,u12,u14,qu].every(Number.isFinite))throw Error('계산 가능한 크기의 하중을 입력하세요.');
 return {...item,rows,D,L,service,u12,u14,qu,governing:u14>u12?'1.4D':'1.2D + 1.6L'};
}
function schedule(state){
 if(!state||state.version!==1)throw Error('하중표 데이터 형식을 확인하세요.');
 text(state.project,'프로젝트명');const map=catalog(state.materials);
 if(!Array.isArray(state.cases)||!state.cases.length||state.cases.length>50)throw Error('하중표는 1~50개로 구성하세요.');
 return state.cases.map((v,i)=>{try{return calculate(v,map);}catch(e){throw Error('하중표 '+(i+1)+': '+e.message);}});
}
root.DesignLoadTable={MATERIALS,initial,example,calculate,schedule,clone};
if(typeof module!=='undefined'&&module.exports)module.exports=root.DesignLoadTable;
})(typeof globalThis!=='undefined'?globalThis:this);
