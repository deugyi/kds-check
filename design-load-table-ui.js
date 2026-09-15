(function(root){'use strict';
const E=root.DesignLoadTable,$=k=>document.getElementById('ld_'+k),KEY='kds-design-load-table-v1';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const F=(v,n=2)=>v.toLocaleString('ko-KR',{minimumFractionDigits:n,maximumFractionDigits:n});
const numeric=k=>$(k).value.trim()===''?NaN:Number($(k).value);
const dl=rows=>'<dl class="beam-values">'+rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')+'</dl>';
const option=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
let state=E.initial(),active=0,layer=0,material='plain',storage=null;
try{storage=root.localStorage;const saved=storage&&storage.getItem(KEY);if(saved){const parsed=JSON.parse(saved);E.schedule(parsed);state=parsed;}}catch(e){$('saved').textContent='저장된 하중표를 읽을 수 없어 원본 예제로 시작합니다.';}
function current(){return state.cases[active];}
function fill(){
 const c=current(),v=c.layers[layer];$('project').value=state.project;
 for(const k of ['use','content','remark','live'])$(k).value=Number.isNaN(c[k])?'':c[k];
 $('thickness').value=Number.isNaN(v.thickness)?'':v.thickness;
 material=v.material;fillMaterial();render();
}
function fillMaterial(){
 const m=state.materials.find(v=>v.id===material);
 $('material_name').value=m.name;$('material_mode').value=m.mode;
 $('material_value').value=Number.isNaN(m.value)?'':m.value;
 $('material_value_label').textContent=m.mode==='volume'?'단위중량 (kN/m³)':'면적당 하중 (kN/m²)';
}
function options(){
 $('case').innerHTML=state.cases.map((v,i)=>option(i,(i+1)+'. '+(v.use||'용도 미입력'))).join('');$('case').value=String(active);
 const mats=state.materials.map(v=>option(v.id,v.name)).join('');
 $('material').innerHTML=mats;$('material').value=current().layers[layer].material;
 $('catalog').innerHTML=mats;$('catalog').value=material;
 $('layer').innerHTML=current().layers.map((v,i)=>option(i,(i+1)+'. '+state.materials.find(m=>m.id===v.material).name)).join('');$('layer').value=String(layer);
 const m=state.materials.find(v=>v.id===current().layers[layer].material);
 $('thickness_field').hidden=m.mode==='area';
 $('layer_note').textContent=m.mode==='volume'?'두께(mm) ÷ 1,000 × 단위중량 '+(Number.isFinite(m.value)?F(m.value):'—')+' kN/m³':'두께 없이 면적당 하중 '+(Number.isFinite(m.value)?F(m.value):'—')+' kN/m²를 적용합니다.';
 $('delete_case').disabled=state.cases.length===1;$('add_case').disabled=$('copy_case').disabled=state.cases.length>=50;
 $('delete_layer').disabled=current().layers.length===1;$('add_layer').disabled=current().layers.length>=12;
 $('add_material').disabled=state.materials.length>=100;
}
function selectable(label,attr,index){return `<button type="button" class="ld-pick" data-${attr}="${index}">${esc(label)}</button><span class="ld-print-name">${esc(label)}</span>`;}
function render(){
 options();
 try{
  const all=E.schedule(state),r=all[active];$('error').hidden=true;$('results').hidden=false;
  $('project_title').textContent=state.project||'프로젝트명 미입력';
  $('summary').innerHTML=dl([['선택한 용도',esc(r.use)],['고정하중 D',F(r.D)+' kN/m²'],['활하중 L',F(r.L)+' kN/m²'],['사용하중 D + L',F(r.service)+' kN/m²'],['지배 계수하중 qu',F(r.qu)+' kN/m²'],['지배 조합',r.governing]]);
  const max=Math.max(r.D,r.L,r.service,r.qu,1),bars=[['고정 D',r.D,'#27679b'],['활 L',r.L,'#168777'],['사용 D+L',r.service,'#648196'],['계수 qu',r.qu,'#704ba0']];
  $('plot').innerHTML='<svg viewBox="0 0 720 160" role="img" aria-label="선택한 용도의 면적당 하중 비교">'+bars.map(([n,q,color],i)=>`<text x="0" y="${24+i*37}">${n}</text><rect x="105" y="${8+i*37}" width="${q/max*490}" height="22" fill="${color}"><title>${n} ${F(q)} kN/m²</title></rect><text x="${117+q/max*490}" y="${24+i*37}">${F(q)}</text>`).join('')+'</svg>';
  $('selection').textContent='하중표의 용도 또는 고정하중 항목을 누르면 왼쪽에서 수정할 수 있습니다. 단위: kN/m²';
  const heads=['No.','용도 · 내용','고정하중 구성','두께<br>(mm)','DL','LL','D + L','1.2D<br>+ 1.6L','1.4D','지배 qu'];
  let html='<table class="ld-schedule"><thead><tr>'+heads.map((h,i)=>`<th scope="col" class="${['ld-number','ld-description','ld-material'][i]||''}">${h}</th>`).join('')+'</tr></thead>';
  all.forEach((c,i)=>{
   const span=c.rows.length+1;html+=`<tbody class="${i===active?'ld-active':''}">`;
   c.rows.forEach((v,j)=>{
    html+='<tr>'+(j===0?`<td rowspan="${span}">${i+1}</td><td class="ld-description" rowspan="${span}">${selectable(c.use,'ld-case',i)}${c.content?'<small>'+esc(c.content)+'</small>':''}${c.remark?'<small>비고: '+esc(c.remark)+'</small>':''}</td>`:'');
    html+=`<td class="ld-material">${selectable(v.name,'ld-layer',i+':'+j)}</td><td>${v.mode==='volume'?F(v.thickness,1):'—'}</td><td title="${v.mode==='volume'?F(v.thickness,1)+' / 1000 × '+F(v.value)+' kN/m³':'면적당 하중 직접 적용'}">${F(v.q)}</td><td colspan="5"></td></tr>`;
   });
   html+=`<tr class="ld-total"><td class="ld-material">합계</td><td>—</td><td>${F(c.D)}</td><td>${F(c.L)}</td><td>${F(c.service)}</td><td>${F(c.u12)}</td><td>${F(c.u14)}</td><td class="ld-governing" title="${c.governing}">${F(c.qu)}</td></tr></tbody>`;
  });$('table').innerHTML=html+'</table>';
  $('material_table').innerHTML='<table class="beam-table"><thead><tr><th>마감재</th><th>계산 방식</th><th>기준값</th><th>단위</th></tr></thead><tbody>'+state.materials.map(m=>`<tr><td>${selectable(m.name,'ld-material',m.id)}</td><td>${m.mode==='volume'?'두께 × 단위중량':'면적당 하중'}</td><td>${F(m.value)}</td><td>${m.mode==='volume'?'kN/m³':'kN/m²'}</td></tr>`).join('')+'</tbody></table>';
  $('basis').innerHTML='<p>고정하중 D = 각 마감재 하중의 합. 두께형 재료는 t(mm)/1,000 × γ(kN/m³), 면적형 재료는 q(kN/m²)를 직접 합산합니다. 중간값을 반올림하지 않고 합계 후 소수 둘째 자리까지 표시합니다.</p><p>사용하중은 D+L, 지배 계수하중은 max(1.4D, 1.2D+1.6L)입니다. <a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2041%2012%2000" target="_blank" rel="noopener">KDS 41 12 00</a> 1.7.1의 하중조합에서 D·L만 작용하는 경우입니다. 지붕활하중 Lr·설하중·강우하중·풍하중·지진하중 등은 포함하지 않습니다.</p>';
  try{if(storage){storage.setItem(KEY,JSON.stringify(state));$('saved').textContent='마지막 정상 입력은 이 브라우저에 자동 저장됩니다.';}else $('saved').textContent='입력은 현재 화면에서 유지됩니다. 새로고침하면 원본 예제로 시작합니다.';}catch(e){$('saved').textContent='브라우저 저장이 제한되어 있습니다. 새로고침하면 현재 입력을 잃을 수 있습니다.';}
 }catch(e){
  $('error').hidden=false;$('error').textContent=e.message;$('results').hidden=true;
  for(const k of ['summary','plot','table','material_table','basis'])$(k).innerHTML='';
  $('saved').textContent='입력을 확인하세요. 현재 수정값은 저장되지 않았습니다.';
 }
}
function action(id,fn){$(id).addEventListener('click',fn);}
$('project').addEventListener('input',()=>{state.project=$('project').value;render();});
for(const k of ['use','content','remark','live'])$(k).addEventListener('input',()=>{current()[k]=k==='live'?numeric(k):$(k).value;render();});
$('case').addEventListener('change',()=>{active=Number($('case').value);layer=0;fill();});
$('layer').addEventListener('change',()=>{layer=Number($('layer').value);fill();});
$('material').addEventListener('change',()=>{current().layers[layer].material=$('material').value;fill();});
$('thickness').addEventListener('input',()=>{current().layers[layer].thickness=numeric('thickness');render();});
$('catalog').addEventListener('change',()=>{material=$('catalog').value;fillMaterial();});
for(const k of ['name','mode','value'])$('material_'+k).addEventListener(k==='mode'?'change':'input',()=>{
 const m=state.materials.find(v=>v.id===material);m[k]=k==='value'?numeric('material_value'):$('material_'+k).value;
 $('material_value_label').textContent=m.mode==='volume'?'단위중량 (kN/m³)':'면적당 하중 (kN/m²)';render();
});
action('add_case',()=>{if(state.cases.length>=50)return;state.cases.push({use:'새 용도',content:'',remark:'',live:3,layers:[{material:'rc',thickness:150}]});active=state.cases.length-1;layer=0;fill();});
action('copy_case',()=>{if(state.cases.length>=50)return;try{E.schedule(state);}catch(e){render();return;}state.cases.splice(active+1,0,E.clone(current()));active++;layer=0;fill();});
action('delete_case',()=>{if(state.cases.length===1)return;state.cases.splice(active,1);active=Math.min(active,state.cases.length-1);layer=0;fill();});
action('add_layer',()=>{if(current().layers.length>=12)return;current().layers.push({material:'finish',thickness:0});layer=current().layers.length-1;fill();});
action('delete_layer',()=>{if(current().layers.length===1)return;current().layers.splice(layer,1);layer=Math.min(layer,current().layers.length-1);fill();});
action('add_material',()=>{
 if(state.materials.length>=100)return;let i=1;while(state.materials.some(m=>m.id==='custom-'+i))i++;
 const id='custom-'+i;state.materials.push({id,name:'사용자 재료 '+i,mode:'volume',value:20});current().layers[layer].material=id;fill();
});
$('table').addEventListener('click',e=>{
 const c=e.target.closest('[data-ld-case]'),l=e.target.closest('[data-ld-layer]');
 if(c){active=Number(c.getAttribute('data-ld-case'));layer=0;fill();}
 if(l){[active,layer]=l.getAttribute('data-ld-layer').split(':').map(Number);fill();}
});
$('material_table').addEventListener('click',e=>{const m=e.target.closest('[data-ld-material]');if(m){material=m.getAttribute('data-ld-material');$('catalog').value=material;fillMaterial();}});
fill();
})(typeof globalThis!=='undefined'?globalThis:this);
