/* Imported PRD material facts remain separate from editable construction dates. */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=['자재','일정','검측','시공'];
function read(value){
 if(value?.schema!==1||!Array.isArray(value.fields)||!value.source)return null;
 const str=(s,n=2000)=>String(s??'').slice(0,n);
 const fields=value.fields.slice(0,40).filter(f=>f&&typeof f.id==='string'&&groups.includes(f.group)).map(f=>({
  id:str(f.id,60),label:str(f.label,150),group:f.group,
  value:typeof f.value==='number'&&Number.isFinite(f.value)?f.value:str(f.value),
  date:root.PRD?.validDate?.(f.date)&&f.date?f.date:undefined,
  qualifier:str(f.qualifier,200),planned:f.planned===true,cell:str(f.cell,20)
 }));
 const issues=(Array.isArray(value.issues)?value.issues:[]).slice(0,20).map(i=>({kind:str(i.kind,100),field:str(i.field,150),source:str(i.source),existing:str(i.existing),action:str(i.action,500)}));
 const corrections=(Array.isArray(value.corrections)?value.corrections:[]).slice(0,10).map(i=>({field:str(i.field,150),before:str(i.before,100),after:str(i.after,100),reason:str(i.reason,500)}));
 return {schema:1,source:{file:str(value.source.file,200),sheet:str(value.source.sheet,50),row:Number(value.source.row)||0,imported:str(value.source.imported,10)},fields,issues,corrections};
}
function display(field){
 const value=field.date||(typeof field.value==='number'?String(Number(field.value.toFixed(6))):String(field.value??''));
 return value+(field.qualifier?' · '+field.qualifier:'');
}
function render(input){
 const d=read(input);if(!d)return '';
 const names={자재:'자재 규격',일정:'반입·근입 일정',검측:'자재·용접 검측',시공:'시공·특이사항'};
 const warnings=d.issues.length?`<details class="prd-material-check"${d.issues.some(i=>i.kind!=='도면 레이어 공경 차이')?' open':''}><summary>확인 사항 ${d.issues.length}건</summary><ul>${d.issues.map(i=>`<li><strong>${esc(i.kind)} · ${esc(i.field)}</strong><span>원본 ${esc(i.source)}${i.existing?' / 기존 '+esc(i.existing):''}</span><span>${esc(i.action)}</span></li>`).join('')}</ul></details>`:'';
 return `<section class="prd-materials" aria-label="반입 자료 상세 정보"><h4>반입 자료 상세 정보</h4><p class="prd-muted">${esc(d.source.file)} · ${esc(d.source.sheet)} ${d.source.row}행</p>${d.corrections.length?'<p class="prd-muted">공경은 엑셀 기준으로 정정했습니다.</p>':''}${warnings}${groups.map(group=>{const fields=d.fields.filter(f=>f.group===group);return fields.length?`<details${group==='자재'?' open':''}><summary>${names[group]}</summary><dl>${fields.map(f=>`<dt>${esc(f.label)}</dt><dd title="원본 ${esc(d.source.sheet)}!${esc(f.cell)}">${esc(display(f))}</dd>`).join('')}</dl></details>`:'';}).join('')}<p class="prd-muted">근입일은 철골 설치 기록입니다. 아래 타설일(완료일)과 별도로 관리합니다.</p></section>`;
}
root.PRDMaterials={read,display,render};if(typeof module!=='undefined')module.exports=root.PRDMaterials;
})(globalThis);
