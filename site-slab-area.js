/* Area progress: zone boundary minus openings, with overlapping regions counted once. */
(function(root){
'use strict';
const clip=root.polygonClipping||(typeof require==='function'?require('./vendor/polygon-clipping-0.15.7.min.js'):null);
const polygon=item=>[item.points,...(item.holes||[])];
const kind=record=>record?.slab_kind||'opening';
function ringArea(ring){if(!ring?.length)return 0;const [x,y]=ring[0];let sum=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];sum+=(a[0]-x)*(b[1]-y)-(b[0]-x)*(a[1]-y);}return Math.abs(sum)/2;}
function area(multi){return multi.reduce((sum,p)=>sum+ringArea(p[0])-p.slice(1).reduce((n,h)=>n+ringArea(h),0),0)/1e6;}
function union(polygons){return polygons.length?clip.union(...polygons):[];}
function zero(){return {gross:0,opening:0,total:0,completed:0,decked:0,reinforced:0,remaining:0,percent:null};}
function aggregate(values){const result=zero();for(const v of values)for(const key of ['gross','opening','total','completed','decked','reinforced','remaining'])result[key]+=v[key];result.percent=result.total?100*result.completed/result.total:null;return result;}
function summarize(zones,items,records={}){
 if(!clip)throw Error('면적 계산 도구를 불러오지 못했습니다. 새로고침해 주세요.');
 // The whole zone starts as an opening. Saved slab types establish the target;
 // explicit openings cut it, while untouched overlapping candidates cannot erase it.
 const slabs=union(items.filter(v=>kind(records[v.key])!=='opening').map(polygon));
 const openings=union(items.filter(v=>records[v.key]?.slab_kind==='opening').map(polygon));
 const stages=Object.fromEntries(['completed','decked','reinforced'].map(stage=>[stage,union(items.filter(v=>kind(records[v.key])!=='opening'&&records[v.key]?.[stage]).map(polygon))]));
 function within(boundary){const result=zero();result.gross=area(boundary);const assigned=boundary.length&&slabs.length?clip.intersection(boundary,slabs):[],target=assigned.length&&openings.length?clip.difference(assigned,openings):assigned;result.total=area(target);result.opening=Math.max(0,result.gross-result.total);
  for(const [stage,regions] of Object.entries(stages))result[stage]=target.length&&regions.length?Math.min(result.total,area(clip.intersection(target,regions))):0;
  result.remaining=Math.max(0,result.total-result.completed);result.percent=result.total?100*result.completed/result.total:null;return result;
 }
 const zonePolygons=zones.map(polygon);return {area:within(union(zonePolygons)),byZone:Object.fromEntries(zones.map((z,i)=>[z.id,within([zonePolygons[i]])]))};
}
const format=value=>value.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1})+' m²';
const percent=value=>value===null?'—':value.toFixed(value>0&&value<1?2:1)+'%';
root.SiteSlabArea={summarize,aggregate,zero,area,format,percent,kind};if(typeof module!=='undefined')module.exports=root.SiteSlabArea;
})(globalThis);
