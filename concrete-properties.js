(function(root){'use strict';
  // KDS 14 20 10:2021, 4.3.3 (4.3-1)–(4.3-4).
  function positive(value,label){if(!Number.isFinite(value)||value<=0)throw Error(label+': 0보다 큰 유한한 숫자로 입력하세요.');return value;}
  function modulus({strength=30,basis='fck',method='normal',density=2300}={}){
    positive(strength,'콘크리트 강도');
    if(!['fck','fcm'].includes(basis)||!['normal','density'].includes(method))throw Error('계산 방식을 확인하세요.');
    const delta=basis==='fcm'?0:strength<=40?4:strength>=60?6:4+(strength-40)/10;
    const fcm=strength+delta;
    if(method==='density'&&(!Number.isFinite(density)||density<1450||density>2500))throw Error('질량밀도는 1,450~2,500 kg/m³ 범위로 입력하세요.');
    const Ec=(method==='normal'?8500:0.077*Math.pow(density,1.5))*Math.cbrt(fcm);
    if(!Number.isFinite(Ec*1.18))throw Error('계산 가능한 숫자 범위를 초과했습니다.');
    return {strength,basis,method,density:method==='normal'?2300:density,delta,fcm,Ec,Eci:1.18*Ec};
  }
  // EN 206 Table 12, reproduced in IIETA doi:10.18280/mmep.120429 Table 1.
  // Characteristic strength CLASSES, not a conversion of individual test results.
  const classes=Object.freeze([[8,10],[12,15],[16,20],[20,25],[25,30],[30,37],[35,45],[40,50],[45,55],[50,60],[55,67],[60,75],[70,85],[80,95],[90,105],[100,115]].map(([cylinder,cube])=>Object.freeze({name:`C${cylinder}/${cube}`,cylinder,cube})));
  function strengthClass(name){const c=classes.find(c=>c.name===name);if(!c)throw Error('강도등급을 선택하세요.');return {...c,ratio:c.cylinder/c.cube};}
  function convert({strength,direction='cube-cylinder',ratio=.8}){
    positive(strength,'압축강도');positive(ratio,'변환계수');
    if(!['cube-cylinder','cylinder-cube'].includes(direction))throw Error('변환 방향을 확인하세요.');
    const result=direction==='cube-cylinder'?strength*ratio:strength/ratio;
    if(!Number.isFinite(result)||result===0)throw Error('계산 가능한 숫자 범위를 초과했습니다.');
    return {strength,direction,ratio,result};
  }
  const api={modulus,classes,strengthClass,convert};if(typeof module==='object'&&module.exports)module.exports=api;else root.ConcreteProperties=api;
})(typeof globalThis!=='undefined'?globalThis:this);
