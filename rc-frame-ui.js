(function(root){'use strict';
const F=root.RCFrame,$=id=>document.getElementById(id),fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const clone=x=>JSON.parse(JSON.stringify(x));
const newColumn=()=>({L:3,b:600,h:600,end:'fixed'}),newSpan=()=>({L:6,b:400,h:600,hingeI:false,hingeJ:false,loads:[{type:'uniform',value:30,a:0,b:6,rise:1.5,fall:1.5,full:true}]}),newSupport=()=>({type:'both',upper:newColumn(),lower:newColumn()});
let spans=Array.from({length:10},newSpan),supports=Array.from({length:11},newSupport),count=3,beam=0,node=0,load=0,view='M',result=null;
const names={both:'상·하부 기둥',upper:'상부 기둥',lower:'하부 기둥',pin:'직접 단순지지',fixed:'직접 고정지지',free:'지지 없음'},types={uniform:'Wu · 등분포',trapezoid:'Wu · 사다리꼴',point:'Pu · 집중하중',moment:'Mu · 집중모멘트'};
function val(id){const s=$('fr_'+id).value;return s.trim()===''?NaN:Number(s);}
function set(id,v){$('fr_'+id).value=String(v);}
function options(id,items,value){$('fr_'+id).innerHTML=items.map(([v,label])=>`<option value="${v}">${label}</option>`).join('');set(id,value);}
function selectors(){options('beam',Array.from({length:count},(_,i)=>[i,`${i+1}경간`]),beam);options('node',Array.from({length:count+1},(_,i)=>[i,`절점 ${i+1}`]),node);}
function beamFields(){const b=spans[beam];for(const k of ['L','b','h'])set(k,b[k]);set('hingeI',b.hingeI?'hinge':'rigid');set('hingeJ',b.hingeJ?'hinge':'rigid');load=Math.min(load,Math.max(0,b.loads.length-1));loadFields();}
function nodeFields(){const s=supports[node];set('support',s.type);for(const dir of ['upper','lower']){const c=s[dir];set(dir+'L',c.L);set(dir+'B',c.b);set(dir+'H',c.h);set(dir+'End',c.end);$('fr_'+dir+'_fields').hidden=!(s.type===dir||s.type==='both');}}
function loadVisibility(){const q=spans[beam].loads[load];if(!q)return;$('fr_load_value_label').textContent=q.type==='point'?'Pu (kN)':q.type==='moment'?'Mu (kN·m)':'Wu (kN/m)';const dist=q.type==='uniform'||q.type==='trapezoid';$('fr_extent_field').hidden=!dist;$('fr_end_field').hidden=!dist;$('fr_rise_field').hidden=q.type!=='trapezoid';$('fr_fall_field').hidden=q.type!=='trapezoid';$('fr_loadA').readOnly=dist&&q.full;$('fr_loadB').readOnly=dist&&q.full;}
function loadFields(){const b=spans[beam],q=b.loads[load];options('load',b.loads.length?b.loads.map((v,i)=>[i,`하중 ${i+1} · ${types[v.type]}`]):[['','하중 없음']],q?load:'');$('fr_load_fields').hidden=!q;if(!q)return;set('loadType',q.type);set('loadValue',q.value);set('extent',q.full?'full':'partial');set('loadA',q.full&&(q.type==='uniform'||q.type==='trapezoid')?0:q.a);set('loadB',q.full?b.L:q.b);set('rise',q.rise);set('fall',q.fall);loadVisibility();}
function model(){return {fck:val('fck'),spans:spans.slice(0,count).map(b=>({...b,loads:b.loads.map(q=>({...q,...(q.full&&(q.type==='uniform'||q.type==='trapezoid')?{a:0,b:b.L}:{})}))})),supports:supports.slice(0,count+1)};}
const text=(x,y,s,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
const line=(a,b,c,d,color='var(--dim)',width=2)=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${color}" stroke-width="${width}"/>`;
const svg=(h,body,label)=>`<svg viewBox="0 0 1000 ${h}" role="img" aria-label="${label}">${body}</svg>`;
function positions(){const xs=[0];for(let i=0;i<count;i++)xs.push(xs[i]+(Number.isFinite(spans[i].L)&&spans[i].L>0?spans[i].L:1));return xs.map(x=>55+x/xs[count]*890);}
function frameDrawing(){
 const xs=positions(),base=170,maxCol=Math.max(1,...supports.slice(0,count+1).flatMap(s=>[s.upper.L,s.lower.L]).filter(Number.isFinite));let s='';
 for(let i=0;i<=count;i++){
  const x=xs[i],sup=supports[i];
  for(const dir of ['upper','lower'])if(sup.type===dir||sup.type==='both'){
   const y=base+(dir==='upper'?-1:1)*Math.max(25,Math.min(120,sup[dir].L/maxCol*120));
   s+=line(x,base,x,y,'var(--dim)',5);s+=sup[dir].end==='fixed'?`<rect x="${x-9}" y="${y-3}" width="18" height="6" fill="var(--dim)"/>`:`<circle cx="${x}" cy="${y}" r="5" fill="var(--panel)" stroke="var(--dim)"/>`;
  }
  if(sup.type==='pin')s+=`<path d="M${x} ${base+8} l-10 17 h20 z" fill="var(--panel)" stroke="var(--ink)"/>`;
  if(sup.type==='fixed')s+=`<rect x="${x-10}" y="${base+5}" width="20" height="10" fill="var(--dim)"/>`;
  if(sup.type==='free')s+=text(x,base+36,i===0||i===count?'자유단':'무지지');
 }
 for(let i=0;i<count;i++){
  s+=`<g role="button" tabindex="0" data-beam="${i}" aria-label="${i+1}경간 선택">${line(xs[i],base,xs[i+1],base,i===beam?'var(--accent)':'var(--ink)',i===beam?8:5)}${line(xs[i],base,xs[i+1],base,'transparent',22)}${text((xs[i]+xs[i+1])/2,base-25,`${i+1}경간`)}${text((xs[i]+xs[i+1])/2,base+57,`${fmt(spans[i].L)} m`)}</g>`;
  if(spans[i].hingeI)s+=`<circle cx="${xs[i]+8}" cy="${base}" r="4" fill="var(--panel)" stroke="var(--accent)"/>`;
  if(spans[i].hingeJ)s+=`<circle cx="${xs[i+1]-8}" cy="${base}" r="4" fill="var(--panel)" stroke="var(--accent)"/>`;
 }
 for(let i=0;i<=count;i++)s+=`<g role="button" tabindex="0" data-node="${i}" aria-label="절점 ${i+1} 선택"><rect x="${xs[i]-14}" y="${base-14}" width="28" height="180" fill="transparent"/><circle cx="${xs[i]}" cy="${base}" r="7" fill="${i===node?'var(--bar)':'var(--panel)'}" stroke="var(--accent)" stroke-width="2"/>${text(xs[i],320,`${i+1}`)}</g>`;
 s+=text(500,25,'선택 보: 파란색 · 선택 절점: 주황색');$('fr_model').innerHTML=svg(345,s,'보와 상하부 기둥 평면 프레임');
}
function loadDrawing(){
 const b=spans[beam],qs=model().spans[beam].loads,X=x=>65+870*x/(b.L||1),max=Math.max(1,...qs.map(q=>Math.abs(q.value)).filter(Number.isFinite));let s='';
 qs.forEach((q,i)=>{const y=i*90+60,color=i===load?'var(--accent)':'var(--dim)';s+=line(65,y,935,y);s+=text(65,y-44,`${i+1}. ${types[q.type]} · ${fmt(q.value)} ${q.type==='moment'?'kN·m':q.type==='point'?'kN':'kN/m'}`,'start');
  if(![q.value,q.a,b.L].every(Number.isFinite))return;
  if(q.type==='point'){const a=X(q.a),v=q.value>=0?-32:32;s+=line(a,y+v,a,y,color,3)+`<path d="M${a-5} ${y+Math.sign(v)*8} L${a} ${y} L${a+5} ${y+Math.sign(v)*8}" fill="none" stroke="${color}" stroke-width="2"/>`+text(a,y+24,`${fmt(q.a)} m`);}
  else if(q.type==='moment')s+=text(X(q.a),y-6,q.value>=0?'↺':'↻')+text(X(q.a),y+24,`${fmt(q.a)} m`);
  else if([q.b,q.rise,q.fall].every(Number.isFinite)){
   const top=y-q.value/max*30,pts=q.type==='uniform'?[[q.a,top],[q.b,top]]:[[q.a,q.rise===0?top:y],[q.a+q.rise,top],[q.b-q.fall,top],[q.b,q.fall===0?top:y]];
   s+=`<polygon points="${X(q.a)},${y} ${pts.map(([x,y])=>`${X(x)},${y}`).join(' ')} ${X(q.b)},${y}" fill="${color}" fill-opacity=".18" stroke="${color}"/>`;
   s+=text(X(q.a),y+24,`${fmt(q.a)} m`)+text(X(q.b),y+24,`${fmt(q.b)} m`);
  }
 });
 $('fr_load_diagram').innerHTML=qs.length?svg(qs.length*90,s,`${beam+1}경간에 중첩된 입력 하중`):'<p class="beam-muted">이 경간에는 입력 하중이 없습니다.</p>';
 $('fr_load_note').textContent=`${beam+1}경간 · ${qs.length}개 하중 중첩. 양수 Wu·Pu는 아래 방향, 양수 Mu는 반시계 방향입니다. 입력이 범위를 벗어나면 해석 결과를 표시하지 않습니다.`;
}
const table=(headers,rows)=>'<div class="beam-table-wrap"><table class="beam-table"><thead><tr>'+headers.map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';
function plot(){
 if(!result)return;const xs=positions(),max=Math.max(1e-9,...result.beams.flatMap(e=>e.points.map(p=>Math.abs(p[view])))),sign=view==='M'?1:-1,Y=v=>165+sign*v/max*110;let s=line(55,165,945,165,'var(--dim)',1);
 for(let i=0;i<count;i++){const e=result.beams[i],X=x=>xs[i]+x/(e.L/1000)*(xs[i+1]-xs[i]);s+=`<polyline points="${e.points.map(p=>`${X(p.x)},${Y(p[view])}`).join(' ')}" fill="none" stroke="${i===beam?'var(--accent)':'var(--dim)'}" stroke-width="${i===beam?3:2}"/>`;
  const ex=e.extrema[view],worst=Math.abs(ex.min[view])>Math.abs(ex.max[view])?ex.min:ex.max;s+=text(X(worst.x),Math.max(34,Math.min(295,Y(worst[view])+(Y(worst[view])>=165?19:-9))),fmt(worst[view]));s+=text((xs[i]+xs[i+1])/2,318,`${i+1}경간`);
 }
 const units={M:'kN·m',V:'kN',v:'mm',N:'kN'},labels={M:'휨모멘트',V:'전단력',v:'수직변위',N:'축력'};
 s+=text(500,20,`${labels[view]} (${units[view]}) · ${view==='v'?'하중에 의한 부재 내부 변위 포함':'모든 경간 동일 세로 배율'}`);
 const e=result.beams[beam],x=e.L*Number($('fr_probe').value)/100,l=F.at(e,x,'left'),r=F.at(e,x,'right'),xx=xs[beam]+x/e.L*(xs[beam+1]-xs[beam]);
 s+=line(xx,40,xx,290,'var(--bar)',1)+`<circle cx="${xx}" cy="${Y(r[view])}" r="5" fill="var(--bar)"/>`;
 $('fr_plot').innerHTML=svg(340,s,labels[view]+' 결과도');
 const pair=k=>Math.abs(l[k]-r[k])>1e-6?`${fmt(l[k])} → ${fmt(r[k])} (좌 → 우)`:fmt(r[k]);
 $('fr_probe_result').innerHTML=`<b>${beam+1}경간 · 왼쪽부터 ${fmt(x/1000,3)} m</b><br>M ${pair('M')} kN·m · V ${pair('V')} kN · N ${pair('N')} kN · δ ${fmt(r.v,3)} mm`;
 for(const k of ['M','V','v','N'])$('fr_view_'+k).setAttribute?.('aria-pressed',String(k===view));
}
function results(o){
 $('fr_summary').innerHTML=`<p class="beam-layout">${count}경간 · 전체 ${fmt(o.length)} m</p><p class="ok">선형 해석 완료 · 전체 평형 확인</p><p class="beam-muted">Ec ${fmt(o.E,0)} MPa · 보 ${count}개 · 기둥 ${o.columns.length}개 · 횡이동 구속</p>`;
 $('fr_beam_results').innerHTML=table(['보','M 최대 (kN·m)','M 최소 (kN·m)','|V| 최대 (kN)','|δ| 최대 (mm)'],o.beams.map((e,i)=>{const ex=e.extrema,def=Math.abs(ex.v.min.v)>Math.abs(ex.v.max.v)?ex.v.min:ex.v.max;return [`${i+1}경간`,`${fmt(ex.M.max.M)} @ ${fmt(ex.M.max.x)} m`,`${fmt(ex.M.min.M)} @ ${fmt(ex.M.min.x)} m`,fmt(Math.max(Math.abs(ex.V.min.V),Math.abs(ex.V.max.V))),`${fmt(Math.abs(def.v),3)} @ ${fmt(def.x)} m`];}));
 $('fr_column_results').innerHTML=o.columns.length?table(['위치','축력 N (kN)','전단력 V (kN)','보 접합부 M (kN·m)','바깥쪽 끝 M (kN·m)'],o.columns.map(e=>[`절점 ${e.index+1} · ${e.kind==='upper'?'상부':'하부'}`,fmt(-e.r[0]/1000),fmt(e.r[1]/1000),fmt(-e.r[2]/1e6),fmt(e.r[5]/1e6)]))+'<p class="beam-muted">기둥 축력은 인장 + / 압축 −. 기둥의 국부축은 보 절점에서 바깥쪽 끝 방향이며 V·M은 해당 국부축 기준입니다.</p>':'<p class="beam-muted">기둥 없는 연속보 모델입니다.</p>';
 $('fr_reactions').innerHTML=table(['절점','수평 Rx (kN)','수직 Ry (kN)','반력모멘트 (kN·m)','수직변위 (mm)','회전 (mrad)'],o.supports.map(r=>[r.label,fmt(r.Rx),fmt(r.Ry),fmt(r.RM),fmt(r.uy,3),fmt(r.theta*1000,3)]))+'<p class="beam-muted">반력은 오른쪽·위쪽·반시계 방향이 +입니다. 보 절점의 Rx는 횡이동 구속에 필요한 반력을 포함합니다. 단순지지는 회전을 구속하지 않습니다.</p>';
 const p=o.p;let basis=`<p>전체 평형 오차: ΣFx ${fmt(o.equilibrium.sumX,6)} kN · ΣFy ${fmt(o.equilibrium.sumY,6)} kN · ΣM ${fmt(o.equilibrium.sumM,6)} kN·m.</p><p>입력 수직하중 합계 ${fmt(-o.equilibrium.loadY)} kN (아래 방향 +). fck ${fmt(p.fck)} MPa → Ec ${fmt(o.E)} MPa. 보통중량 콘크리트 Ec=8,500∛(fck+Δf), Δf=4–6 MPa (KDS 14 20 10, 4.3.3).</p><p>절점 자유도: 수평·수직·회전. 부재별 EA/L 및 EI 강성을 전체 행렬에 조립하고 경계조건을 적용합니다. 단부 힌지는 강성과 하중을 함께 정적 축약합니다. 분포하중은 구간별 선형 형태로 일관절점하중을 적분하며 집중하중·모멘트를 중첩합니다. 부재력 적분으로 내부 변위를 복원하여 단순한 절점변위 연결과 구분합니다.</p><ul>`;
 p.spans.forEach((b,i)=>{basis+=`<li><b>${i+1}경간</b> L ${fmt(b.L)} m · ${fmt(b.b,0)} × ${fmt(b.h,0)} mm · 왼쪽 ${b.hingeI?'힌지':'강접'} / 오른쪽 ${b.hingeJ?'힌지':'강접'}<ul>`;b.loads.forEach((q,j)=>{basis+=`<li>${j+1}: ${types[q.type]} ${fmt(q.value)} ${q.type==='point'?'kN':q.type==='moment'?'kN·m':'kN/m'} · 위치 ${fmt(q.a)}${['uniform','trapezoid'].includes(q.type)?'–'+fmt(q.b):''} m${q.type==='trapezoid'?` · 증가 ${fmt(q.rise)} / 감소 ${fmt(q.fall)} m`:''}</li>`;});basis+='</ul></li>';});basis+='</ul><ul>';
 p.supports.forEach((s,i)=>{basis+=`<li>절점 ${i+1}: ${names[s.type]}`;for(const d of ['upper','lower'])if(s.type===d||s.type==='both')basis+=` · ${d==='upper'?'상부':'하부'} ${fmt(s[d].L)} m, ${fmt(s[d].b,0)} × ${fmt(s[d].h,0)} mm, 끝 ${s[d].end==='fixed'?'고정':'힌지'}`;basis+='</li>';});basis+='</ul>';$('fr_basis').innerHTML=basis;plot();
}
function run(){
 frameDrawing();loadDrawing();try{result=F.calculate(model());$('fr_error').hidden=true;$('fr_results').hidden=false;results(result);}
 catch(e){result=null;$('fr_error').hidden=false;$('fr_error').textContent=e.message;$('fr_results').hidden=true;$('fr_summary').innerHTML='<p class="warn">해석 결과 없음 · 입력 또는 지지조건을 확인하세요.</p>';for(const id of ['plot','probe_result','beam_results','column_results','reactions','basis'])$('fr_'+id).innerHTML='';}
}
function on(id,event,fn){$('fr_'+id).addEventListener(event,fn);}
on('count','change',()=>{count=val('count');if(!Number.isInteger(count)||count<1||count>10){count=3;set('count',3);}beam=Math.min(beam,count-1);node=Math.min(node,count);selectors();beamFields();nodeFields();run();});
on('fck','input',run);
on('beam','change',()=>{beam=val('beam');load=0;beamFields();run();});on('node','change',()=>{node=val('node');nodeFields();run();});
for(const k of ['L','b','h'])on(k,'input',()=>{spans[beam][k]=val(k);if(k==='L'){const q=spans[beam].loads[load];if(q&&q.full)set('loadB',spans[beam].L);}run();});
for(const k of ['hingeI','hingeJ'])on(k,'change',()=>{spans[beam][k]=$('fr_'+k).value==='hinge';run();});
on('support','change',()=>{supports[node].type=$('fr_support').value;nodeFields();run();});
for(const dir of ['upper','lower']){for(const [suffix,key] of [['L','L'],['B','b'],['H','h']])on(dir+suffix,'input',()=>{supports[node][dir][key]=val(dir+suffix);run();});on(dir+'End','change',()=>{supports[node][dir].end=$('fr_'+dir+'End').value;run();});}
on('copy_section','click',()=>{const b=spans[beam];for(let i=0;i<count;i++){spans[i].b=b.b;spans[i].h=b.h;}run();});
on('copy_support','click',()=>{const s=clone(supports[node]);for(let i=0;i<=count;i++)supports[i]=clone(s);run();});
on('load','change',()=>{load=val('load');loadFields();run();});
on('add_load','click',()=>{const b=spans[beam];if(b.loads.length>=30){$('fr_load_note').textContent='경간별 하중은 최대 30개입니다.';return;}b.loads.push({type:'uniform',value:0,a:0,b:b.L,rise:b.L/4,fall:b.L/4,full:true});load=b.loads.length-1;loadFields();run();});
on('remove_load','click',()=>{spans[beam].loads.splice(load,1);load=Math.max(0,load-1);loadFields();run();});
on('loadType','change',()=>{const q=spans[beam].loads[load];q.type=$('fr_loadType').value;if(q.type==='point'||q.type==='moment'){q.a=spans[beam].L/2;q.full=false;}loadFields();run();});
on('extent','change',()=>{const q=spans[beam].loads[load];q.full=$('fr_extent').value==='full';if(q.full){q.a=0;q.b=spans[beam].L;}loadFields();run();});
for(const [id,key] of [['loadValue','value'],['loadA','a'],['loadB','b'],['rise','rise'],['fall','fall']])on(id,'input',()=>{const q=spans[beam].loads[load];if(q)q[key]=val(id);run();});
for(const k of ['M','V','v','N'])on('view_'+k,'click',()=>{view=k;plot();});on('probe','input',plot);
function selectDrawing(event){const target=event.target.closest?.('[data-beam],[data-node]');if(!target)return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;event.preventDefault?.();const bi=target.getAttribute('data-beam'),ni=target.getAttribute('data-node');if(bi!==null){beam=Number(bi);load=0;set('beam',beam);beamFields();}if(ni!==null){node=Number(ni);set('node',node);nodeFields();}run();}
$('fr_model').addEventListener('click',selectDrawing);$('fr_model').addEventListener('keydown',selectDrawing);
root.runRCFrame=run;selectors();beamFields();nodeFields();run();
})(typeof globalThis!=='undefined'?globalThis:this);
