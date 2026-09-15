(function(root){'use strict';
const C=root.RCSlabDesign,$=k=>document.getElementById('ts_'+k),f=(v,n=2)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:n}):'—';
const nums=['fck','fy','h','cover','lx','ly','dead','live','MbX','MbY','MtX','MtY','VX','VY'],keys=[...nums,'mode','environment','left','right','bottom','top'];
const values=rows=>'<dl class="beam-values">'+rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')+'</dl>';
const table=(heads,rows)=>'<table class="beam-table"><thead><tr>'+heads.map(v=>`<th>${v}</th>`).join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>`<td>${v}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
const badge=ok=>`<span class="${ok?'ok':'ng'}">${ok?'충족':'미달'}</span>`,faceName=v=>(v.face==='b'?'하부':'상부')+' '+v.axis;
const colors={bX:'#2069a3',bY:'#168777',tX:'#ad5945',tY:'#704ba0'};let last,active='bX';
function diagram(r){
 const p=r.p,w=260*p.lx/Math.max(p.lx,p.ly),h=260*p.ly/Math.max(p.lx,p.ly),x=85,y=55;
 let s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--code)" stroke="var(--line)"/>`;
 const paths={left:`M${x} ${y}v${h}`,right:`M${x+w} ${y}v${h}`,bottom:`M${x} ${y+h}h${w}`,top:`M${x} ${y}h${w}`};
 for(const k of Object.keys(paths))s+=`<path d="${paths[k]}" fill="none" stroke="${p[k]==='fixed'?'#2069a3':'#8499ab'}" stroke-width="${p[k]==='fixed'?7:3}" ${p[k]==='simple'?'stroke-dasharray="6 3"':''}><title>${{left:'왼쪽',right:'오른쪽',bottom:'아래쪽',top:'위쪽'}[k]}: ${p[k]==='fixed'?'고정':'단순'}</title></path>`;
 const v=r.rows.find(v=>v.key===active);for(let i=1;i<=10;i++)s+=`<path d="${v.axis==='X'?`M${x+10} ${y+i*h/11}h${w-20}`:`M${x+i*w/11} ${y+10}v${h-20}`}" stroke="${colors[active]}" stroke-width="2"/>`;
 s+=`<text x="${x+w/2}" y="${y+h+28}" text-anchor="middle">X ${f(p.lx)} m →</text><text transform="translate(52 ${y+h/2}) rotate(-90)" text-anchor="middle">Y ${f(p.ly)} m →</text><text x="${x+w/2}" y="25" text-anchor="middle">지지조건 · 선택 배근 방향</text>`;
 const legend=r.rows.map(v=>`<button type="button" class="slab-steel-item" data-slab="${v.key}" aria-pressed="${active===v.key}" aria-label="${faceName(v)} 철근 선택" style="--steel-color:${colors[v.key]}"><b>${faceName(v)} · ${v.bar} @ ${v.spacing} mm</b><span>φMn ${f(v.phiMn)} kN·m/m</span></button>`).join('');
 $('plot').innerHTML=`<div class="slab-plan-layout"><svg viewBox="0 0 380 365" role="img" aria-label="2방향 슬래브 지지조건 및 자동 제안 배근" style="width:100%;display:block">${s}</svg><div class="slab-steel-list">${legend}</div></div>`;
 $('selection').textContent=`${faceName(v)}: ${v.bar} @ ${v.spacing} mm · d ${f(v.d)} mm · As ${f(v.As,1)} mm²/m. 실선은 고정, 점선은 단순지지입니다. 철근 표기를 클릭하면 방향을 확인할 수 있습니다. 도면은 배근 방향 개념도입니다.`;
}
function run(){
 $('auto').hidden=$('mode').value!=='auto';$('direct').hidden=$('mode').value!=='direct';
 try{
  const p={};for(const k of keys)p[k]=nums.includes(k)?($(k).value.trim()===''?NaN:Number($(k).value)):$(k).value;
  const r=C.twoWay(p);last=r;$('error').hidden=true;$('results').hidden=false;
  $('summary').innerHTML=`<p class="${r.ok?'ok':'ng'}">${r.ok?'휨·전단·배근 검토 충족 · 사용성 검토 별도':'전단내력 또는 두께 미달 · 두께 증가 필요'}</p>`+values([['자동 제안 · 공통 간격',`상·하부 X·Y 모두 ${r.commonSpacing} mm`],...r.rows.map(v=>[faceName(v)+' 철근',`${v.bar} @ ${v.spacing} mm`]),['X / Y 설계전단강도 φVc',`${f(Math.min(...r.rows.filter(v=>v.axis==='X').map(v=>v.phiVc)))} / ${f(Math.min(...r.rows.filter(v=>v.axis==='Y').map(v=>v.phiVc)))} kN/m`]])+'<p class="beam-muted">최소철근·휨·연성·간격을 만족하는 후보 중 철근량이 가장 적은 조합입니다. 정착·이음·국부 보강은 별도입니다.</p>';
  diagram(r);
  $('table').innerHTML=table(['위치','자동 배근','Mu / φMn (kN·m/m)','Vu / φVc (kN/m)','As / 최소 As (mm²/m)','판정'],r.rows.map(v=>[faceName(v),`${v.bar}@${v.spacing}`,`${f(v.Mu)} / ${f(v.phiMn)}`,`${f(v.Vu)} / ${f(v.phiVc)}`,`${f(v.As,1)} / ${f(v.AsMin,1)}`,badge(v.ok)]));
  const a=r.load.plate;
  $('load').innerHTML=a?table(['하중조합','wu (kN/m²)','선정'],r.load.cases.map(c=>[c.name,f(c.q),c===r.load.governing?'지배':'—']))+values([['해석 모델','4변 지지 탄성판 · 균일 등분포하중'],['정·부 설계모멘트','Mx·My와 같은 위치의 비틀림 Mxy를 함께 반영'],['해석망 비교',`${a.coarseN}×${a.coarseN} / ${a.n}×${a.n} · 모멘트 차이 ${f(100*a.convergence)}%`],['전단력 산정','판 전단력과 각 방향 전하중 1 m 보의 전단력 중 큰 값']]):'<p>입력 Mu·Vu는 이미 계수된 설계 포락값입니다. 하중계수를 추가 적용하지 않으며, Mu에는 비틀림에 의한 배근 요구가 포함되어야 합니다.</p>';
  $('basis').innerHTML='<p>KDS 14 20 70 4.1.2.2(1)의 평형·적합 조건에 따른 선형 탄성판 해석입니다. 네 변 모두 수직변위와 모서리 들림이 구속되며, 고정은 회전도 구속합니다. 실제 연속 경간·지지보 변형·활하중 패턴은 포함하지 않습니다. 포아송비 0.20, 미균열 일정 강성입니다.</p><p>하중 자동 계산은 D·L 전용 중력하중 조합 1.4D, 1.2D+1.6L입니다. 자중은 별도 가산하지 않으므로 D에 포함하세요. 각 방향 설계모멘트는 하부 max(0,M+|Mxy|), 상부 max(0,−M+|Mxy|)의 위치별 포락값입니다. 모서리의 상·하부 배근 요구도 포함하여 전 영역에 제안 배근을 적용합니다.</p><p>각 면 X 외측·Y 내측, 반대편 압축철근 효과 제외. 최소철근 ρmin=max(0.002×min(1,400/fy),0.0014), 간격 min(2h,300 mm) 및 KDS 14 20 20 4.2.3 균열제어 간격, 철근망 사이 순간격을 확인합니다. 전단강도 φVc=0.75×min(√fck,8.4)×d/6 (kN/m). 자동 전단의 1 m 보 포락값은 각 방향에 전체 하중을 적용하고 지점 최대 전단을 쓰며 d 위치로 저감하지 않습니다.</p><p>적용 범위: 보·벽으로 네 변이 지지된 사각형 슬래브, 장단변비 2 이하. 무량판·기둥 지지·자유변·개구부·부분하중은 제외합니다. 처짐, 균열폭, 모서리 들림 방지 정착, 뚫림전단 및 실제 지지보의 강성은 별도 검토해야 합니다. 휨·전단 충족은 전체 설계 완료 판정이 아닙니다.</p><p><a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2070" target="_blank" rel="noopener">KDS 14 20 70 · 공식 기준</a></p>';
 }catch(e){last=null;$('error').hidden=false;$('error').textContent=e.message;$('results').hidden=true;for(const k of ['summary','plot','table','load','basis'])$(k).innerHTML='';$('selection').textContent='';}
}
for(const k of keys)for(const event of ['input','change'])$(k).addEventListener(event,run);
for(const event of ['click','keydown'])$('plot').addEventListener(event,e=>{if(event==='keydown'&&!['Enter',' '].includes(e.key))return;const t=e.target.closest('[data-slab]');if(t&&last){if(event==='keydown')e.preventDefault();active=t.dataset.slab;diagram(last);}});
root.runRCSlabTwoWay=run;run();
})(typeof globalThis!=='undefined'?globalThis:this);
