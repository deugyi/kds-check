/* KDS 14 20 52:2024 4.1.2(3), 4.1.3, 4.1.5.
 * mm, MPa. Single deformed bars at full fy; no excess-steel reduction.
 * Ktr = 40 Atr/(s n), not the superseded strength-dependent expression.
 */
(function(root){'use strict';
const S=typeof module==='object'&&module.exports?require('./rebar-spec'):root.RebarSpec;
const bars=S.bars.filter(b=>b.diameter>=9.53&&b.diameter<=50.8);
const defaults={type:'tension',bar:'D25',fck:30,fy:500,lambda:1,top:false,epoxy:false,cover:40,clear:50,ties:false,Atr:142.66,s:100,n:3,compressionConfined:false,hookSide:40,hookTail:40,hookTie:'none',hookSpacing:75,hookFirst:50,hookEndRequired:false,available:null};
const positive=(v,label)=>{if(!Number.isFinite(v)||v<=0)throw Error(label+': 0보다 큰 숫자를 입력하세요.');};
const nonnegative=(v,label)=>{if(!Number.isFinite(v)||v<0)throw Error(label+': 0 이상의 숫자를 입력하세요.');};
function calculate(input={}){
 const p={...defaults,...input},b=bars.find(b=>b.name===p.bar);if(!b)throw Error('D10~D51 철근 규격을 선택하세요.');
 if(!['tension','compression','hook90','hook180'].includes(p.type))throw Error('정착 형식을 선택하세요.');
 positive(p.fck,'콘크리트 강도');positive(p.fy,'철근 강도');if(p.fy>600)throw Error('이 페이지는 fy 600 MPa 이하를 지원합니다.');
 if(!Number.isFinite(p.lambda)||p.lambda<.75||p.lambda>1)throw Error('λ는 0.75~1.00 범위로 입력하세요.');
 if(p.available!==null)positive(p.available,'확보 정착길이');
 const db=b.diameter,sqrt=Math.min(Math.sqrt(p.fck),8.4),notes=[],checks=[],factors={};
 const check=(name,pass,detail)=>checks.push({name,pass,detail});
 let base,adjusted,minimum,formula,clause,c=null,Ktr=0,confinement=null,hook=null;
 if(Math.sqrt(p.fck)>8.4)notes.push('√fck는 KDS 1.2(3)에 따라 8.4로 제한했습니다.');
 if(p.type==='tension'){
  positive(p.cover,'철근 순피복');positive(p.clear,'철근 순간격');
  c=Math.min(p.cover+db/2,(p.clear+db)/2);
  if(p.ties){positive(p.Atr,'Atr');positive(p.s,'횡철근 간격');positive(p.n,'철근 수 n');if(!Number.isSafeInteger(p.n))throw Error('철근 수 n은 유효한 정수로 입력하세요.');Ktr=40*p.Atr/(p.s*p.n);if(!Number.isFinite(Ktr))throw Error('횡철근 입력값이 계산 범위를 초과했습니다.');}
  factors.alpha=p.top?1.3:1;factors.beta=p.epoxy?(p.cover<3*db||p.clear<6*db?1.5:1.2):1;
  factors.alphaBeta=Math.min(factors.alpha*factors.beta,1.7);factors.gamma=db<=19.1?.8:1;
  confinement=Math.min((c+Ktr)/db,2.5);
  base=.9*db*p.fy/(p.lambda*sqrt);adjusted=base*factors.alphaBeta*factors.gamma/confinement;minimum=300;
  formula='ld = 0.9 db fy / (λ √fck) × αβγ / [(c + Ktr) / db]';clause='4.1.2(3) · 식 (4.1-2)';
  if(p.fy>550){if(!p.ties)check('고강도철근 · 횡철근 없음',c/db>=2.5,`c/db = ${c/db} ≥ 2.5`);else{check('고강도철근 · 횡철근지수',Ktr/db>=.25,`Ktr/db = ${Ktr/db} ≥ 0.25`);check('고강도철근 · 피복과 횡구속',(c+Ktr)/db>=2.25,`(c+Ktr)/db = ${(c+Ktr)/db} ≥ 2.25`);}}
  notes.push('순피복은 콘크리트 표면부터 정착하는 주철근 표면까지의 최단거리입니다. 스터럽 바깥 피복과 구분하세요.');
 }else if(p.type==='compression'){
  base=Math.max(.25*db*p.fy/(p.lambda*sqrt),.043*db*p.fy);factors.confinement=p.compressionConfined?.75:1;adjusted=base*factors.confinement;minimum=200;
  formula='ldb = max[0.25 db fy / (λ √fck), 0.043 db fy]';clause='4.1.3 · 식 (4.1-3)';
  if(p.compressionConfined)notes.push('0.75는 지름 6 mm 이상·간격 100 mm 이하 나선철근 또는 KDS 14 20 50 4.4.2(3)에 맞는 D13 띠철근(간격 100 mm 이하)으로 둘러싼 경우입니다.');
  notes.push('갈고리는 압축 정착에 산입하지 않습니다.');
 }else{
  nonnegative(p.hookSide,'갈고리 측면 피복');nonnegative(p.hookTail,'갈고리 끝 연장부 피복');
  if(!['none','perpendicular','parallel'].includes(p.hookTie))throw Error('갈고리 횡구속 형식을 확인하세요.');
  const is90=p.type==='hook90',small=db<=34.9;
  let tiesOK=false;
  if(p.hookTie!=='none'){
   positive(p.hookSpacing,'갈고리 횡철근 간격');nonnegative(p.hookFirst,'첫 횡철근 거리');
   check('갈고리 횡철근 간격',p.hookSpacing<=3*db,`s = ${p.hookSpacing} ≤ 3db = ${3*db} mm`);
   check('첫 횡철근 위치',p.hookFirst<=2*db,`a = ${p.hookFirst} ≤ 2db = ${2*db} mm`);
   check('갈고리 횡구속 방향',is90||p.hookTie==='perpendicular',is90?'90°: 수직 전구간 또는 평행 굽힘부·끝 연장부 구속':'180°: 정착길이 전구간 수직 구속');
   tiesOK=p.hookSpacing<=3*db&&p.hookFirst<=2*db&&(is90||p.hookTie==='perpendicular');
  }
  if(p.hookEndRequired)check('불연속단 · 의무 횡구속',tiesOK&&p.hookTie==='perpendicular','전 정착길이 구간 수직 구속, s ≤ 3db 및 첫 횡철근 ≤ 2db 필요');
  factors.beta=p.epoxy?1.2:1;
  factors.cover=small&&p.hookSide>=70&&(!is90||p.hookTail>=50)?.7:1;
  factors.confinement=small&&tiesOK&&p.fy<=550&&!p.hookEndRequired?.8:1;
  base=.24*factors.beta*db*p.fy/(p.lambda*sqrt);adjusted=base*factors.cover*factors.confinement;minimum=Math.max(8*db,150);
  formula='lhb = 0.24 β db fy / (λ √fck)';clause='4.1.5 · 식 (4.1-4)';
  const radiusFactor=db<=25.4?3:db<=34.9?4:5;
  hook={angle:is90?90:180,radius:radiusFactor*db,extension:is90?12*db:Math.max(4*db,60)};
  if(p.fy>550)notes.push('fy > 550 MPa이므로 횡구속 보정계수 0.8을 적용하지 않습니다.');
  if(p.hookEndRequired)notes.push('불연속단 의무 횡구속 조건에서는 보정계수 0.8을 적용하지 않습니다.');
  notes.push('ldh는 위험단면부터 갈고리 바깥 끝까지의 투영거리입니다. 철근을 따라 잰 길이나 갈고리 끝 연장길이가 아닙니다.');
 }
 const required=Math.max(adjusted,minimum),suggested=Math.ceil(required/10)*10;
 if(!Number.isFinite(required)||!Number.isFinite(suggested))throw Error('입력값이 계산 가능한 범위를 초과했습니다.');
 const detailingOK=checks.every(c=>c.pass),lengthOK=p.available===null?null:p.available>=required;
 return {p,db,sqrt,base,adjusted,minimum,required,suggested,factors,c,Ktr,confinement,formula,clause,hook,notes,checks,detailingOK,lengthOK,ok:detailingOK&&(lengthOK===null||lengthOK)};
}
const api={calculate,defaults,bars};if(typeof module==='object'&&module.exports)module.exports=api;else root.RebarDevelopment=api;
})(globalThis);
