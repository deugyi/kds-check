(function(root){'use strict';
const E=root.FootingJoint,$=k=>document.getElementById('fj_'+k),R=root.RCBeam;
const F=(v,n=2)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:n}):'—';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=k=>String($(k).value).trim()===''?NaN:Number($(k).value);
const opt=(v,t)=>`<option value="${v}">${t}</option>`;
const table=(headers,rows)=>'<table class="beam-table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const dl=rows=>'<dl class="beam-values">'+rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')+'</dl>';
const yes=ok=>`<span style="color:var(${ok?'--ok':'--ng'})">${ok?'충족':'확인 필요'}</span>`;
const phaseName=r=>`${r.stage}차 ${r.wet?'타설 중':'양생 후'}`;
const status={cap:'콘크리트 접합면 상한 초과',existing:'추가 다월바 불필요',proposed:'추가 다월바 제안',anchorage:'인접 타설층 정착길이 부족',spacing:'@100~@300 범위 내 배근 불가'};
const keys=['mode','fck','fy','fyt','fyd','bx','by','h','cx','cy','cover','Ps','Pu','qa','pileCount','diameter','gapFactor','pileAllow','barX','barY','spacing','crossBar','crossLegs','crossSX','crossSY','dowel','surface','strengthMode','cement','temperature'];
const strings=['mode','barX','barY','crossBar','dowel','surface','strengthMode','cement'];
let stages=E.clone(E.defaults.stages),strengths={},edit=0,last=null;
function input(){const p={stages,strengths};for(const k of keys)p[k]=strings.includes(k)?$(k).value:num(k);return p;}
function fillStage(){
 $('edit').innerHTML=stages.map((_,i)=>opt(i,(i+1)+'차')).join('');$('edit').value=String(edit);
 const s=stages[edit];for(const k of ['height','days','load'])$(k).value=Number.isFinite(s[k])?s[k]:'';
 for(const phase of ['wet','cured'])for(const k of ['mx','my','vx','vy'])$(phase+'_'+k).value=Number.isFinite(s[phase][k])?s[phase][k]:'';
 strengthFields();
}
function strengthFields(){
 const k=edit+1,auto=$('strengthMode').value==='estimate';$('estimate').hidden=!auto;
 if(auto){try{
  const a=ConcreteAge.schedule(num('fck'),$('cement').value,num('temperature'),stages.map(s=>s.days));
  $('strengths').innerHTML=`<p class="beam-muted">${k}차 양생 후 · 누적 재령을 반영한 간편 추정</p>`+dl(a.details[k].map((v,i)=>[`${i+1}차 · ${F(v.days)}일`,`${F(v.applied)} MPa`]))+'<p class="beam-muted">전이보와 같은 온도 보정 모델입니다. 추정 평균강도에서 Δf를 공제하고 fck 이하로 제한한 값을 내력에 적용합니다.</p>';
 }catch(e){$('strengths').textContent=e.message;}return;}
 strengths[k]??=[];
 $('strengths').innerHTML=`<p class="beam-muted">${k}차 양생 후 시점에 각 타설층에서 확인한 강도입니다.</p>`+stages.slice(0,k).map((_,i)=>`<label><b>${i+1}차 콘크리트 (MPa)</b><input id="fj_fc_${i}" type="number" step="any" value="${Number.isFinite(strengths[k][i])?strengths[k][i]:''}" placeholder="확인 강도 입력"></label>`).join('');
 stages.slice(0,k).forEach((_,i)=>$('fc_'+i).addEventListener('input',()=>{strengths[k][i]=num('fc_'+i);render(false);}));
}
function draw(r,ph){
 const p=r.p,g=r.g,axis=$('axis').value,span=axis==='X'?g.bx:g.by;
 const sc=Math.min(410/span,255/p.h),w=span*sc,h=p.h*sc,x=465+(410-w)/2,y=50+255-h,Y=z=>y+h-z*sc;
 const item=(info,shape)=>`<g role="button" tabindex="0" data-info="${esc(info)}" aria-label="${esc(info)}"><title>${esc(info)}</title>${shape}</g>`;
 let svg='<text x="200" y="25" text-anchor="middle">기초 평면 · X → / Y ↑</text><text x="670" y="25" text-anchor="middle">'+axis+' 단면 · '+phaseName(ph)+'</text>';
 const ps=Math.min(290/g.bx,255/g.by),pw=g.bx*ps,pl=g.by*ps,px=200-pw/2,py=50+(255-pl)/2;
 const X=v=>px+(v*1000-g.bounds.left*1000)*ps,Z=v=>py+pl-(v*1000-g.bounds.bottom*1000)*ps;
 svg+=`<rect x="${px}" y="${py}" width="${pw}" height="${pl}" fill="#eef3f7" stroke="#2878b5"/>`;
 if(p.mode!=='mat')svg+=item('기둥 중심 · 기둥 모멘트 0',`<rect x="${X(-p.cx/2000)}" y="${Z(p.cy/2000)}" width="${p.cx*ps}" height="${p.cy*ps}" fill="#2878b5" opacity=".6"/>`);
 for(const v of g.points){const reaction=ph.piles?.find(a=>a.id===v.id);svg+=item(`파일 ${v.id} · 사용반력 ${F(reaction?.Rs)} / 계수반력 ${F(reaction?.Ru)} kN`,`<circle cx="${X(v.x)}" cy="${Z(v.y)}" r="${p.diameter/2*ps}" fill="#d2e9e2" stroke="#168777"/><text x="${X(v.x)}" y="${Z(v.y)+4}" text-anchor="middle">${v.id}</text>`);}
 svg+=`<text x="200" y="337" text-anchor="middle">${F(g.bx,0)} × ${F(g.by,0)} mm</text>`;
 let z=0;
 stages.forEach((s,i)=>{z+=s.height;const active=i<ph.active,wet=i===ph.stage-1&&ph.wet;
  svg+=item(`${i+1}차 · 높이 ${F(s.height)} mm · ${active?'내력 적용 강도 '+F(ph.values?.[i])+' MPa':wet?'새 콘크리트 · 내력 미산입':'미타설'}`,`<rect x="${x}" y="${Y(z)}" width="${w}" height="${s.height*sc}" fill="${E.COLORS[i]}" opacity="${active?.3:wet?.15:.045}"/><path d="M${x} ${Y(z)}h${w}" stroke="${E.COLORS[i]}" stroke-dasharray="5 4"/><text x="${x-8}" y="${Y(z-s.height/2)+4}" text-anchor="end">${i+1}차</text>`);
 });
 // Bars are sampled in the diagram only; calculations always use exact spacing/area.
 const n=Math.max(2,Math.ceil((span-2*p.cover)/p.spacing)+1),drawN=Math.min(n,20),bar=R.BARS[p['bar'+axis]],bottom=p.cover+(axis==='X'?bar.diameter/2:R.BARS[p.barX].diameter+bar.diameter/2);
 for(let i=0;i<drawN;i++){
  const cx=x+(p.cover+(span-2*p.cover)*i/(drawN-1))*sc;
  for(const top of [false,true]){const zz=top?p.h-bottom:bottom;svg+=item(`${axis} ${top?'상부':'하부'} ${p['bar'+axis]}@${p.spacing} · ${top&&ph.H<p.h?'마지막 차수 양생 후 내력 산입':'입력 주철근'}`,`<circle cx="${cx}" cy="${Y(zz)}" r="${Math.max(2.2,bar.diameter*sc/2)}" fill="#2447a5" opacity="${top&&ph.H<p.h?.3:1}"/>`);}
 }
 if(p.crossLegs>0){const count=Math.min(12,Math.max(2,Math.ceil(span/(axis==='X'?p.crossSX:p.crossSY))));for(let i=0;i<count;i++){
  const cx=x+w*(i+1)/(count+1);svg+=item(`기존 관통철근 ${p.crossBar} · 격자당 ${p.crossLegs}다리, ${p.crossSX}×${p.crossSY} mm · 양측 정착 충족 시에만 산입`,`<path d="M${cx} ${Y(p.cover)}V${Y(p.h-p.cover)}" stroke="#168777" stroke-width="1.6"/><rect x="${cx-5}" y="${Y(p.h-p.cover)}" width="10" height="${(p.h-2*p.cover)*sc}" fill="transparent"/>`);
 }}
 let joint=0;
 for(let j=0;j<stages.length-1;j++){
  joint+=stages[j].height;const envelope=r.joints[j];
  if(j+1>=ph.active||!envelope.additional||envelope.blocked||!envelope.spacing)continue;
  const lo=envelope.lo,up=envelope.up;
  const count=Math.min(12,Math.max(2,Math.ceil(span/envelope.spacing)));
  for(let i=0;i<count;i++){const xx=x+w*(i+.5)/count;svg+=item(`${j+1}/${j+2}차 추가 다월바 ${p.dowel}@${envelope.spacing} · X/Y 격자 · 하부 정착 ${F(lo)} / 상부 ${F(up)} mm`,`<path d="M${xx} ${Y(joint-lo)}V${Y(joint+up)}" stroke="#cf720e" stroke-width="3" stroke-dasharray="5 2"/><rect x="${xx-5.5}" y="${Y(joint+up)}" width="11" height="${(lo+up)*sc}" fill="transparent"/>`);}
 }
 svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#2878b5"/><text x="670" y="337" text-anchor="middle">전체 ${F(p.h)} mm · 내력 적용 ${F(ph.H)} mm</text><text x="450" y="376" text-anchor="middle">파랑: 상하부근 · 초록: 기존 관통철근 · 주황 점선: 추가 다월바 제안</text><text x="450" y="400" text-anchor="middle">철근은 일부를 표시한 배치 개념도입니다. 클릭하면 상세값을 확인할 수 있습니다.</text>`;
 $('diagram').innerHTML='<svg viewBox="0 0 900 425" role="group" aria-label="기초 평면과 타설층·철근 단면">'+svg+'</svg>';
}
function render(refreshStrength=true){
 const mode=$('mode').value,mat=mode==='mat';
 for(const k of ['axial','column','load_field'])$(k).hidden=mat;
 $('soil').hidden=mode!=='soil';$('pile').hidden=mode!=='pile';$('mat_note').hidden=!mat;
 $('wet_inputs').hidden=$('cured_inputs').hidden=!mat;$('bx').readOnly=$('by').readOnly=mode==='pile';
 if(refreshStrength)strengthFields();
 try{
  const r=E.calculate(input());last=r;const p=r.p;
  if(mode==='pile'){$('bx').value=r.g.bx;$('by').value=r.g.by;}
  const old=Number($('view').value);$('view').innerHTML=r.phases.map((a,i)=>opt(i,phaseName(a))).join('');$('view').value=String(Math.min(Number.isFinite(old)?old:r.phases.length-1,r.phases.length-1));
  const ph=r.phases[Number($('view').value)];$('error').hidden=true;$('results').hidden=false;
  $('summary').innerHTML=dl([['검토 형식',{soil:'지내력 독립기초',pile:'파일 독립기초 · 접합면 예비 검토',mat:'매트기초 · 1 m 폭 해석력 입력'}[mode]],['기초 크기',`${F(r.g.bx)} × ${F(r.g.by)} × ${F(p.h)} mm`],['선택 시점',phaseName(ph)],['내력 적용 최소 강도',F(ph.fc)+' MPa'],['시점별 계산 상태',esc(ph.message)],['상하부 주철근',`X ${p.barX}@${p.spacing} / Y ${p.barY}@${p.spacing}`]]);
  draw(r,ph);$('info').textContent='타설층·철근·파일을 클릭하거나 키보드로 선택해 정보를 확인하세요.';
  $('joint_summary').innerHTML=r.joints.map((j,i)=>`<p><b>${i+1}/${i+2}차 접합면</b> · ${j.missing?'발현강도 미확인 시점이 있어 제안 보류':j.blocked?'접합면 상한·정착·간격 조건 확인 필요':j.spacing?`추가 ${p.dowel}@${j.spacing} (X·Y 동일 격자, 각 격자점 1본)`:'기존 관통철근으로 계산상 전달 가능 · 추가 불필요'}${j.governing?`<br>최대 추가 소요량 ${F(j.governing.required)} mm²/m² · ${phaseName(j.governing)}`:''}</p>`).join('');
  $('phases').innerHTML=table(['시점','내력 / 하중 높이 (mm)','최소 fc (MPa)','축력 비율 (%)','Mu,X / Mu,Y (kN·m/m)','Vu,X / Vu,Y (kN/m)','시점별 결과'],r.phases.map(a=>[phaseName(a),F(a.H)+' / '+F(a.loaded),F(a.fc),a.load===null?'직접 입력':F(a.load),a.axes?a.axes.map(v=>F(v.Mu)).join(' / '):'—',a.axes?a.axes.map(v=>F(v.Vu)).join(' / '):'—',esc(a.message)]));
  const jointRows=r.phases.flatMap(a=>a.interfaces.map(j=>[phaseName(a),`${j.index+1}/${j.index+2}차 · ${F(j.joint)} mm`,j.stresses.map(v=>F(v.tau,3)).join(' / '),F(j.tau,3),F(j.existing,3),F(j.cap,3),F(j.required),j.proposal?`${p.dowel}@${j.proposal.spacing}`:'—',`${status[j.status]}${p.crossLegs>0&&(!j.lower.ok||!j.upper.ok)?'<br>기존 철근 정착 부족 · 기여 0':''}<br>다월바 ld 하/상 ${F(j.lowerD.required)}/${F(j.upperD.required)} mm · 확보 ${F(j.lowerD.available)}/${F(j.upperD.available)} mm`]));
  $('joints').innerHTML=jointRows.length?table(['시점','이어치기면','τX / τY (MPa)','합성 τu (MPa)','기존 철근 φτ (MPa)','콘크리트 상한 (MPa)','추가 Avf (mm²/m²)','추가 배근안','정착·판정'],jointRows):'<p class="beam-muted">두 층 이상 양생된 시점의 강도가 확인되면 접합면을 검토합니다.</p>';
  $('capacity').innerHTML=ph.checks?table(['방향','Mu (kN·m/m)','φMn (kN·m/m)','휨·배근','수직 Vu (kN/m)','φVc (kN/m)','수직 전단'],ph.checks.map(a=>[a.axis,F(a.Mu),F(a.phiMn),a.reverseMissing?'중간층 상부 인장근 미반영':yes(a.flexOK&&a.steelOK),F(a.shearVu),F(a.phiVc),yes(a.shearOK)])):'<p class="beam-muted">'+esc(ph.message)+'</p>';
  if(ph.punching)$('capacity').innerHTML+=ph.punching.status==='outside'?'<p class="beam-muted">기둥면 d/2 위험둘레가 기초 외곽을 벗어나므로 뚫림 검토는 별도입니다.</p>':dl([['기둥 주변 뚫림 Vu',F(ph.punching.Vu)+' kN'],['뚫림 응력 / 콘크리트 설계내력',F(ph.punching.vu,3)+' / '+F(ph.punching.phiV,3)+' MPa · '+yes(ph.punching.ok)]]);
  $('reactions').innerHTML=ph.bearing?dl([['기초 자중 · 굳지 않은 콘크리트 포함',F(ph.W)+' kN'],['최대 사용 반력 / 허용값',F(ph.bearing.value)+' / '+F(ph.bearing.limit)+' '+ph.bearing.unit+' · '+yes(ph.bearing.ok)]]):'';
  if(ph.piles?.length)$('reactions').innerHTML+=table(['파일','X (m)','Y (m)','사용반력 (kN)','계수반력 (kN)'],ph.piles.map(v=>[v.id,F(v.x,3),F(v.y,3),F(v.Rs),F(v.Ru)]));
  $('basis').innerHTML=`<ul><li>타설 중에는 직전 양생 시점의 굳은 단면·발현강도만 내력에 사용합니다. 새 콘크리트는 하중에만 포함하며 새 접합면의 합성효과는 인정하지 않습니다. 1차 타설 중 지반·거푸집·동바리 검토는 별도입니다.</li><li>${mat?'매트기초는 해당 시점의 계수 Mu·Vu를 1 m 폭 기준으로 직접 입력합니다. 기초 자중을 추가 가산하지 않습니다. 입력한 힘은 타설단계 해석에서 구한 값이어야 합니다.':mode==='soil'?'지내력 기초는 균일 접지압에서 분포 자중을 차감한 순반력으로 X/Y 단면력을 구합니다. 상부 구조 축력이 없는 상태에서 균일 자중은 지반 반력과 상쇄됩니다.':'파일은 동일 축강성, 파일군 도심=기둥 중심입니다. 전체 타설 자중과 기초 외곽 편심을 반력에 반영합니다. 접합면에는 파일 중심 집중반력에 의한 전단력 최댓값을 전체 폭으로 나누어 적용합니다. 파일캡의 스트럿-타이·파일 주변 국부 뚫림·군파일 위험둘레는 별도이며 전체 기초 적합 판정이 아닙니다.'}</li><li>접합면 전단은 층별 탄성계수를 적용한 비균열·균열 환산단면의 VQ/(Ib) 중 큰 값입니다. 균열단면은 인장 콘크리트를 제외합니다. τu=√(τX²+τY²)로 양방향 성분의 최댓값을 함께 조합하므로 발생 위치가 다르면 보수적 포락값입니다. 독립기초는 양쪽 휨 부호를 포락합니다. 단계별 하중 이력에 따른 슬립·크리프·수축의 정밀 비선형 해석은 아닙니다.</li><li>기존 관통철근은 격자당 다리 수 × 철근 면적 × 10⁶/(sX·sY)로 mm²/m²를 계산합니다. 정착이 유효한 면적만 φμAvf·fy/10⁶에 산입합니다. φ=0.75, μ=${p.surface==='rough'?'1.0 (레이턴스 제거·약 6 mm 요철 거칠기)':'0.6'}, fy≤500 MPa. 영구 순압축력에 의한 마찰 증가는 산입하지 않습니다. 접합면 순인장·박리는 별도 검토입니다.</li><li>콘크리트 접합면 상한은 약한 콘크리트의 강도로 산정합니다. 추가 다월바는 상한 이내에서 ${p.dowel}의 @300부터 @100까지 10 mm 단위로 검색합니다. 상한을 초과하면 철근 추가만으로 충족 판정하지 않습니다. 모든 검토 시점의 강도·정착이 확인된 접합면만 종합 배근안을 표시합니다.</li><li>정착은 무도막 수직 직선철근, 보통중량 콘크리트, Ktr=0으로 검토합니다. 기존 관통철근은 현재 굳은 높이 내 양측 정착을, 추가 다월바는 인접 타설층 내 양측 정착을 확인합니다. 갈고리·기계식 정착은 별도 상세입니다. 수직 전단용으로 필요한 철근과 접합면 철근의 저항을 동시에 중복 사용할 수 있는지는 별도 설계해야 합니다.</li><li>주철근은 상하부 동일 규격·간격으로 입력하며 최상부근은 최종 양생 후에만 산입합니다. 중간 타설층 상부근, 주철근 정착·기둥 지압·침하·수화열·수밀성과 전단 보강 설계는 별도입니다. 매트기초의 기둥 주변 뚫림은 1 m 폭 해석력만으로 판정하지 않습니다.</li></ul><p><a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2022" target="_blank" rel="noopener">KDS 14 20 22 · 4.6 전단마찰</a> · <a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2052" target="_blank" rel="noopener">KDS 14 20 52 · 직선 정착</a> · <a href="https://www.kcsc.re.kr/standardCode/viewer/KDS%2014%2020%2070" target="_blank" rel="noopener">KDS 14 20 70 · 기초판</a></p>`;
 }catch(e){last=null;$('error').hidden=false;$('error').textContent=e.message;$('results').hidden=true;for(const k of ['summary','diagram','phases','joints','capacity','reactions','basis','joint_summary'])$(k).innerHTML='';}
}
for(const k of keys)$(k).addEventListener('input',()=>render());
for(const k of ['height','days','load'])$(k).addEventListener('input',()=>{stages[edit][k]=num(k);render();});
for(const phase of ['wet','cured'])for(const k of ['mx','my','vx','vy'])$(phase+'_'+k).addEventListener('input',()=>{stages[edit][phase][k]=num(phase+'_'+k);render();});
$('edit').addEventListener('change',()=>{edit=Number($('edit').value);fillStage();render();});
function equal(resize){
 const n=num('count'),h=num('h');if(!Number.isInteger(n)||n<2||n>5||!Number.isFinite(h)||h<=0){render();return;}
 if(resize){stages=Array.from({length:n},(_,i)=>({...E.clone(E.defaults.stages[Math.min(i,1)]),load:i===n-1?100:0}));strengths={};}
 const base=Math.floor(h/n);stages.forEach((s,i)=>s.height=i===n-1?h-base*(n-1):base);edit=Math.min(edit,n-1);$('view').value=String(2*n-1);fillStage();render();
}
$('count').addEventListener('input',()=>equal(true));$('equal').addEventListener('click',()=>equal(false));
$('view').addEventListener('change',()=>render(false));$('axis').addEventListener('change',()=>render(false));
for(const event of ['click','focusin','pointerover'])$('diagram').addEventListener(event,e=>{const t=e.target.closest('[data-info]');if(t)$('info').textContent=t.getAttribute('data-info');});
fillStage();render();
})(globalThis);
