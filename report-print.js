/* One print flow for every calculator, including browser Ctrl+P. */
(function(root){
'use strict';
let opened=[];
function prepare(){
  if(opened.length)return;
  const active=document.querySelector('section.tab.on');
  if(!active)return;
  opened=Array.from(active.querySelectorAll('details:not([open])'));
  opened.forEach(detail=>{detail.open=true;});
}
function restore(){opened.forEach(detail=>{detail.open=false;});opened=[];}
// Capture first so legacy page-specific print handlers cannot print twice.
document.addEventListener('click',event=>{
  if(!event.target.closest('[data-report-print]'))return;
  event.preventDefault();event.stopImmediatePropagation();
  prepare();
  try{root.print();}catch(error){restore();throw error;}
},true);
if(root.addEventListener){root.addEventListener('beforeprint',prepare);root.addEventListener('afterprint',restore);}
})(typeof globalThis!=='undefined'?globalThis:this);
