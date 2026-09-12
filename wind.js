/* KDS 41 12 00:2022, rectangular enclosed buildings / flat-roof cladding.
 * SI: m, m/s, Hz, kPa, kN. See docs/wind.md for scope and source checks. */
(function(root){'use strict';
const TERRAIN={A:{zb:20,zg:550,alpha:.33,c:.22,base:.58},B:{zb:15,zg:450,alpha:.22,c:.45,base:.81},C:{zb:10,zg:350,alpha:.15,c:.71,base:1},D:{zb:5,zg:250,alpha:.10,c:.98,base:1.13}};
const INTERNAL=[
 ['sealed','모든 표면 밀폐',0,-.4],['walls','모든 벽면 틈새 · 지붕 밀폐',0,-.8],
 ['all','모든 표면 틈새 / 이웃한 세 벽면 틈새',0,-1.2],['one','한 벽면 틈새',1.4,-.8],
 ['opposite','마주보는 두 벽면 틈새',.4,-.8],['adjacent','이웃하는 두 벽면 틈새',.4,-.6],
 ['opening2','탁월개구부 · 나머지 개구부의 2배',1.1,-1.1],['opening3','탁월개구부 · 나머지 개구부의 3배 이상',1.4,-1.4]
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function lerpLog(A,a,b,lo,hi){return lo+(hi-lo)*Math.log(clamp(A,a,b)/a)/Math.log(b/a);}
function kr(z,t){return z<=t.zb?t.base:t.c*z**t.alpha;}
function kz(z,H,t){if(H<=t.zb)return 1;if(z>=.8*H)return .8**(2*t.alpha);return (Math.max(z,t.zb)/H)**(2*t.alpha);}
function importance(p){return p.H>=200||p.stories>=50||p.importance==='tall'?1.05:({special:1,I:1,II:.95,III:.9}[p.importance]);}
function common(p,cladding=false){
 const errors=[];for(const [k,n] of [['H','기준높이'],['B','건물 폭'],['D','건물 깊이'],['V0','기본풍속']])if(!Number.isFinite(p[k])||p[k]<=0)errors.push(n+'는 0보다 커야 합니다.');
 if(!TERRAIN[p.terrain])errors.push('지표면조도를 선택하세요.');
 if(!['special','I','II','III','tall'].includes(p.importance))errors.push('중요도를 선택하세요.');
 if(!Number.isInteger(p.stories)||p.stories<1||p.stories>200)errors.push('층수는 1~200 정수로 입력하세요.');
 if(!Number.isFinite(p.Kzt)||p.Kzt<1)errors.push('지형계수는 1 이상으로 입력하세요.');
 if(!cladding&&(!Number.isFinite(p.Kd)||p.Kd<.85||p.Kd>1))errors.push('풍향계수는 0.85~1로 입력하세요.');
 if(!['strength','asd'].includes(p.design))errors.push('설계법을 선택하세요.');
 if(errors.length)return {valid:false,errors};
 const effectiveTerrain=cladding&&p.H<20&&p.terrain!=='D'?'C':p.terrain,t=TERRAIN[effectiveTerrain];
 if(p.H>t.zg)return {valid:false,errors:['기준높이가 해당 조도의 기준경도풍높이 Zg를 초과합니다. 별도 평가가 필요합니다.']};
 const Iw=importance(p),Kd=cladding?1:p.Kd,Kr=kr(p.H,t),VH=p.V0*Kd*Kr*p.Kzt*Iw,qH=.5*1.225*VH*VH/1000,factor=p.design==='asd'?.65:1;
 if(!Number.isFinite(qH))return {valid:false,errors:['입력 범위를 확인하세요. 속도압을 계산할 수 없습니다.']};
 return {valid:true,t,effectiveTerrain,Iw,Kd,Kr,VH,qH,factor};
}
function gust(p,B,c,n,damping){
 const {t,VH}=c,H=p.H,IH=.1*(Math.max(H,t.zb)/t.zg)**(-t.alpha-.05),gamma=(3+3*t.alpha)/(2+t.alpha)*IH,LH=H>30?100*Math.sqrt(H/30):100,k=H>=B?.33:-.33;
 const BD=1-1/(1+5.1*(LH/Math.sqrt(H*B))**1.3*(B/H)**k)**(1/3);
 if(n>1)return {GD:1+4*gamma*Math.sqrt(BD),IH,gamma,LH,BD,RD:0,phi:1,g:4,mode:'강체'};
 const beta=p.beta,lambda=1-.4*Math.log(beta),massRatio=p.massMode==='uniform'?1/(2*beta+1):p.massRatio,phi=lambda/((2+beta)*massRatio);
 const SD=1/((1+4*n*B/VH)*(1+2.3*n*H/VH)),f=n*LH/VH,FD=4*f/(1+71*f*f)**(5/6),RD=Math.PI*SD*FD/(4*damping),nu=n*Math.sqrt(RD/(BD+RD)),g=Math.sqrt(2*Math.log(600*nu)+1.2);
 return {GD:1+g*gamma*Math.sqrt(BD+phi*phi*RD),IH,gamma,LH,BD,RD,phi,g,nu,SD,FD,massRatio,mode:'유연'};
}
function main(p){
 const c=common(p);if(!c.valid)return c;const errors=[];
 if(p.H/Math.sqrt(p.B*p.D)>8)errors.push('H/√(BD)가 8을 초과하여 표 5.7-1을 적용할 수 없습니다.');
 for(const a of ['x','y']){if(!Number.isFinite(p[a+'Frequency'])||p[a+'Frequency']<=0)errors.push(a.toUpperCase()+' 고유진동수는 0보다 커야 합니다.');if(p[a+'Frequency']<=1&&(!Number.isFinite(p[a+'Damping'])||p[a+'Damping']<=0||p[a+'Damping']>=1))errors.push(a.toUpperCase()+' 감쇠비는 0~1 사이여야 합니다.');}
 if(p.xFrequency<=1||p.yFrequency<=1){if(!Number.isFinite(p.beta)||p.beta<.5||p.beta>2)errors.push('모드형상지수 β는 0.5~2로 입력하세요.');if(!['uniform','direct'].includes(p.massMode))errors.push('질량 분포를 선택하세요.');if(p.massMode==='direct'&&(!Number.isFinite(p.massRatio)||p.massRatio<=0||p.massRatio>1))errors.push('일반화질량비 M*/M은 0~1 사이로 입력하세요.');}
 if(errors.length)return {valid:false,errors};
 const result={...c,p,axes:{}};
 for(const a of ['x','y']){
  const B=a==='x'?p.B:p.D,D=a==='x'?p.D:p.B,G=gust(p,B,c,p[a+'Frequency'],p[a+'Damping']),leeward=D/B<=1?-.5:-.35,offset=D/B<=1?0:.05;
  if(!Number.isFinite(G.GD)||G.GD<1)return {valid:false,errors:['가스트영향계수 산정 범위를 벗어났습니다. 고유진동수·감쇠비 및 동적 특성을 확인하세요.']};
  const pressure=z=>c.factor*c.qH*G.GD*(.8*kz(z,p.H,c.t)+offset-leeward);
  // Simpson integration split at coefficient boundaries; avoids centroid/OTM approximations.
  function integrate(lo,hi,moment){const cuts=[lo,hi,c.t.zb,.8*p.H].filter(z=>z>=lo&&z<=hi).sort((a,b)=>a-b);let total=0;for(let k=1;k<cuts.length;k++){const l=cuts[k-1],h=cuts[k],n=20,dz=(h-l)/n;if(!dz)continue;let v=0;for(let i=0;i<=n;i++){let z=l+i*dz;if(i===0)z+=1e-10;if(i===n)z-=1e-10;v+=(i===0||i===n?1:i%2?4:2)*pressure(z)*B*(moment?z:1);}total+=v*dz/3;}return total;}
  const rows=[];let V=0,M=0;for(let i=p.stories;i>=1;i--){const lo=p.H*(i-1)/p.stories,hi=p.H*i/p.stories,F=integrate(lo,hi,false),moment=integrate(lo,hi,true);V+=F;M+=moment;rows.push({floor:i,lo,hi,z:(lo+hi)/2,p:pressure((lo+hi)/2),F,shear:V,overturning:M-V*lo});}
  if(!Number.isFinite(V)||!Number.isFinite(M))return {valid:false,errors:['입력 범위를 확인하세요. 하중을 계산할 수 없습니다.']};
  result.axes[a]={B,D,...G,leeward,offset,rows,V,M,pressure};
 }
 return result;
}
function peak(p,zone){
 const A=p.area,high=p.H>=20;
 if(zone==='wall'||zone==='corner')return {pos:high?lerpLog(A,2,50,1.8,1.2):lerpLog(A,1,50,2,1.4),neg:high?lerpLog(A,2,50,zone==='wall'?-1.8:-3.6,zone==='wall'?-1.4:-2):lerpLog(A,1,50,zone==='wall'?-2.2:-2.8,-1.6)};
 const i={roof:0,edge:1,roofCorner:2}[zone];
 return {pos:null,neg:high?lerpLog(A,1,50,[-2.8,-4.6,-6.4][i],[-1.8,-3.2,-4.6][i]):lerpLog(A,1,10,[-2.1,-3.9,-6][i],[-1.8,-2.25,-2.25][i])};
}
function cladding(p){
 const c=common(p,true);if(!c.valid)return c;const errors=[];
 if(!Number.isFinite(p.area)||p.area<=0)errors.push('유효수압면적은 0보다 커야 합니다.');
 if(!Number.isFinite(p.z)||p.z<0||p.z>p.H)errors.push('검토 높이는 0~H 사이로 입력하세요.');
 const internal=INTERNAL.find(x=>x[0]===p.internal);if(!internal)errors.push('개구부 조건을 선택하세요.');
 if(errors.length)return {valid:false,errors};
 const minWidth=Math.min(p.B,p.D),a=p.H>=20?Math.max(1,.1*minWidth):Math.max(1,.04*minWidth,Math.min(.1*minWidth,.4*p.H));
 const rows=['wall','corner','roof','edge','roofCorner'].map(zone=>{
  const cp=peak(p,zone),wall=['wall','corner'].includes(zone),k=wall&&p.H>=20?kz(p.z,p.H,c.t):1;
  const rawPos=cp.pos===null?null:c.qH*(k*cp.pos-internal[3]),rawNeg=c.qH*(cp.neg-internal[2]),positive=rawPos===null?null:Math.max(.675,rawPos)*c.factor,negative=Math.min(-.675,rawNeg)*c.factor;
  // Flat roof graphs specify suction only; do not invent a positive external coefficient.
  return {zone,...cp,k,rawPos,rawNeg,positive,negative,Fpos:positive===null?null:positive*p.area,Fneg:negative*p.area,minPos:rawPos!==null&&rawPos<.675,minNeg:rawNeg>-.675};
 });
 if(rows.some(r=>(r.Fpos!==null&&!Number.isFinite(r.Fpos))||!Number.isFinite(r.Fneg)))return {valid:false,errors:['입력 범위를 확인하세요. 풍하중을 계산할 수 없습니다.']};
 return {...c,p,internal,a,rows};
}
const api={TERRAIN,INTERNAL,kr,kz,importance,common,gust,main,peak,cladding};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.Wind=api;
})(typeof globalThis!=='undefined'?globalThis:this);
