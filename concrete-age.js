/* Simplified temperature-adjusted KDS strength-development estimate.
 * KDS 14 20 01 3.1-10,15,16; combination and design-value conversion are
 * explicit modelling assumptions documented in docs/transfer-beam.md. */
(function(root){
'use strict';
const CEMENT={normal:.35,rapid:.25,moderate:.40};
function estimate(fck,cement,temperature,days){
  if(!Number.isFinite(fck)||fck<21||fck>90)throw Error('28일 기준강도는 21–90 MPa로 입력하세요.');
  if(!Object.hasOwn(CEMENT,cement))throw Error('지원하는 시멘트 종류를 선택하세요.');
  if(!Number.isFinite(temperature)||temperature<5||temperature>40)throw Error('간편 추정의 평균 콘크리트 양생온도는 5–40 ℃ 범위입니다.');
  if(!Number.isFinite(days)||days<0)throw Error('경과일수는 0 이상의 숫자여야 합니다.');
  const delta=Math.max(4,Math.min(6,4+(fck-40)/10));
  const equivalentDays=days*Math.exp(13.65-4000/(273+temperature));
  const beta=days===0?0:Math.exp(CEMENT[cement]*(1-Math.sqrt(28/equivalentDays)));
  const mean=beta*(fck+delta);
  // Do not feed estimated mean strength directly to a design-strength model.
  const applied=Math.max(0,Math.min(fck,mean-delta));
  return {days,equivalentDays,beta,mean,applied,delta};
}
function schedule(fck,cement,temperature,waits){
  if(!Array.isArray(waits)||waits.length<1||waits.length>10||waits.some(v=>!Number.isFinite(v)||v<0))throw Error('각 차수의 타설 후 경과일수를 0 이상으로 입력하세요.');
  const strengths={},details={};
  for(let k=1;k<=waits.length;k++){
    details[k]=waits.slice(0,k).map((_,i)=>estimate(fck,cement,temperature,waits.slice(i,k).reduce((a,v)=>a+v,0)));
    strengths[k]=details[k].map(r=>r.applied);
  }
  return {strengths,details};
}
root.ConcreteAge={estimate,schedule,CEMENT};
if(typeof module!=='undefined'&&module.exports)module.exports=root.ConcreteAge;
})(typeof globalThis!=='undefined'?globalThis:this);
