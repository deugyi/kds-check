(function(){
'use strict';
const get=id=>document.getElementById(id);
const num=id=>get(id).value.trim()===''?NaN:Number(get(id).value);
const fmt=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});
function update(){
  const custom=get('tb_fck').value==='custom';
  get('tb_custom_field').hidden=!custom;
  try{
    const fck=num(custom?'tb_fck_custom':'tb_fck'),fy=num('tb_fy'),fyt=num('tb_fyt'),fyd=num('tb_fyd'),b=num('tb_b'),h=num('tb_h');
    if(!Number.isFinite(fck)||fck<21||fck>90)throw new Error('콘크리트 강도는 21–90 MPa로 입력하세요.');
    if(![400,500,600].includes(fy)||![400,500].includes(fyt)||![400,500,600].includes(fyd))throw new Error('철근 강도를 선택하세요.');
    if(![b,h].every(n=>Number.isFinite(n)&&n>=50&&n<=10000))throw new Error('보 폭과 높이는 50–10,000 mm로 입력하세요.');
    const scale=Math.min(220/b,240/h),w=b*scale,d=h*scale,x=(320-w)/2,y=(310-d)/2;
    get('tb_diagram').innerHTML=`<svg viewBox="0 0 360 360" role="img" aria-label="전이보 단면, 폭 ${fmt(b)} mm, 높이 ${fmt(h)} mm"><rect x="${x}" y="${y}" width="${w}" height="${d}" fill="var(--code)" stroke="var(--accent)" stroke-width="2"/><g stroke="var(--dim)" stroke-width="1"><path d="M${x} ${y+d+8}v22 M${x+w} ${y+d+8}v22 M${x} ${y+d+22}h${w} M${x+w+8} ${y}h22 M${x+w+8} ${y+d}h22 M${x+w+22} ${y}v${d}"/></g><text x="${x+w/2}" y="${y+d+43}" text-anchor="middle">b = ${fmt(b)} mm</text><text x="${x+w+40}" y="${y+d/2}" text-anchor="middle" transform="rotate(-90 ${x+w+40} ${y+d/2})">h = ${fmt(h)} mm</text></svg>`;
    get('tb_size').textContent=`${fmt(b)} × ${fmt(h)} mm`;
    get('tb_materials').innerHTML=[['콘크리트 강도 fck',fck],['주철근 강도 fy',fy],['스터럽 강도 fyt',fyt],['다월바 강도 fy,d',fyd]].map(([name,value])=>`<div><dt>${name}</dt><dd>${fmt(value)} MPa</dd></div>`).join('');
    get('tb_error').hidden=true;get('tb_results').hidden=false;
  }catch(e){
    get('tb_error').textContent=e.message;get('tb_error').hidden=false;get('tb_results').hidden=true;
    for(const id of ['tb_diagram','tb_size','tb_materials'])get(id).innerHTML='';
  }
}
get('t7').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
update();
})();
