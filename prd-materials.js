/* Saved specifications take priority over the imported Excel defaults. */
(function(root){
'use strict';
function read(value){
 if(value?.schema!==1||!Array.isArray(value.fields))return null;
 return {schema:1,fields:value.fields.filter(f=>f&&['diameter','column_spec','insert_spec'].includes(f.id)).map(f=>({id:f.id,value:f.value}))};
}
function specifications(record={},pile={},material){
 if(record.specifications!==undefined&&record.specifications!==null)return root.PRD.specifications(record.specifications);
 const values=Object.fromEntries((read(material)?.fields||[]).map(f=>[f.id,f.value]));
 const match=String(values.diameter??'').match(/^(?:D|[ΦφØø])?\s*(\d+(?:\.\d+)?)$/i);
 const diameter=match&&Number(match[1])>0?Number(match[1]):Number.isFinite(pile.diameter)&&pile.diameter>0?pile.diameter:null;
 return root.PRD.specifications({diameter,column_spec:values.column_spec??'',insert_spec:values.insert_spec??''});
}
root.PRDMaterials={read,specifications};if(typeof module!=='undefined')module.exports=root.PRDMaterials;
})(globalThis);
