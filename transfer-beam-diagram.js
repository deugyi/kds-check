/* Reinforcement preview uses the same bottom-bar geometry as the calculator.
 * Dowel lengths and stirrup closures are schematic, not anchorage details. */
(function(){
'use strict';
const get=id=>document.getElementById(id),fmt=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});
function render(p,o,shown,colors){
  const scale=Math.min(280/p.b,330/p.h),w=p.b*scale,h=p.h*scale,x=(400-w)/2,y=35;
  const X=v=>x+v*scale,Y=v=>y+h-v*scale;
  const item=(info,shape)=>`<g tabindex="0" role="button" aria-label="${info}" data-info="${info}"><title>${info}</title>${shape}</g>`;
  let total=0;
  let svg=p.heights.map((v,i)=>{total+=v;return item(`${i+1}차 타설 · 높이 ${fmt(v)} mm${i>=shown?' · 미타설':''}`,`<rect x="${x}" y="${Y(total)}" width="${w}" height="${v*scale}" fill="${colors[i]}" opacity="${i<shown?.28:.06}"/><path d="M${x} ${Y(total)}h${w}" stroke="var(--ink)" stroke-dasharray="4 4"/><text x="${x-8}" y="${Y(total-v/2)+4}" text-anchor="end">${i+1}차</text>`);}).join('');
  const notes=[];
  try{
    const lay=TransferBeam.layout(p,p.h),st=lay.g.st,edge=p.cover+st.diameter/2;
    if(p.b<=2*edge||p.h<=2*edge)throw Error('스터럽을 피복 안쪽에 배치할 수 없습니다.');
    const left=X(edge),right=X(p.b-edge),top=Y(p.h-edge),bottom=Y(edge);
    const outline=`M${left} ${bottom}V${top}H${right}V${bottom}Z`;
    const path=d=>`<path d="${d}" stroke="#167b69" stroke-width="${Math.max(1.8,st.diameter*scale)}" fill="none"/><path class="tb-hit" d="${d}"/>`;
    svg+=item(`스터럽 ${p.stirrup} · ${p.legs}다리 @${p.stirrupSpacing} mm · 모든 다리를 이어치기면 다월바로 산입`,path(outline));
    for(let i=1;i<p.legs-1;i++)svg+=item(`스터럽 내부 다리 ${i+1}/${p.legs} · ${p.stirrup}`,path(`M${left+(right-left)*i/(p.legs-1)} ${top}V${bottom}`));
    lay.layers.forEach((l,i)=>l.xs.forEach((v,k)=>{const cy=Y(p.h-l.d);svg+=item(`하부 ${i+1}단 · ${p.bar} ${l.count}가닥 · ${k+1}번째 · 바닥에서 ${fmt(p.h-l.d)} mm`,`<circle cx="${X(v)}" cy="${cy}" r="${Math.max(2.5,lay.g.bar.diameter*scale/2)}" fill="#2447a5" stroke="white" stroke-width=".7"/><circle cx="${X(v)}" cy="${cy}" r="8" fill="transparent"/>`);}));
  }catch(e){notes.push(e.message+' 철근 배치를 표시하지 않습니다.');}
  let joint=0;
  for(let i=0;i<shown-1;i++){
    joint+=p.heights[i];
    const checks=o.phases.filter(r=>r.stage<=shown).flatMap(r=>r.interfaces.filter(j=>Math.abs(j.joint-joint)<.01).map(j=>({j,deep:r.deep})));
    const blocked=checks.some(({j,deep})=>deep||j.demand>j.cap||j.neededCount>j.fit);
    const needed=checks.length&&!blocked?Math.max(...checks.map(({j})=>j.neededCount)):null;
    const count=Math.max(p.dowelCount,needed??0),db=RCBeam.BARS[p.dowel];
    const fit=checks.length?Math.min(...checks.map(({j})=>j.fit)):Math.max(0,Math.floor((p.b-2*p.cover)/(db.diameter+Math.max(25,db.diameter,4*p.aggregate/3))));
    notes.push(`${i+1}/${i+2}차 접합면: ${needed===null?'추가 소요량 판정 보류':needed===0?'추가 다월바 불필요':`추가 ${p.dowel} ${needed}개/줄 @${p.dowelSpacing} mm 필요`} · 입력 ${p.dowelCount}개/줄.`);
    if(count>fit){notes.push('입력 다월바의 폭 내 배치가 불가능하여 그래픽을 생략합니다.');continue;}
    const half=Math.min(p.heights[i],p.heights[i+1])*.23;
    for(let k=0;k<count;k++){
      const cx=X(p.cover+(p.b-2*p.cover)*(k+1)/(count+1)),cy=Y(joint),len=half*scale;
      const proposed=k>=p.dowelCount,color=proposed?'#c36b08':'#b13491';
      const info=`${i+1}/${i+2}차 ${proposed?'필요 다월바 제안 (계산 입력에 미산입)':'입력 다월바'} · ${p.dowel} · @${p.dowelSpacing} mm · 양측 정착 가정`;
      const d=`M${cx} ${cy-len}V${cy+len}`;
      svg+=item(info,`<rect x="${cx-7}" y="${cy-len}" width="14" height="${2*len}" fill="transparent"/><path d="${d}" stroke="${color}" stroke-width="${Math.max(2.5,db.diameter*scale)}" ${proposed?'stroke-dasharray="5 3"':''}/><path class="tb-hit" d="${d}"/>`);
    }
  }
  if(shown===1)notes.push('1차 단면에는 이어치기면이 없습니다.');
  svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="var(--ink)"/><text x="200" y="${y+h+25}" text-anchor="middle">b = ${fmt(p.b)} mm · h = ${fmt(p.h)} mm</text>`;
  get('tb_diagram').innerHTML=`<svg viewBox="0 0 400 ${h+95}" role="group" aria-label="전이보 타설 단계와 철근 단면 미리보기">${svg}</svg><p class="beam-muted">● 파랑: 주철근 · 초록: 스터럽<br>보라 실선: 입력 다월바 · 주황 점선: 필요량 제안</p>`;
  get('tb_graph_note').textContent=notes.join(' ')+' 선택 단계까지의 계산 시점 중 최대 소요량을 표시합니다. 주황 제안은 내력 계산에 자동 산입하지 않습니다. 스터럽은 전체 높이 선조립 가정이며, 다월바 표시 길이·내부 다리 연결은 개념도입니다. 정착길이·철근 간섭은 별도 검토합니다.';
  get('tb_graph_info').textContent='철근을 가리키거나 클릭하세요. 키보드 Tab으로도 정보를 확인할 수 있습니다.';
  get('tb_diagram').querySelectorAll('[data-info]').forEach(el=>['pointerenter','focus','click'].forEach(event=>el.addEventListener(event,()=>{get('tb_graph_info').textContent=el.dataset.info;})));
}
globalThis.TransferBeamDiagram={render};
})();

