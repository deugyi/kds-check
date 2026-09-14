(function(root){'use strict';
const g=9.80665,inch=.0254,ft=.3048,lb=.45359237,lbf=lb*g;
const category=(name,units,from,to)=>Object.freeze({name,units:Object.freeze(units.map(([name,factor])=>Object.freeze({name,factor}))),from,to});
const categories=Object.freeze({
 length:category('길이',[['mm',.001],['cm',.01],['m',1],['km',1000],['in',inch],['ft',ft]],'mm','m'),
 area:category('면적',[['mm²',1e-6],['cm²',1e-4],['m²',1],['ha',1e4],['km²',1e6],['in²',inch**2],['ft²',ft**2]],'mm²','m²'),
 volume:category('체적',[['mm³',1e-9],['cm³',1e-6],['L',.001],['m³',1],['in³',inch**3],['ft³',ft**3]],'m³','L'),
 mass:category('질량',[['g',.001],['kg',1],['t',1000],['lb',lb]],'t','kg'),
 force:category('힘',[['N',1],['kN',1000],['MN',1e6],['kgf',g],['tonf',1000*g],['lbf',lbf],['kip',1000*lbf]],'tonf','kN'),
 pressure:category('압력 · 응력 · 면하중',[['Pa',1],['kPa',1000],['MPa',1e6],['GPa',1e9],['N/mm²',1e6],['kN/m²',1000],['kgf/cm²',g/1e-4],['kgf/m²',g],['tonf/m²',g*1000],['bar',1e5],['psi',lbf/inch**2],['ksi',lbf*1000/inch**2],['psf',lbf/ft**2]],'MPa','kgf/cm²'),
 moment:category('모멘트',[['N·mm',.001],['N·m',1],['kN·mm',1],['kN·m',1000],['kgf·cm',g*.01],['kgf·m',g],['tonf·m',1000*g],['lbf·ft',lbf*ft],['kip·ft',1000*lbf*ft]],'kN·m','tonf·m'),
 line:category('선하중',[['N/mm',1000],['N/m',1],['kN/m',1000],['kgf/m',g],['tonf/m',1000*g],['lbf/ft',lbf/ft],['kip/ft',1000*lbf/ft]],'kN/m','tonf/m'),
 weight:category('단위중량',[['N/m³',1],['kN/m³',1000],['kgf/m³',g],['tonf/m³',1000*g],['lbf/ft³',lbf/ft**3]],'kN/m³','tonf/m³'),
 density:category('질량밀도',[['kg/m³',1],['g/cm³',1000],['t/m³',1000],['lb/ft³',lb/ft**3]],'kg/m³','t/m³'),
 inertia:category('단면2차모멘트',[['mm⁴',1e-12],['cm⁴',1e-8],['m⁴',1],['in⁴',inch**4],['ft⁴',ft**4]],'cm⁴','mm⁴'),
 modulus:category('단면계수',[['mm³',1e-9],['cm³',1e-6],['m³',1],['in³',inch**3],['ft³',ft**3]],'cm³','mm³'),
 speed:category('속도 · 풍속',[['m/s',1],['km/h',1/3.6],['mph',1609.344/3600],['ft/s',ft],['knot',1852/3600]],'m/s','km/h')
});
function convert(value,kind,from,to){
 if(typeof value!=='number'||!Number.isFinite(value))throw Error('유효한 숫자를 입력하세요.');
 const c=categories[kind],a=c?.units.find(u=>u.name===from),b=c?.units.find(u=>u.name===to);
 if(!a||!b)throw Error('같은 물리량의 단위를 선택하세요.');
 const result=value*(a.factor/b.factor);if(!Number.isFinite(result))throw Error('변환 결과가 표현 가능한 범위를 초과합니다.');if(result===0&&value!==0)throw Error('변환 결과가 표현 가능한 범위보다 작습니다.');return result;
}
root.UnitConverter={categories,convert};if(typeof module!=='undefined'&&module.exports)module.exports=root.UnitConverter;
})(globalThis);
