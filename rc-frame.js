/* Linear, non-sway 2D RC frame. N, mm, MPa internally; see docs/rc-frame.md. */
(function(root){'use strict';
const zeros=n=>Array(n).fill(0),matrix=n=>Array.from({length:n},()=>zeros(n));
function modulus(fc){if(!Number.isFinite(fc)||fc<21||fc>90)throw Error('콘크리트 강도는 21–90 MPa 범위입니다.');return 8500*Math.cbrt(fc+(fc<=40?4:fc>=60?6:4+(fc-40)/10));}
function positive(v,n,max=1e8){if(!Number.isFinite(v)||v<=0||v>max)throw Error(n+'은 0보다 크고 '+max+' 이하이어야 합니다.');}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),mv=(a,b)=>a.map(r=>dot(r,b));
function solve(A,b){
 const n=b.length;if(!n)return [];
 const scale=A.map((r,i)=>Math.sqrt(r[i]));if(scale.some(v=>!Number.isFinite(v)||v<=0))throw Error('구조가 불안정합니다. 지지조건·보 단부 힌지를 확인하세요.');
 const L=matrix(n);
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let v=A[i][j]/(scale[i]*scale[j]);for(let k=0;k<j;k++)v-=L[i][k]*L[j][k];if(i===j){if(v<1e-11)throw Error('구조가 불안정하거나 강성 차이가 지나치게 큽니다. 지지조건·힌지·단면을 확인하세요.');L[i][j]=Math.sqrt(v);}else L[i][j]=v/L[j][j];}
 const y=zeros(n),x=zeros(n);for(let i=0;i<n;i++){let v=b[i]/scale[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y[i]=v/L[i][i];}
 for(let i=n-1;i>=0;i--){let v=y[i];for(let j=i+1;j<n;j++)v-=L[j][i]*x[j];x[i]=v/L[i][i];}return x.map((v,i)=>v/scale[i]);
}
function stiffness(E,A,I,L){
 const a=E*A/L,b=12*E*I/L**3,c=6*E*I/L**2,d=4*E*I/L,e=2*E*I/L;
 return [[a,0,0,-a,0,0],[0,b,c,0,-b,c],[0,c,d,0,-c,e],[-a,0,0,a,0,0],[0,-b,-c,0,b,-c],[0,c,e,0,-c,d]];
}
function shape(x,L){const r=x/L;return [1-3*r*r+2*r**3,L*(r-2*r*r+r**3),3*r*r-2*r**3,L*(-r*r+r**3)];}
function derivative(x,L){const r=x/L;return [(-6*r+6*r*r)/L,1-4*r+3*r*r,(6*r-6*r*r)/L,-2*r+3*r*r];}
const GAUSS=[[-.8611363115940526,.3478548451374538],[-.3399810435848563,.6521451548625461],[.3399810435848563,.6521451548625461],[.8611363115940526,.3478548451374538]];
function integrate(a,b,fn){if(b<=a)return 0;return GAUSS.reduce((s,[x,w])=>s+w*fn((a+b)/2+x*(b-a)/2),0)*(b-a)/2;}
function loadsFor(loads,L){
 const segments=[],points=[];
 if(!Array.isArray(loads)||loads.length>30)throw Error('경간별 하중은 최대 30개입니다.');
 for(const q of loads){
  if(!['uniform','trapezoid','point','moment'].includes(q.type))throw Error('하중 종류를 확인하세요.');
  if(!Number.isFinite(q.value)||Math.abs(q.value)>1e7)throw Error('하중 크기는 유한한 숫자로 입력하세요.');
  const a=q.a*1000;if(!Number.isFinite(a)||a<0||a>L+1e-7)throw Error('하중 시작 위치는 해당 경간 안에 있어야 합니다.');
  if(q.type==='point'||q.type==='moment'){points.push({x:a,P:q.type==='point'?-q.value*1000:0,M:q.type==='moment'?q.value*1e6:0});continue;}
  const b=q.b*1000;if(!Number.isFinite(b)||b<=a||b>L+1e-7)throw Error('분포하중 끝 위치는 시작점보다 크고 경간 길이 이하여야 합니다.');
  if(q.type==='uniform'){segments.push({a,b,q0:-q.value,q1:-q.value});continue;}
  const l=q.rise*1000,r=q.fall*1000;if(!Number.isFinite(l)||!Number.isFinite(r)||l<0||r<0||l+r>b-a+1e-7)throw Error('증가·감소 길이의 합은 하중 작용 길이 이하여야 합니다.');
  if(l>0)segments.push({a,b:a+l,q0:0,q1:-q.value});
  if(b-r>a+l+1e-7)segments.push({a:a+l,b:b-r,q0:-q.value,q1:-q.value});
  if(r>0)segments.push({a:b-r,b,q0:-q.value,q1:0});
 }
 const f=zeros(6),idx=[1,2,4,5];
 for(const s of segments)for(let j=0;j<4;j++)f[idx[j]]+=integrate(s.a,s.b,x=>(s.q0+(s.q1-s.q0)*(x-s.a)/(s.b-s.a))*shape(x,L)[j]);
 for(const p of points){const n=shape(p.x,L),d=derivative(p.x,L);for(let j=0;j<4;j++)f[idx[j]]+=n[j]*p.P+d[j]*p.M;}
 return {segments,points,f};
}
function condense(k,f,released){
 const active=[0,1,2,3,4,5].filter(i=>!released.includes(i));
 if(!released.length)return {kc:k.map(r=>r.slice()),fc:f.slice(),active,released};
 const rr=released.map(i=>released.map(j=>k[i][j])),rf=solve(rr,released.map(i=>f[i])),col=active.map(j=>solve(rr,released.map(i=>k[i][j])));
 const kc=matrix(6),fc=zeros(6);
 for(let ai=0;ai<active.length;ai++){const i=active[ai];fc[i]=f[i]-released.reduce((s,r,z)=>s+k[i][r]*rf[z],0);for(let aj=0;aj<active.length;aj++){const j=active[aj];kc[i][j]=k[i][j]-released.reduce((s,r,z)=>s+k[i][r]*col[aj][z],0);}}
 return {kc,fc,active,released,rr};
}
function element(nodes,i,j,b,h,E,loads=[],releases=[]){
 positive(b,'부재 폭',3000);positive(h,'부재 높이',5000);
 const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y,L=Math.hypot(dx,dy),c=dx/L,s=dy/L,A=b*h,I=b*h**3/12;
 positive(L,'부재 길이',100000);
 const T=[[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]];
 const k=stiffness(E,A,I,L),load=loadsFor(loads,L),con=condense(k,load.f,releases);
 const kg=matrix(6),fg=zeros(6);for(let a=0;a<6;a++){for(let u=0;u<6;u++){fg[a]+=T[u][a]*con.fc[u];for(let z=0;z<6;z++)for(let v=0;v<6;v++)kg[a][z]+=T[u][a]*con.kc[u][v]*T[v][z];}}
 return {i,j,b,h,E,A,I,L,c,s,T,k,load,con,kg,fg,dofs:[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2]};
}
function at(e,x,side='right'){
 x=Math.max(0,Math.min(e.L,x));const r=e.r,u=e.u,EI=e.E*e.I;
 let V=r[1],M=-r[2]+r[1]*x,theta=u[2]+(-r[2]*x+r[1]*x*x/2)/EI,v=u[1]+u[2]*x+(-r[2]*x*x/2+r[1]*x**3/6)/EI;
 for(const s of e.load.segments){const b=Math.min(s.b,x);if(b<=s.a)continue;const q=z=>s.q0+(s.q1-s.q0)*(z-s.a)/(s.b-s.a);
 V+=integrate(s.a,b,q);M+=integrate(s.a,b,z=>q(z)*(x-z));theta+=integrate(s.a,b,z=>q(z)*(x-z)**2/2)/EI;v+=integrate(s.a,b,z=>q(z)*(x-z)**3/6)/EI;}
 for(const p of e.load.points)if(p.x<x-1e-7||(side==='right'&&Math.abs(p.x-x)<=1e-7)){const d=x-p.x;V+=p.P;M+=p.P*d-p.M;theta+=(p.P*d*d/2-p.M*d)/EI;v+=(p.P*d**3/6-p.M*d*d/2)/EI;}
 return {x:x/1000,V:V/1000,M:M/1e6,N:-r[0]/1000,v,theta};
}
const poly=(a,x)=>a.reduceRight((v,c)=>v*x+c,0);
function rootsUnit(a){
 let max=Math.max(...a.map(Math.abs),1);a=a.map(v=>v/max);while(a.length>1&&Math.abs(a[a.length-1])<1e-13)a.pop();if(a.length===1)return [];
 const bounds=[0,...rootsUnit(a.slice(1).map((v,i)=>v*(i+1))),1],out=[];
 const add=x=>{if(!out.some(y=>Math.abs(x-y)<1e-8))out.push(x);};
 for(const x of bounds)if(Math.abs(poly(a,x))<1e-10)add(x);
 for(let i=1;i<bounds.length;i++){let l=bounds[i-1],h=bounds[i],fl=poly(a,l),fh=poly(a,h);if(fl*fh>=0)continue;for(let j=0;j<60;j++){const m=(l+h)/2,fm=poly(a,m);if(fl*fm<=0){h=m;fh=fm;}else{l=m;fl=fm;}}add((l+h)/2);}
 return out.sort((a,b)=>a-b);
}
function sample(e){
 const bounds=[0,e.L,...e.load.points.map(p=>p.x),...e.load.segments.flatMap(s=>[s.a,s.b])].sort((a,b)=>a-b).filter((x,i,a)=>i===0||x-a[i-1]>1e-7),locations=[];
 for(const x of bounds){if(x>0)locations.push([x,'left']);if(x<e.L)locations.push([x,'right']);}
 for(let i=1;i<bounds.length;i++){
  const a=bounds[i-1],l=bounds[i]-a,o=at(e,a,'right'),mid=a+l/2;
  let q0=0,slope=0;for(const s of e.load.segments)if(mid>s.a&&mid<s.b){q0+=s.q0+(s.q1-s.q0)*(a-s.a)/(s.b-s.a);slope+=(s.q1-s.q0)/(s.b-s.a);}
  const EI=e.E*e.I,V=o.V*1000,M=o.M*1e6;
  const critical=[...rootsUnit([V,q0*l,slope*l*l/2]),...rootsUnit([o.theta,M*l/EI,V*l*l/(2*EI),q0*l**3/(6*EI),slope*l**4/(24*EI)])];
  if(slope!==0&&-q0/slope>0&&-q0/slope<l)critical.push(-q0/slope/l);
  for(let j=1;j<16;j++)critical.push(j/16);
  for(const x of critical)if(x>1e-10&&x<1-1e-10)locations.push([a+x*l,'right']);
 }
 const points=locations.sort((a,b)=>a[0]-b[0]||(a[1]==='left'?-1:1)).map(([x,side])=>({...at(e,x,side),side}));
 const extrema={};for(const k of ['M','V','v','N']){extrema[k]={min:points.reduce((a,b)=>b[k]<a[k]?b:a),max:points.reduce((a,b)=>b[k]>a[k]?b:a)};}
 return {points,extrema};
}
function calculate(p){
 if(!p||!Array.isArray(p.spans)||p.spans.length<1||p.spans.length>10||!Array.isArray(p.supports)||p.supports.length!==p.spans.length+1)throw Error('1–10경간과 경간 수 + 1개의 절점 조건이 필요합니다.');
 const E=modulus(p.fck),nodes=[],elements=[];let x=0;
 p.spans.forEach((b,i)=>{positive(b.L,'경간 길이(m)',100);nodes.push({x,y:0,label:`절점 ${i+1}`,fix:[true,false,false]});x+=b.L*1000;});nodes.push({x,y:0,label:`절점 ${p.spans.length+1}`,fix:[true,false,false]});
 p.spans.forEach((b,i)=>{const e=element(nodes,i,i+1,b.b,b.h,E,b.loads||[],[...(b.hingeI?[2]:[]),...(b.hingeJ?[5]:[])]);e.kind='beam';e.index=i;elements.push(e);});
 p.supports.forEach((s,i)=>{
  if(!['both','upper','lower','pin','fixed','free'].includes(s.type))throw Error('절점 지지형식을 선택하세요.');
  if(s.type==='pin'||s.type==='fixed')nodes[i].fix[1]=true;if(s.type==='fixed')nodes[i].fix[2]=true;
  for(const dir of ['upper','lower'])if(s.type==='both'||s.type===dir){const col=s[dir];if(!col||!['fixed','hinged'].includes(col.end))throw Error('기둥 단면·길이·끝 조건을 입력하세요.');positive(col.L,'기둥 길이(m)',100);const j=nodes.length;nodes.push({x:nodes[i].x,y:(dir==='upper'?1:-1)*col.L*1000,label:`절점 ${i+1} ${dir==='upper'?'상부':'하부'} 끝`,fix:[true,true,col.end==='fixed']});const e=element(nodes,i,j,col.b,col.h,E);e.kind=dir;e.index=i;elements.push(e);}
 });
 const n=nodes.length*3,K=matrix(n),F=zeros(n);
 for(const e of elements)for(let a=0;a<6;a++){F[e.dofs[a]]+=e.fg[a];for(let b=0;b<6;b++)K[e.dofs[a]][e.dofs[b]]+=e.kg[a][b];}
 const free=[];for(let i=0;i<n;i++)if(!nodes[Math.floor(i/3)].fix[i%3]){if(K[i][i]===0){if(Math.abs(F[i])>1e-6)throw Error('힌지로 분리된 자유도에 하중이 작용합니다.');}else free.push(i);}
 const u=zeros(n),uf=solve(free.map(i=>free.map(j=>K[i][j])),free.map(i=>F[i]));free.forEach((i,z)=>u[i]=uf[z]);
 const reaction=mv(K,u).map((v,i)=>v-F[i]);
 const residual=Math.max(0,...free.map(i=>Math.abs(reaction[i])/(i%3===2?1000:1)));
 if(residual>Math.max(1,...F.map(Math.abs))*1e-7)throw Error('해석 평형 오차가 큽니다. 지지조건과 단면 강성을 확인하세요.');
 for(const e of elements){const ul=mv(e.T,e.dofs.map(i=>u[i]));if(e.con.released.length){const r=e.con.released,a=e.con.active,ur=solve(e.con.rr,r.map(i=>e.load.f[i]-a.reduce((s,j)=>s+e.k[i][j]*ul[j],0)));r.forEach((i,z)=>ul[i]=ur[z]);}
 e.u=ul;e.r=mv(e.k,ul).map((v,i)=>v-e.load.f[i]);if(e.kind==='beam'){Object.assign(e,sample(e));const end=at(e,e.L,'right');if(Math.abs(end.v-ul[4])>Math.max(1,Math.abs(ul[4]))*1e-6||Math.abs(end.theta-ul[5])>1e-7)throw Error('부재 변위 복원 검증에 실패했습니다.');}}
 const supports=nodes.map((node,i)=>({...node,ux:u[3*i],uy:u[3*i+1],theta:u[3*i+2],Rx:reaction[3*i]/1000,Ry:reaction[3*i+1]/1000,RM:reaction[3*i+2]/1e6}));
 let loadY=0,loadMoment=0;for(const e of elements.filter(e=>e.kind==='beam')){for(const s of e.load.segments){loadY+=integrate(s.a,s.b,z=>s.q0+(s.q1-s.q0)*(z-s.a)/(s.b-s.a));loadMoment+=integrate(s.a,s.b,z=>(s.q0+(s.q1-s.q0)*(z-s.a)/(s.b-s.a))*(nodes[e.i].x+z));}for(const q of e.load.points){loadY+=q.P;loadMoment+=q.P*(nodes[e.i].x+q.x)+q.M;}}
 const sumX=supports.reduce((s,r)=>s+r.Rx,0),sumY=supports.reduce((s,r)=>s+r.Ry,0)+loadY/1000,sumM=supports.reduce((s,r)=>s+r.RM+r.x/1000*r.Ry-r.y/1000*r.Rx,0)+loadMoment/1e6;
 if(Math.abs(sumY)>Math.max(1,Math.abs(loadY/1000))*1e-6||Math.abs(sumM)>Math.max(1,Math.abs(loadMoment/1e6))*1e-6)throw Error('전체 하중·반력 평형 검증에 실패했습니다.');
 return {p,E,nodes,supports,elements,beams:elements.filter(e=>e.kind==='beam'),columns:elements.filter(e=>e.kind!=='beam'),u,equilibrium:{loadY:loadY/1000,loadMoment:loadMoment/1e6,sumX,sumY,sumM,residual},length:x/1000};
}
root.RCFrame={modulus,stiffness,shape,derivative,loadsFor,condense,solve,at,rootsUnit,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RCFrame;
})(typeof globalThis!=='undefined'?globalThis:this);
