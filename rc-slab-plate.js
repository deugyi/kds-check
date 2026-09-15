/* Four-edge-supported uniform Kirchhoff plate. Unit load, metres.
 * Finite differences: biharmonic 13-point stencil; reflected ghost nodes
 * enforce w=0 and either Mn=0 (simple) or normal slope=0 (fixed).
 * See docs/rc-slab-auto-design.md for scope, convergence and verification. */
(function(root){'use strict';
const EDGES=['left','right','bottom','top'], NU=.2, cache=new Map();
function solve(lx,ly,edges,n=32){
 if(!Number.isFinite(lx)||!Number.isFinite(ly)||Math.min(lx,ly)<=0||Math.max(lx,ly)>50||Math.max(lx,ly)/Math.min(lx,ly)>2)throw Error('2방향 슬래브는 경간 0–50 m, 장단변비 2 이하를 사용하세요.');
 if(!Number.isInteger(n)||n<8||n>64||EDGES.some(k=>!['simple','fixed'].includes(edges[k])))throw Error('네 변의 지지조건을 선택하세요.');
 const key=JSON.stringify([lx,ly,edges,n]);if(cache.has(key))return cache.get(key);
 const dx=lx/n,dy=ly/n,m=n-1,N=m*m,ax=1/dx**4,ay=1/dy**4,axy=1/(dx*dy)**2;
 const stencil=[[0,0,6*ax+8*axy+6*ay],[1,0,-4*ax-4*axy],[-1,0,-4*ax-4*axy],[0,1,-4*ay-4*axy],[0,-1,-4*ay-4*axy],[2,0,ax],[-2,0,ax],[0,2,ay],[0,-2,ay],[1,1,2*axy],[1,-1,2*axy],[-1,1,2*axy],[-1,-1,2*axy]];
 const index=(i,j)=>(i-1)*m+j-1;
 function reflected(i,j){
  let sign=1;
  if(i<0){i=-i;sign*=edges.left==='fixed'?1:-1;}if(i>n){i=2*n-i;sign*=edges.right==='fixed'?1:-1;}
  if(j<0){j=-j;sign*=edges.bottom==='fixed'?1:-1;}if(j>n){j=2*n-j;sign*=edges.top==='fixed'?1:-1;}
  return i===0||j===0||i===n||j===n?null:[index(i,j),sign];
 }
 const rows=[],diag=new Float64Array(N);
 for(let i=1;i<n;i++)for(let j=1;j<n;j++){
  const row=new Map(),k=index(i,j);
  for(const [di,dj,c] of stencil){const r=reflected(i+di,j+dj);if(r)row.set(r[0],(row.get(r[0])||0)+c*r[1]);}
  rows.push([...row]);diag[k]=row.get(k);
 }
 const mul=(x,out)=>{for(let i=0;i<N;i++){let s=0;for(const [j,a] of rows[i])s+=a*x[j];out[i]=s;}};
 const dot=(a,b)=>{let s=0;for(let i=0;i<N;i++)s+=a[i]*b[i];return s;};
 const u=new Float64Array(N),r=new Float64Array(N).fill(1),z=new Float64Array(N),p=new Float64Array(N),ap=new Float64Array(N);
 for(let i=0;i<N;i++)p[i]=z[i]=r[i]/diag[i];
 let rz=dot(r,z),residual=1,iterations=0;
 for(;iterations<6000&&residual>1e-9;iterations++){
  mul(p,ap);const pap=dot(p,ap);if(!(pap>0))throw Error('슬래브 해석 행렬의 수렴을 확인할 수 없습니다.');const alpha=rz/pap;
  for(let i=0;i<N;i++){u[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/diag[i];}
  residual=Math.sqrt(dot(r,r)/N);const next=dot(r,z),beta=next/rz;for(let i=0;i<N;i++)p[i]=z[i]+beta*p[i];rz=next;
 }
 if(residual>1e-9)throw Error('슬래브 해석이 수렴하지 않았습니다. 입력 조건을 확인하세요.');
 const at=(i,j)=>{const r=reflected(i,j);return r?u[r[0]]*r[1]:0;};
 const lap=(i,j)=>(at(i+1,j)-2*at(i,j)+at(i-1,j))/dx**2+(at(i,j+1)-2*at(i,j)+at(i,j-1))/dy**2;
 const points=[],envelope={bX:0,bY:0,tX:0,tY:0},locations={},shear={X:0,Y:0};let maxU=0;
 for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){
  const xx=(at(i+1,j)-2*at(i,j)+at(i-1,j))/dx**2,yy=(at(i,j+1)-2*at(i,j)+at(i,j-1))/dy**2;
  const xy=(at(i+1,j+1)-at(i-1,j+1)-at(i+1,j-1)+at(i-1,j-1))/(4*dx*dy);
  const Mx=-(xx+NU*yy),My=-(yy+NU*xx),Mxy=-(1-NU)*xy,t=Math.abs(Mxy),v={x:i*dx,y:j*dy,Mx,My,Mxy,u:at(i,j)};
  points.push(v);maxU=Math.max(maxU,v.u);
  const qx=i===0?(-3*lap(i,j)+4*lap(i+1,j)-lap(i+2,j))/(2*dx):i===n?(3*lap(i,j)-4*lap(i-1,j)+lap(i-2,j))/(2*dx):(lap(i+1,j)-lap(i-1,j))/(2*dx);
  const qy=j===0?(-3*lap(i,j)+4*lap(i,j+1)-lap(i,j+2))/(2*dy):j===n?(3*lap(i,j)-4*lap(i,j-1)+lap(i,j-2))/(2*dy):(lap(i,j+1)-lap(i,j-1))/(2*dy);
  shear.X=Math.max(shear.X,Math.abs(qx));shear.Y=Math.max(shear.Y,Math.abs(qy));
  for(const [k,a] of Object.entries({bX:Mx+t,bY:My+t,tX:-Mx+t,tY:-My+t}))if(a>envelope[k]){envelope[k]=a;locations[k]={x:v.x,y:v.y};}
 }
 const result={lx,ly,edges:{...edges},n,nu:NU,points,envelope,locations,shear,maxU,residual,iterations};
 if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
function analyse(lx,ly,edges){
 let coarse=solve(lx,ly,edges,24),fine=solve(lx,ly,edges,32);
 const error=(a,b)=>Math.max(...Object.keys(a.envelope).map(k=>Math.abs(a.envelope[k]-b.envelope[k])/Math.max(b.envelope[k],.001*Math.min(lx,ly)**2)));
 let relative=error(coarse,fine);if(relative>.03){coarse=fine;fine=solve(lx,ly,edges,48);relative=error(coarse,fine);}
 if(relative>.05)throw Error('해석망을 세분화해도 모멘트 차이가 5%를 넘습니다. 별도 판 해석이 필요합니다.');
 // Envelope both meshes rather than silently taking a smaller refined moment.
 const envelope={};for(const k of Object.keys(fine.envelope))envelope[k]=Math.max(coarse.envelope[k],fine.envelope[k]);
 return {...fine,envelope,shear:{X:Math.max(coarse.shear.X,fine.shear.X),Y:Math.max(coarse.shear.Y,fine.shear.Y)},convergence:relative,coarseN:coarse.n};
}
root.RCSlabPlate={solve,analyse,EDGES};if(typeof module!=='undefined'&&module.exports)module.exports=root.RCSlabPlate;
})(typeof globalThis!=='undefined'?globalThis:this);
