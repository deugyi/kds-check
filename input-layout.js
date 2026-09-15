/* Keep complete input headings readable at the user's font and panel width.
 * Long headings occupy a full grid row; short pairs keep two columns.
 * Observe only input panels, not live result output. */
(function(){'use strict';
 if(typeof ResizeObserver==='undefined'||typeof requestAnimationFrame==='undefined')return;
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)return;
 let pending=false;
 function layout(){pending=false;for(const grid of document.querySelectorAll('.beam-sidebar .grid')){
  const width=grid.clientWidth;if(!width)continue;const style=getComputedStyle(grid),columns=style.gridTemplateColumns.split(' ').length,gap=parseFloat(style.columnGap)||0,cell=(width-gap*(columns-1))/columns;
  for(const label of grid.children){if(label.tagName!=='LABEL')continue;const title=label.querySelector(':scope > b');if(!title)continue;
   const font=getComputedStyle(title);context.font=font.font;const text=title.textContent.trim(),tracking=parseFloat(font.letterSpacing)||0,natural=context.measureText(text).width+Math.max(0,text.length-1)*tracking;
   const select=label.querySelector(':scope > select');let choice=0;
   if(select){const sf=getComputedStyle(select);context.font=sf.font;choice=context.measureText(select.selectedOptions[0]?.textContent||'').width+36;}
   const wide=Math.max(natural+4,choice)>cell;label.classList.toggle('input-label-wide',wide);
  }
  // A lone short field next to a full-width row should not leave a half-row gap.
  let run=[];const flush=()=>{if(run.length%columns===1&&columns>1)run[run.length-1].classList.add('input-label-wide');run=[];};
  for(const child of grid.children){if(!child.getClientRects().length)continue;if(child.tagName==='LABEL'&&!child.classList.contains('beam-wide')&&!child.classList.contains('input-label-wide'))run.push(child);else flush();}flush();
 }}
 function schedule(){if(!pending){pending=true;requestAnimationFrame(layout);}}
 const resize=new ResizeObserver(schedule);for(const panel of document.querySelectorAll('.beam-sidebar'))resize.observe(panel);
 const changes=new MutationObserver(schedule);for(const panel of document.querySelectorAll('.beam-sidebar'))changes.observe(panel,{childList:true,subtree:true,characterData:true});
 document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);
 if(document.fonts?.ready)document.fonts.ready.then(schedule);schedule();
})();
