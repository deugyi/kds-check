/* Initial bounded calculators; design scope is repeated in the visible UI. */
(function(root){'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const S=typeof module!=='undefined'&&module.exports?require('./rc-slab-uplift.js'):root.RCSlabUplift;
const K=typeof module!=='undefined'&&module.exports?require('./steel-section.js'):root.SteelSection;
function number(p,k,min=0){if(!Number.isFinite(p[k])||p[k]<min)throw Error(k+' 입력값을 확인하세요.');return p[k];}
function positive(p,keys){for(const k of keys){number(p,k);if(p[k]===0)throw Error(k+'는 0보다 커야 합니다.');}}
function load(p){
 positive(p,['area']);const rows=[];
 for(let i=1;i<=4;i++){const h=number(p,'h'+i),gamma=number(p,'gamma'+i);rows.push({name:['RC 슬래브','무근 콘크리트','마감층','추가 층'][i-1],h,gamma,q:h/1000*gamma});}
 const fixed=number(p,'fixed'),live=number(p,'live'),D=rows.reduce((a,v)=>a+v.q,0)+fixed;
 const combos=[{name:'1.4D',q:1.4*D},{name:'1.2D + 1.6L',q:1.2*D+1.6*live}],governing=combos.reduce((a,b)=>a.q>=b.q?a:b);
 return {rows,fixed,live,D,service:D+live,combos,governing,total:governing.q*p.area};
}
function slab(p){
 positive(p,['lx','ly','h','cover','fck','fy']);if(p.fck<21||p.fck>90||!R.FY.includes(p.fy))throw Error('fck 21~90 MPa, fy 400/500/600 MPa를 사용하세요.');
 if(Math.max(p.lx,p.ly)>2*Math.min(p.lx,p.ly))throw Error('장단변비가 2를 초과합니다. 1방향 슬래브 적용 여부를 확인하세요.');
 const rows=[];
 for(const face of ['b','t'])for(const axis of ['X','Y']){
  const key=face+axis,bar=R.BARS[p['bar'+key]],outer=R.BARS[p['bar'+face+'X']];if(!bar||!outer)throw Error('철근 규격을 확인하세요.');
  positive(p,['s'+key]);const spacing=p['s'+key],Mu=number(p,'M'+key),Vu=number(p,'V'+axis),d=p.h-p.cover-bar.diameter/2-(axis==='Y'?outer.diameter:0);
  if(d<=p.h/2)throw Error('피복·철근층에 비해 슬래브 두께가 부족합니다.');
  const As=bar.area*1000/spacing,c=S.capacity(p,d,As),AsMin=S.minimumRatio(p.fy)*1000*p.h,phiVc=.75*Math.min(Math.sqrt(p.fck),8.4)*d/6;
  const detailOK=As>=AsMin&&spacing<=Math.min(2*p.h,300)&&spacing-bar.diameter>=Math.max(25,bar.diameter);
  rows.push({key,face,axis,bar:p['bar'+key],spacing,Mu,Vu,d,As,AsMin,phiMn:c.phiMn,phiVc,flexOK:Mu<=c.phiMn&&c.ductile,shearOK:Vu<=phiVc,detailOK,ok:Mu<=c.phiMn&&c.ductile&&Vu<=phiVc&&detailOK});
 }
 return {rows,ratio:Math.max(p.lx,p.ly)/Math.min(p.lx,p.ly),ok:rows.every(v=>v.ok)};
}
const holes={16:18,20:22,22:24,24:27,27:30,30:33},edges={16:28,20:34,22:38,24:42,27:48,30:52};
function bolt(p){
 positive(p,['diameter','rows','cols','pitch','gauge','end','side','thickness']);number(p,'Vu');
 if(!holes[p.diameter]||!['F8T','F10T'].includes(p.boltGrade)||!K.STEEL[p.grade])throw Error('볼트·판재 규격을 확인하세요.');
 for(const k of ['rows','cols'])if(!Number.isInteger(p[k])||p[k]>8)throw Error('볼트 행·열 개수는 1~8의 정수입니다.');
 const d=p.diameter,dh=holes[d],n=p.rows*p.cols,t=p.thickness,Fu=K.STEEL[p.grade].Fu,Ab=Math.PI*d*d/4;
 if(p.end<=dh/2||p.side<=dh/2||(p.rows>1&&p.pitch<=dh)||(p.cols>1&&p.gauge<=dh))throw Error('볼트 구멍이 겹치거나 판 밖으로 나갑니다.');
 const Fnv=(p.boltGrade==='F10T'?400:320)*((p.rows-1)*p.pitch>800?.85:1),phiShear=.75*Fnv*Ab*n/1000;
 const endRn=Math.min(1.2*(p.end-dh/2)*t*Fu,2.4*d*t*Fu),innerRn=Math.min(1.2*(p.pitch-dh)*t*Fu,2.4*d*t*Fu),phiBearing=.75*p.cols*(endRn+(p.rows-1)*innerRn)/1000;
 const minEdge=edges[d],minPitch=2.5*d,maxPitch=Math.min(24*t,300),maxEdge=Math.min(12*t,150);
 const spacingOK=(p.rows===1||(p.pitch>=minPitch&&p.pitch<=maxPitch))&&(p.cols===1||(p.gauge>=minPitch&&p.gauge<=maxPitch));
 const edgeOK=Math.min(p.end,p.side)>=minEdge&&Math.max(p.end,p.side)<=maxEdge;
 const width=2*p.side+(p.cols-1)*p.gauge,length=2*p.end+(p.rows-1)*p.pitch;
 return {n,dh,Ab,Fnv,phiShear,phiBearing,minEdge,minPitch,maxPitch,maxEdge,width,length,spacingOK,edgeOK,designDemand:Math.max(p.Vu,45),capacity:Math.min(phiShear,phiBearing),ok:Math.max(p.Vu,45)<=Math.min(phiShear,phiBearing)&&spacingOK&&edgeOK};
}
function weld(p){
 positive(p,['size','length','width','thickness','Fexx']);number(p,'Vu');
 if(![410,490,550,620].includes(p.Fexx))throw Error('용접재 강도를 확인하세요.');
 const a=p.size/Math.SQRT2,beta=p.length<=100*p.size?1:p.length<=300*p.size?Math.min(1,1.2-.002*p.length/p.size):180*p.size/p.length;
 const Le=p.length*beta,Aw=2*a*Le,capacity=.75*.6*p.Fexx*Aw/1000,minSize=p.thickness<6?3:p.thickness<13?5:p.thickness<20?6:8,maxSize=p.thickness<6?p.thickness:p.thickness-2;
 const detailOK=p.size>=minSize&&p.size<=maxSize&&p.length>=Math.max(10*p.size,30,p.width),requiredLength=Math.max(p.Vu,45)*1000/(.75*.6*p.Fexx*2*a);
 return {designDemand:Math.max(p.Vu,45),a,beta,Le,Aw,capacity,minSize,maxSize,detailOK,requiredLength,ok:Math.max(p.Vu,45)<=capacity&&detailOK};
}
root.NewPrograms={load,slab,bolt,weld};if(typeof module!=='undefined'&&module.exports)module.exports=root.NewPrograms;
})(typeof globalThis!=='undefined'?globalThis:this);
