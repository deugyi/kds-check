/* Slab boundary overrides, validation and snapping. Coordinates are drawing millimetres. */
(function(root){
'use strict';
const A=root.SiteSlabArea||(typeof require==='function'?require('./site-slab-area.js'):null);
const clone=v=>JSON.parse(JSON.stringify(v));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function on(p,a,b){return Math.abs(cross(a,b,p))<1e-6&&p[0]>=Math.min(a[0],b[0])-1e-6&&p[0]<=Math.max(a[0],b[0])+1e-6&&p[1]>=Math.min(a[1],b[1])-1e-6&&p[1]<=Math.max(a[1],b[1])+1e-6;}
function intersect(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<0&&z*w<0||on(c,a,b)||on(d,a,b)||on(a,c,d)||on(b,c,d);}
function contains(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if(on(p,a,b))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function validate(value){
 const points=value?.points,holes=value?.holes||[];if(!Array.isArray(points)||!Array.isArray(holes)||holes.length>20)throw Error('경계점을 3개 이상 지정해 주세요.');
 const rings=[points,...holes];if(rings.reduce((n,r)=>n+(r?.length||0),0)>600)throw Error('경계점은 전체 600개 이하로 지정해 주세요.');
 for(const ring of rings){if(!Array.isArray(ring)||ring.length<3||ring.length>200)throw Error('각 경계는 3~200개의 점으로 지정해 주세요.');for(const p of ring)if(!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e9))throw Error('경계점 좌표를 확인해 주세요.');
  for(let i=0;i<ring.length;i++){if(Math.hypot(ring[i][0]-ring[(i+1)%ring.length][0],ring[i][1]-ring[(i+1)%ring.length][1])<.001)throw Error('겹치는 경계점이 있습니다.');for(let j=i+1;j<ring.length;j++)if(j!==i+1&&!(i===0&&j===ring.length-1)&&intersect(ring[i],ring[(i+1)%ring.length],ring[j],ring[(j+1)%ring.length]))throw Error('경계가 교차합니다. 점의 순서를 확인해 주세요.');}
  if(A.area([[ring]])<.001)throw Error('영역 면적이 너무 작습니다.');
 }
 for(let i=1;i<rings.length;i++){if(!contains(rings[i][0],points))throw Error('내부 구멍은 외곽 경계 안에 있어야 합니다.');for(let j=0;j<i;j++){if(j>0&&(contains(rings[i][0],rings[j])||contains(rings[j][0],rings[i])))throw Error('내부 구멍이 겹칩니다.');for(let k=0;k<rings[i].length;k++)for(let l=0;l<rings[j].length;l++)if(intersect(rings[i][k],rings[i][(k+1)%rings[i].length],rings[j][l],rings[j][(l+1)%rings[j].length]))throw Error('외곽과 내부 구멍의 경계가 겹칩니다.');}}
 if(A.area([[points,...holes]])<.001)throw Error('영역 면적이 너무 작습니다.');return {points:clone(points),holes:clone(holes)};
}
function projection(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return [a[0]+t*dx,a[1]+t*dy];}
function crossing(a,b,c,d){const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)return null;const u=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,v=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;return u>=0&&u<=1&&v>=0&&v<=1?[a[0]+u*dx,a[1]+u*dy]:null;}
function snap(p,drawing,visibility={},tolerance=100){
 const near=drawing.memberIndex.query(p,tolerance).filter(m=>!visibility[m.key]?.hidden),nodes=[],lines=[];
 for(const m of near){nodes.push({point:m.a,label:'보 끝점'},{point:m.b,label:'보 끝점'});lines.push({point:projection(p,m.a,m.b),label:'보선'});}
 for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){const point=crossing(near[i].a,near[i].b,near[j].a,near[j].b);if(point)nodes.push({point,label:'보 교점'});}
 for(const z of drawing.zones)for(let i=0;i<z.points.length;i++){nodes.push({point:z.points[i],label:'존 꼭짓점'});lines.push({point:projection(p,z.points[i],z.points[(i+1)%z.points.length]),label:'존 경계'});}
 const closest=list=>list.map(v=>({...v,distance:Math.hypot(p[0]-v.point[0],p[1]-v.point[1])})).filter(v=>v.distance<=tolerance).sort((a,b)=>a.distance-b.distance)[0];return closest(nodes)||closest(lines)||{point:[...p],label:'자유점'};
}
function apply(base,regions=[]){const map=new Map((base.slabs||[]).map((v,i)=>[v.key,{...v,holes:v.holes||[],display:v.display||(v.review?'검토 영역 ':'슬래브 ')+String(i+1).padStart(4,'0')}]));for(const row of regions){if(row.hidden){map.delete(row.item_key);continue;}const g=validate(row.geometry),old=map.get(row.item_key),center=g.points.reduce((p,v)=>[p[0]+v[0]/g.points.length,p[1]+v[1]/g.points.length],[0,0]),zone=base.zones.find(z=>contains(center,z.points))?.id||'unassigned';map.set(row.item_key,{...old,display:old?.display||'사용자 영역 '+String(regions.filter(r=>r.item_key.startsWith('USER-SLAB-')).findIndex(r=>r.item_key===row.item_key)+1).padStart(3,'0'),key:row.item_key,...g,zone,area:A.area([[g.points,...g.holes]]),review:false,manual:true});}return {...base,slabs:[...map.values()],slabsReady:base.slabsReady!==false||regions.some(r=>!r.hidden)};}
root.SiteSlabEditor={validate,snap,projection,crossing,apply,contains};if(typeof module!=='undefined')module.exports=root.SiteSlabEditor;
})(globalThis);
