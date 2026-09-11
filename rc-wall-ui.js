(function(root){
'use strict';
const W=root.RCWall,$=id=>document.getElementById(id),fmt=(v,n=1)=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
const badge=ok=>`<span class="${ok?'ok':'ng'}">${ok?'충족':'미달'}</span>`;
let mode='in',last=null;
const inputKeys=['fck','fck_custom','fyv','fyh','t','lw','hw','wallType','bv','sv','bh','sh','cover','outer','method','N','M','V','outMethod','Nv','Mv','Vv','Nh','Mh','Vh'];
const numeric=['fyv','fyh','t','lw','hw','sv','sh','cover','N','M','V','Mv','Vv','Nh','Mh','Vh'];
function read(){
 const p={};for(const k of inputKeys)p[k]=$('w_'+k).value;
 for(const k of numeric)p[k]=p[k].trim()===''?NaN:Number(p[k]);
 p.fck=Number(p.fck==='custom'?p.fck_custom:p.fck);p.Nv=p.Nv.trim()===''?null:Number(p.Nv);return p;
}
const values=rows=>'<dl class="beam-values">'+rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')+'</dl>';
function graph(o){
 const {p,g}=o;let content='';
 const line=(x1,y1,x2,y2,color,width=2,dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
 const txt=(x,y,t,c='')=>`<text x="${x}" y="${y}" text-anchor="middle" ${c?'class="'+c+'"':''}>${t}</text>`;
 const rect=(x,y,w,h,fill,stroke='var(--line)')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`;
 if(mode==='in'){
  const scale=Math.min(300/p.lw,250/p.hw),w=p.lw*scale,h=p.hw*scale,x=200-w/2,y=55+(250-h)/2;
  content+=txt(200,26,'벽체 정면 · 한쪽 철근망 표시')+rect(x,y,w,h,'var(--code)');
  const nv=Math.max(2,Math.min(70,Math.ceil(p.lw/p.sv))),nh=Math.max(2,Math.min(70,Math.ceil(p.hw/p.sh)));
  for(let i=0;i<nv;i++)content+=line(x+w*.05+w*.9*i/(nv-1),y+h*.025,x+w*.05+w*.9*i/(nv-1),y+h-6,'var(--accent)',1.8);
  for(let i=0;i<nh;i++)content+=line(x+6,y+h*.05+h*.9*i/(nh-1),x+w-6,y+h*.05+h*.9*i/(nh-1),'var(--bar)',1.8);
  content+=line(x,y+h+18,x+w,y+h+18,'var(--dim)',1)+txt(200,y+h+39,`lw ${fmt(p.lw,0)} mm`);
  content+=txt(200,365,`hw ${fmt(p.hw,0)} mm · 두께 ${fmt(p.t,0)} mm`);
  content+=txt(580,26,'면내 전단 · 전체 벽 단면')+txt(580,85,`Vu = ${fmt(Math.abs(p.V))} kN`);
  content+=line(475,110,675,110,'var(--accent)',4)+`<path d="M660 101 L678 110 L660 119" fill="none" stroke="var(--accent)" stroke-width="3"/>`;
  content+=txt(580,162,`d = 0.8lw = ${fmt(g.d,0)} mm`)+txt(580,220,`φVn = ${fmt(o.s.phiVn)} kN`)+txt(580,256,`Vc ${fmt(o.s.Vc)} + Vs ${fmt(o.s.Vs)} kN`)+txt(580,302,o.s.used);
  $('w_diagram_note').textContent='파란색 수직철근 · 주황색 수평철근. 앞·뒤 면 동일 배근이며, 정면도는 한쪽 망의 간격을 개념적으로 표시합니다. 각 철근에 적용되는 피복·간격은 입력값과 배근 검토에서 확인하세요.';
 }else{
  const vertical=mode==='v',r=vertical?o.vertical:o.horizontal,f=r.flexure,z=vertical?g.zv:g.zh,area=vertical?g.Av:g.Ah,db=vertical?g.v.diameter:g.h.diameter;
  const sc=Math.min(260/p.t,1.5),h=p.t*sc,x=105,y=65+(260-h)/2,w=180;
  content+=txt(195,26,`${r.label} 면외 · 1 m 폭`)+rect(x,y,w,h,'var(--code)');
  if(f.available){content+=rect(x,y,w,Math.min(p.t,f.a)*sc,'var(--accent)');if(f.c<=p.t)content+=line(x-15,y+f.c*sc,x+w+15,y+f.c*sc,'var(--warn)',1.5,'6 4');}
  for(const depth of [z,p.t-z])for(let i=0;i<5;i++)content+=`<circle cx="${x+16+(w-32)*i/4}" cy="${y+depth*sc}" r="5" fill="var(--bar)"><title>${r.label} 철근 · 표면부터 ${fmt(depth)} mm · 한 면 ${fmt(area)} mm²/m</title></circle>`;
  content+=txt(195,355,`t ${fmt(p.t,0)} mm · d ${fmt(p.t-z)} mm`)+txt(195,382,`한 면 As ${fmt(area)} mm²/m`,'wall-caption');
  const fy=vertical?p.fyv:p.fyh,pts=[];
  const pure=W.flexure(p,area,z,db,fy,0,0);
  for(let i=0;i<100;i++){const c=p.t*.001*Math.pow(10000,i/99),a=W.sectionAt(p,area,z,db,fy,c);if(a.phiMn>=0)pts.push({x:a.phiMn,y:Math.min(f.compressionLimit,a.phiPn)});}
  const maxX=Math.max(1,...pts.map(a=>a.x),f.Mu)*1.12,minY=Math.min(f.tensionLimit,r.N)*1.1,maxY=Math.max(f.compressionLimit,r.N,1)*1.1;
  const X=v=>425+v/maxX*300,Y=v=>325-(v-minY)/(maxY-minY)*245;
  content+=txt(580,26,'면외 축력–휨 단면강도')+line(425,60,425,325,'var(--dim)',1)+line(425,Y(0),740,Y(0),'var(--dim)',1);
  content+=txt(457,53,'φPn (kN/m)','wall-caption');
  for(const load of [0,f.compressionLimit,f.tensionLimit])content+=txt(399,Y(load)+4,fmt(load,0),'wall-caption');
  content+=txt(700,342,'φMn (kN·m/m)','wall-caption');
  content+=`<polyline points="${pts.map(a=>`${X(a.x)},${Y(a.y)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;
  content+=line(425,Y(r.N),X(f.Mu),Y(r.N),'var(--dim)',1,'4 4')+`<circle cx="${X(f.Mu)}" cy="${Y(r.N)}" r="5" fill="${f.ok?'var(--ok)':'var(--ng)'}"><title>설계점 Mu ${fmt(f.Mu)} kN·m/m, Nu ${fmt(r.N)} kN/m</title></circle>`;
  content+=txt(580,365,`φMn = ${f.available?fmt(f.phiMn):'범위 밖'} kN·m/m`)+txt(580,392,`순수휨 φMn ${fmt(pure.phiMn)} · Nu ${fmt(r.N)} kN/m`,'wall-caption');
  $('w_diagram_note').textContent='주황색 철근 · 파란색 압축블록 · 점선 중립축. 단면은 위쪽을 압축면으로 표시하며 양면 대칭이므로 모멘트 방향에 따른 내력은 같습니다. 곡선은 단면강도이고 점은 입력 설계력입니다. 철근 표식은 개념도입니다.';
 }
 $('w_diagram').innerHTML=`<svg viewBox="0 0 800 405" role="img" aria-label="RC 벽체 ${mode==='in'?'면내 전단 배근도':'면외 단면과 축력 휨 곡선'}">${content}</svg>`;
 for(const k of ['in','v','h'])$('w_view_'+k).setAttribute?.('aria-pressed',String(k===mode));
}
function render(o){
 const {p,g,s}=o;
 $('w_summary').innerHTML=`<p class="beam-layout">RC 벽체 · ${fmt(p.t,0)} × ${fmt(p.lw,0)} mm</p><p class="${o.ok?'ok':'ng'}">${o.ok?'입력 단면·배근 검토 충족':'미달 항목 있음 · 상세 결과 확인'}</p><p class="beam-muted">면내 전단 ${badge(o.ipOK)} · 면외 수직 ${badge(o.vertical.flexure.ok&&o.vertical.shear.ok)} · 면외 수평 ${badge(o.horizontal.flexure.ok&&o.horizontal.shear.ok)}</p>`;
 $('w_inplane').innerHTML=`<p class="beam-capacity">${fmt(s.phiVn)} <small>kN · φVn</small></p><p>${badge(o.ipOK)} · ${s.used}</p>`+values([
 ['검토 전단력 |Vu|',fmt(s.demand)+' kN'],['상세식 (4.9-1)',fmt(s.vc1)+' kN'],['상세식 (4.9-2)',s.vc2===null?'미적용':fmt(s.vc2)+' kN'],['Mu/Vu − lw/2',s.denom===null?'미정의':fmt(s.denom)+' mm'],['콘크리트 Vc',fmt(s.Vc)+' kN'],['수평철근 Vs',fmt(s.Vs)+' kN'],['공칭강도 Vn / 상한',`${fmt(s.Vn)} / ${fmt(s.limit)} kN`],['유효깊이 / 강도감소계수',`${fmt(g.d)} mm / 0.75`],['Vu / φVn',s.phiVn>0?fmt(s.demand/s.phiVn,3):s.demand===0?'0.000':'강도 없음']])+`<p class="beam-muted">${s.note} ${s.capReached?'Vn 상한이 지배합니다. 수평철근을 늘려도 현재 단면의 상한을 넘을 수 없습니다.':''}</p>`;
 const dirs=[o.vertical,o.horizontal];
 $('w_outplane').innerHTML='<div class="beam-table-wrap"><table class="beam-table wall-results-table"><thead><tr><th>항목 · 1 m 폭 기준</th><th>수직방향</th><th>수평방향</th></tr></thead><tbody>'+[
 ['입력 축력 Nu (kN/m)',...dirs.map(r=>fmt(r.N))],['설계휨강도 φMn (kN·m/m)',...dirs.map(r=>r.flexure.available?fmt(r.flexure.phiMn):'축력 범위 밖')],['|Mu| / φMn',...dirs.map(r=>`${fmt(r.flexure.Mu)} / ${fmt(r.flexure.phiMn)} · ${badge(r.flexure.ok)}`)],['휨 강도감소계수 φ',...dirs.map(r=>fmt(r.flexure.phi,3))],['중립축 c / 인장변형률 εt',...dirs.map(r=>`${fmt(r.flexure.c)} mm / ${fmt(r.flexure.et,5)}`)],['한 면 철근량 As / 유효깊이 d',...dirs.map(r=>`${fmt(r.flexure.As)} mm²/m / ${fmt(r.shear.d)} mm`)],['설계전단강도 φVc (kN/m)',...dirs.map(r=>fmt(r.shear.phiVn))],['|Vu| / φVc',...dirs.map(r=>`${fmt(r.shear.Vu)} / ${fmt(r.shear.phiVn)} · ${badge(r.shear.ok)}`)],['전단 적용 식',...dirs.map(r=>r.shear.used)],['수정모멘트 Mm (kN·m/m)',...dirs.map(r=>fmt(r.shear.mm))],['Vud/M (또는 Mm)',...dirs.map(r=>fmt(r.shear.ratio,3))]
 ].map(row=>'<tr>'+row.map((v,i)=>`<${i?'td':'th'}>${v}</${i?'td':'th'}>`).join('')+'</tr>').join('')+'</tbody></table></div><p class="beam-muted">면외 전단보강근은 없는 것으로 계산합니다(Vs = 0). 벽면 수직·수평 철근망을 두께방향 전단보강근으로 산입하지 않습니다. 두 방향의 결과는 독립된 단면 검토입니다.</p>'+dirs.filter(r=>r.shear.note||!r.flexure.available).map(r=>`<p class="beam-muted">${r.label}: ${r.shear.note} ${r.flexure.available?'':r.flexure.note}</p>`).join('');
 $('w_checks').innerHTML='<div class="beam-table-wrap"><table class="beam-table"><thead><tr><th>검토 항목</th><th>배치 / 한계</th><th>결과</th></tr></thead><tbody>'+o.checks.map(c=>`<tr><td>${c.label}</td><td>${c.value}</td><td>${badge(c.ok)}</td></tr>`).join('')+'</tbody></table></div>'+`<p class="beam-muted">${s.high?'Vu ≥ φVc/2: 전단보강 벽체 최소철근·간격 규정 적용':'Vu < φVc/2: 일반 벽체 최소철근·간격 규정 적용'}. 수직·수평 철근비는 양면 합계입니다. 수평근 후크정착에 따른 간격 완화는 적용하지 않습니다.</p>`;
 $('w_basis').innerHTML=`<p><b>면내 전단 · KDS 14 20 22, 4.9</b><br>d = 0.8lw, Vc1 = 0.28√fck·t·d + Nu·d/(4lw)<br>Vc2 = [0.05√fck + lw(0.10√fck + 0.2Nu/(lw·t))/(Mu/Vu − lw/2)]·t·d<br>Vs = 2Ah·fy,h·d/sh, Vn ≤ (5/6)√fck·t·d, φ = 0.75. 힘은 N, 길이는 mm로 환산하여 계산합니다. √fck는 8.4 이하, λ = 1.0.</p><p><b>면외 전단 · 4.9.1(1), 4.11.1(2), 4.2.1</b><br>폭 b = 1,000 mm, As는 인장측 한 면의 해당 방향 철근량. 축압축 시 Mm = |Mu| − Nu(4t − d)/8, 축인장 시 식 (4.2-6)을 적용하며 Vc는 0 이상입니다. 2방향 뚫림전단은 포함하지 않습니다.</p><p><b>면외 휨 · KDS 14 20 20, 4.1 / 14 20 72, 4.3.1</b><br>양면 철근 변형률 적합으로 φPn = 입력 Nu인 지점의 φMn을 계산합니다. Es = 200,000 MPa, 콘크리트 응력블록은 표 4.1-2, φ = 0.65–0.85. 철근이 차지하는 콘크리트 체적을 공제합니다. 압축축력 상한은 보수적으로 띠철근 압축부재의 0.8 × 0.65 × P0를 적용합니다. 전체 벽체의 좌굴·안정성 판정을 대신하지 않습니다.</p><p>양면 동일 배근, 지름·단면적은 기존 KS 철근표 사용. 면외 수직 축력 ${p.Nv===null?'자동 환산 Nu/lw':'직접 입력'} = ${fmt(o.Nv)} kN/m. 피복은 노출환경·내화·정착 검토를 거쳐 결정해야 합니다.</p>`;
 graph(o);
}
function run(){
 $('w_custom_field').hidden=$('w_fck').value!=='custom';
 try{const o=W.calculate(read());last=o;$('w_error').hidden=true;$('w_results').hidden=false;render(o);}
 catch(e){last=null;$('w_error').textContent=e.message;$('w_error').hidden=false;$('w_results').hidden=true;for(const id of ['summary','diagram','inplane','outplane','checks','basis'])$('w_'+id).innerHTML='';$('w_diagram_note').textContent='';}
}
for(const k of inputKeys){$('w_'+k).addEventListener('input',run);$('w_'+k).addEventListener('change',run);}
for(const k of ['in','v','h'])$('w_view_'+k).addEventListener('click',()=>{mode=k;if(last)graph(last);});
root.runRCWall=run;run();
})(typeof globalThis!=='undefined'?globalThis:this);
