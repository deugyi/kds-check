(function(){
'use strict';
const get=id=>document.getElementById(id);
const num=id=>get(id).value.trim()===''?NaN:Number(get(id).value);
const fmt=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});
const COLORS=['#2878b5','#df9a33','#3a9b78','#8b6cb5','#c96772','#578e9e','#9b8d3e','#b77847','#6477aa','#9b6992'];
let heights=[],strengths={};
function strengthControls(){
  const stage=get('tb_view').value==='all'?heights.length:Number(get('tb_view').value);
  strengths[stage]??=[];
  get('tb_strength_note').textContent=`${stage}차까지 타설한 후의 검토 시점 · 각 차수 콘크리트의 강도를 개별 기록합니다.`;
  get('tb_strengths').innerHTML=heights.slice(0,stage).map((_,i)=>`<label class="beam-wide"><b>${stage}차 검토 · ${i+1}차 콘크리트 (MPa)</b><input id="tb_fc_${i}" type="number" min="0" max="90" step="any" placeholder="확인된 강도 입력" value="${strengths[stage][i]??''}"></label>`).join('');
  heights.slice(0,stage).forEach((_,i)=>get('tb_fc_'+i).addEventListener('input',()=>{const v=get('tb_fc_'+i).value;strengths[stage][i]=v===''?null:Number(v);update();}));
}
function stageControls(equal=false){
  const count=num('tb_count'),h=num('tb_h');
  if(equal||heights.length!==count){const base=Math.floor(h/count);heights=Array.from({length:count},(_,i)=>i===count-1?h-base*(count-1):base);}
  const selected=get('tb_view').value;
  get('tb_view').innerHTML='<option value="all">전체 단면</option>'+heights.map((_,i)=>`<option value="${i+1}">${i+1}차까지</option>`).join('');
  get('tb_view').value=selected==='all'||Number(selected)<=count?selected:'all';
  get('tb_stages').innerHTML=heights.map((v,i)=>`<div class="tb-stage" style="--stage-color:${COLORS[i]}"><h3>${i+1}차 타설</h3><label><b>${i+1}차 타설 높이 (mm)</b><input id="tb_lift_${i}" type="number" min="1" step="50" value="${Number.isFinite(v)?v:''}"></label></div>`).join('');
  strengthControls();
  heights.forEach((_,i)=>get('tb_lift_'+i).addEventListener('input',()=>{heights[i]=num('tb_lift_'+i);update();}));
}
function update(){
  const custom=get('tb_fck').value==='custom';
  get('tb_custom_field').hidden=!custom;
  try{
    const fck=num(custom?'tb_fck_custom':'tb_fck'),fy=num('tb_fy'),fyt=num('tb_fyt'),fyd=num('tb_fyd'),b=num('tb_b'),h=num('tb_h');
    if(!Number.isFinite(fck)||fck<21||fck>90)throw new Error('콘크리트 강도는 21–90 MPa로 입력하세요.');
    if(![400,500,600].includes(fy)||![400,500].includes(fyt)||![400,500,600].includes(fyd))throw new Error('철근 강도를 선택하세요.');
    if(![b,h].every(n=>Number.isFinite(n)&&n>=50&&n<=10000))throw new Error('보 폭과 높이는 50–10,000 mm로 입력하세요.');
    const span=num('tb_span');
    if(!Number.isFinite(span)||span<=0)throw new Error('경간은 0보다 큰 숫자로 입력하세요.');
    if(!heights.every(v=>Number.isFinite(v)&&v>0))throw new Error('각 차수의 타설 높이는 0보다 큰 숫자로 입력하세요.');
    const sum=heights.reduce((a,v)=>a+v,0);
    if(Math.abs(sum-h)>0.01)throw new Error(`타설 높이 합계 ${fmt(sum)} mm가 전체 높이 ${fmt(h)} mm와 다릅니다. 높이를 수정하거나 균등 배분하세요.`);
    const shown=get('tb_view').value==='all'?heights.length:Number(get('tb_view').value);
    if((strengths[shown]||[]).some(v=>v!==null&&v!==undefined&&(!Number.isFinite(v)||v<0||v>90)))throw new Error('발현강도는 0–90 MPa로 입력하거나 미확인 상태로 비워 두세요.');
    const activeHeight=heights.slice(0,shown).reduce((a,v)=>a+v,0);
    const scale=Math.min(220/b,240/h),w=b*scale,d=h*scale,x=(320-w)/2,y=(310-d)/2;
    let cumulative=0;
    const bands=heights.map((v,i)=>{cumulative+=v;const top=y+d-cumulative*scale,dh=v*scale;return `<rect x="${x}" y="${top}" width="${w}" height="${dh}" fill="${COLORS[i]}" opacity="${i<shown?.72:.10}"/><line x1="${x}" x2="${x+w}" y1="${top}" y2="${top}" stroke="var(--ink)" stroke-dasharray="4 3"/>${dh>=16?`<text x="${x+w/2}" y="${top+dh/2+4}" text-anchor="middle">${i+1}차</text>`:''}`;}).join('');
    get('tb_diagram').innerHTML=`<svg viewBox="0 0 360 360" role="img" aria-label="${heights.length}차 분할 타설 전이보, 폭 ${fmt(b)} mm, 전체 높이 ${fmt(h)} mm, ${shown}차까지 ${fmt(activeHeight)} mm">${bands}<rect x="${x}" y="${y}" width="${w}" height="${d}" fill="none" stroke="var(--ink)"/><text x="${x+w/2}" y="${y+d+26}" text-anchor="middle">b = ${fmt(b)} mm</text><text x="${x+w+28}" y="${y+d/2}" text-anchor="middle" transform="rotate(-90 ${x+w+28} ${y+d/2})">h = ${fmt(h)} mm</text></svg>`;
    get('tb_legend').innerHTML=heights.map((v,i)=>`<span class="tb-legend-item" style="--stage-color:${COLORS[i]}"><i class="tb-swatch"></i>${i+1}차 · ${fmt(v)} mm${i>=shown?' (미타설)':''}</span>`).join('');
    get('tb_size').textContent=`${fmt(b)} × ${fmt(h)} mm · 경간 ${fmt(span)} m`;
    get('tb_materials').innerHTML=[['콘크리트 강도 fck',fck],['주철근 강도 fy',fy],['스터럽 강도 fyt',fyt],['다월바 강도 fy,d',fyd]].map(([name,value])=>`<div><dt>${name}</dt><dd>${fmt(value)} MPa</dd></div>`).join('');
    get('tb_error').hidden=true;get('tb_results').hidden=false;
  }catch(e){
    get('tb_error').textContent=e.message;get('tb_error').hidden=false;get('tb_results').hidden=true;
    for(const id of ['tb_diagram','tb_size','tb_materials','tb_legend'])get(id).innerHTML='';
  }
}
get('t7').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
get('tb_view').addEventListener('input',()=>{strengthControls();update();});
get('tb_count').addEventListener('input',()=>{stageControls();update();});
get('tb_equal').addEventListener('click',()=>{stageControls(true);update();});
stageControls(true);update();
})();
