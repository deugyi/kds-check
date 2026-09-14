(function(){'use strict';
const E=ConcreteProperties,$=id=>document.getElementById(id),f=(n,d=2)=>n.toLocaleString('ko-KR',{maximumFractionDigits:d});
function number(id){const raw=$(id).value.trim();if(!raw)throw Error('입력값을 모두 입력하세요.');return Number(raw);}
function modulus(){
  const direct=$('ec_basis').value==='fcm',general=$('ec_method').value==='density';
  $('ec_strength_label').textContent=direct?'평균압축강도 fcm (MPa)':'설계기준압축강도 fck (MPa)';$('ec_density_wrap').hidden=!general;
  try{const r=E.modulus({strength:number('ec_strength'),basis:$('ec_basis').value,method:$('ec_method').value,density:general?number('ec_density'):2300});
    $('ec_error').hidden=true;$('ec_results').hidden=false;$('ec_value').textContent=f(r.Ec,0)+' MPa';$('ec_gpa').textContent=f(r.Ec/1000,3)+' GPa · 콘크리트 탄성계수 Ec';
    $('ec_steps').innerHTML=`<p>${direct?'입력한 평균압축강도를 사용합니다.':`Δf = ${f(r.delta)} MPa<br>fcm = fck + Δf = ${f(r.strength)} + ${f(r.delta)} = <b>${f(r.fcm)} MPa</b>`}</p><p>${general?'Ec = 0.077 × mc<sup>1.5</sup> × ∛fcm':'Ec = 8,500 × ∛fcm'}</p><p>= ${general?'0.077 × '+f(r.density)+'<sup>1.5</sup> ×':'8,500 ×'} ∛${f(r.fcm)} = <b>${f(r.Ec,0)} MPa</b></p><p class="beam-muted">${general?'입력 질량밀도':'보통중량콘크리트 간편식'} · mc = ${f(r.density,0)} kg/m³</p>`;
    $('ec_initial').textContent='Eci = 1.18 × Ec = '+f(r.Eci,0)+' MPa ('+f(r.Eci/1000,3)+' GPa)';
  }catch(e){$('ec_error').textContent=e.message;$('ec_error').hidden=false;$('ec_results').hidden=true;$('ec_value').textContent='—';$('ec_gpa').textContent='';}
}
$('cv_class').innerHTML=E.classes.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');$('cv_class').value='C30/37';
function conversion(){const table=$('cv_mode').value==='class',forward=$('cv_direction').value==='cube-cylinder';$('cv_class_wrap').hidden=!table;$('cv_estimate_wrap').hidden=table;$('cv_input_label').textContent=(forward?'Cube':'Cylinder')+' 압축강도 (MPa)';
  try{let cyl,cube,ratio,explanation,selected='';
    if(table){const c=E.strengthClass($('cv_class').value);cyl=c.cylinder;cube=c.cube;ratio=c.ratio;selected=c.name;explanation=c.name+' · EN 강도등급 대응값';}
    else{const r=E.convert({strength:number('cv_strength'),direction:$('cv_direction').value,ratio:number('cv_ratio')});cyl=forward?r.result:r.strength;cube=forward?r.strength:r.result;ratio=r.ratio;explanation='사용자 계수에 따른 추정값 · k = '+f(ratio,4);}
    $('cv_error').hidden=true;$('cv_results').hidden=false;$('cv_cylinder').textContent=f(cyl,3)+' MPa';$('cv_cube').textContent=f(cube,3)+' MPa';$('cv_caption').textContent=explanation;
    $('cv_equation').textContent=table?`fck,cyl / fck,cube = ${f(cyl)} / ${f(cube)} = ${f(ratio,4)}`:forward?`fcyl = k × fcube = ${f(ratio,4)} × ${f(cube,3)} = ${f(cyl,3)} MPa`:`fcube = fcyl / k = ${f(cyl,3)} / ${f(ratio,4)} = ${f(cube,3)} MPa`;
    $('cv_rows').innerHTML=E.classes.map(c=>`<tr${c.name===selected?' class="selected"':''}><th scope="row">${c.name}</th><td>${c.cylinder}</td><td>${c.cube}</td><td>${f(c.cylinder/c.cube,4)}</td></tr>`).join('');
  }catch(e){$('cv_error').textContent=e.message;$('cv_error').hidden=false;$('cv_results').hidden=true;}
}
for(const id of ['ec_strength','ec_density'])$(id).addEventListener('input',modulus);
for(const id of ['ec_basis','ec_method'])$(id).addEventListener('change',modulus);
for(const id of ['cv_mode','cv_class','cv_direction'])$(id).addEventListener('change',conversion);
for(const id of ['cv_strength','cv_ratio'])$(id).addEventListener('input',conversion);
modulus();conversion();
})();
