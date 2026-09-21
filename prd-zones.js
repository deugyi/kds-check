/* Polygon-based work-zone membership; dates remain keyed by DXF object handle. */
(function(root){
'use strict';
function contains(x,y,points,tolerance=.1){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[j],[bx,by]=points[i],dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  if(len){const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/len));if(Math.hypot(x-ax-t*dx,y-ay-t*dy)<=tolerance)return true;}
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
function center(points){
 let area=0,x=0,y=0;
 for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i],cross=a[0]*b[1]-b[0]*a[1];area+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
 if(Math.abs(area)>1e-6){const p=[x/(3*area),y/(3*area)];if(contains(...p,points))return p;}
 return points[0];
}
function build(drawing){
 const zones=drawing.paths.filter(p=>p.layer.toLowerCase().replace(/^-/,'')==='zoning'&&p.closed&&p.points.length>=3).map((p,i)=>({id:p.zoneName||'구역 '+(i+1),points:p.points,center:center(p.points),keys:[]})).sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}));
 const membership={},issues=[];
 for(const p of drawing.piles){
  const candidates=zones.filter(z=>contains(p.x,p.y,z.points));
  if(candidates.length===1){membership[p.key]=candidates[0].id;candidates[0].keys.push(p.key);}
  else{membership[p.key]='unassigned';issues.push({key:p.key,reason:candidates.length?'공구 경계 중복':'공구 경계 밖'});}
 }
 return {zones,membership,issues};
}
function summary(piles,records,status){
 const stages={planned:0,drilled:0,delivered:0,ready:0,installed:0},work={drilled:0,delivered:0,installed:0};let warnings=0;
 for(const p of piles){const r=records[p.key]||{};stages[status(r)]++;for(const k of Object.keys(work))if(r[k])work[k]++;if(p.warnings.length)warnings++;}
 return {total:piles.length,stages,work,warnings,percent:piles.length?work.installed/piles.length*100:0};
}
root.PRDZones={contains,center,build,summary};if(typeof module!=='undefined')module.exports=root.PRDZones;
})(globalThis);
