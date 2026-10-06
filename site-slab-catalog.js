/* Member tables arrive with the authenticated drawing, never as public site data. */
(function(root){
'use strict';
function entries(drawing){
 const seen=new Set(),result=[];
 for(const raw of Array.isArray(drawing?.slabCatalog)?drawing.slabCatalog.slice(0,200):[]){
  if(!raw||typeof raw.code!=='string'||typeof raw.type!=='string')continue;
  const code=raw.code.trim(),type=raw.type.trim(),thickness=raw.thickness_mm;
  if(!code||code.length>80||!type||type.length>80||typeof thickness!=='number'||!Number.isFinite(thickness)||thickness<=0||thickness>2000||seen.has(code))continue;
  const attributes=(Array.isArray(raw.attributes)?raw.attributes:[]).slice(0,20).filter(a=>a&&typeof a.label==='string'&&typeof a.value==='string'&&a.label.length<=80&&a.value.length<=200).map(a=>({label:a.label,value:a.value}));
  const entry={code,type,thickness_mm:thickness,attributes};if(/^#[0-9a-f]{6}$/i.test(raw.color||''))entry.color=raw.color;if(specification(entry).length>120)continue;
  seen.add(code);result.push(entry);
 }return result;
}
function specification(entry){return `${entry.code} · 두께 ${entry.thickness_mm} mm · ${entry.type}`;}
// Exact matching keeps similarly named variants separate and preserves custom specifications.
function match(drawing,spec){const value=String(spec||'').trim();return entries(drawing).find(e=>value===e.code||value===specification(e))||null;}
function details(entry){return [['부재명',entry.code],['슬래브 두께',entry.thickness_mm+' mm'],['데크 형식',entry.type],...entry.attributes.map(a=>[a.label,a.value])];}
function color(entry){return /^#[0-9a-f]{6}$/i.test(entry?.color||'')?entry.color:'#dcebf6';}
root.SiteSlabCatalog={entries,specification,match,details,color};if(typeof module!=='undefined')module.exports=root.SiteSlabCatalog;
})(globalThis);
