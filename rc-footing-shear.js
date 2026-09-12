/* Automatic preliminary reinforcement layout. Separate one-way grids and
 * punching rings: their capacities are never added to one another. */
(function(root){'use strict';
const R=typeof module!=='undefined'&&module.exports?require('./rc-beam.js'):root.RCBeam;
const choices=[300,250,200,150,125,100,75];
function design(r,punch){
 const p=r.p,bar=R.BARS[p.shearBar||'D13'],fyt=p.fyt||400;
 if(!['D10','D13','D16'].includes(p.shearBar||'D13')||![400,500].includes(fyt))throw Error('전단철근은 D10·D13·D16, 강도는 400·500 MPa로 선택하세요.');
 const result={bar:p.shearBar||'D13',fyt,oneway:[],punching:{needed:!r.punching.ok},points:[],notes:[]};
 const margin=p.cover+bar.diameter/2;
 for(const v of r.rows){
  const needed=!v.shearOK,axis=v.axis,width=axis==='X'?p.by:p.bx,along=axis==='X'?p.bx:p.by;
  const Vc=v.phiVc/.75,required=Math.max(0,v.Vu/.75-Vc),limit=.2*(1-p.fck/250)*p.fck*width*v.d/1000;
  const row={axis,needed,required,limit,ok:!needed,phiVn:v.phiVc};
  if(!needed){result.oneway.push(row);continue;}
  if(required>limit){row.reason='콘크리트 압축파괴 한도 초과 · 두께 증대 필요';result.oneway.push(row);continue;}
  // Two-legged closed links, repeated across full width and full projection.
  for(const s of choices){
   if(s>Math.min(v.d/2,600))continue;
   const avReq=Math.max(required*1000*s/(fyt*v.d),Math.max(.0625*Math.sqrt(p.fck),.35)*width*s/fyt);
   const legs=Math.max(2,2*Math.ceil(avReq/(2*bar.area)),2*Math.ceil((width-2*margin)/Math.min(v.d,600)/2));
   const t=(width-2*margin)/(legs-1),Av=legs*bar.area,Vs=Av*fyt*v.d/s/1000,threshold=Math.min(Math.sqrt(p.fck),8.4)*width*v.d/3000;
   const smax=Math.min(v.d/2,600)/(Vs>threshold?2:1);
   if(s>smax||Vs>limit||t<Math.max(75,bar.diameter+25))continue;
   const n=Math.ceil((along-2*margin)/s)+1,actual=(along-2*margin)/(n-1);
   const actualVs=Av*fyt*v.d/actual/1000;
   if(actualVs>limit||actual>Math.min(v.d/2,600)/(actualVs>threshold?2:1))continue;
   Object.assign(row,{ok:true,s:actual,sMax:s,t,legs,rows:n,Av,avReq,Vs:actualVs,phiVn:.75*(Vc+actualVs),count:n*legs/2});
   for(let i=0;i<n;i++)for(let j=0;j<legs;j++){
    const a=-along/2+margin+i*actual,b=-width/2+margin+j*t;
    result.points.push({x:axis==='X'?a:b,y:axis==='X'?b:a,type:axis,label:axis+' 방향 폐쇄형 스터럽 · 2다리 1조'});
   }
   break;
  }
  if(!row.ok&&!row.reason)row.reason='75 mm 이상 간격으로 배치 불가 · 직경 또는 두께 증대 필요';
  result.oneway.push(row);
 }
 if(result.punching.needed){
  const d=r.d,fs=.5*Math.min(fyt,400),rho=r.punching.rho,pr=result.punching;
  Object.assign(pr,{fs,ok:false,rings:[]});
  // Conservative load bound: total factored axial reaction and full moments.
  // No soil/pile reaction or self-weight relief at any punching perimeter.
  function check(offset){
   const bx=p.cx+2*offset,by=p.cy+2*offset,c=punch(p.fck,d,bx,by,rho);
   const jx=d*(bx*by*by/2+by**3/6),jy=d*(by*bx*bx/2+bx**3/6);
   const vu=r.totalU*1000/(c.b0*d)+Math.abs(p.Mxu)*1e6*by/2/jx+Math.abs(p.Myu)*1e6*bx/2/jy;
   const base=Math.min(c.vc,.63*Math.sqrt(p.fck)),cap=Math.min(.58*p.fck*c.cu/d,.25*p.fck);
   return {...c,offset,bx,by,vu,base,cap,ok:vu<=.75*Math.min(base,cap)};
  }
  const inner=check(d/2);pr.inner=inner;
  if(d<Math.max(150,16*bar.diameter))pr.reason='d ≥ max(150 mm, 전단철근 직경의 16배) 조건 미달 · 두께 증대 필요';
  else if(inner.vu>.75*inner.cap)pr.reason='뚫림 압축파괴 상한 초과 · 기초 두께 또는 기둥 크기 증대 필요';
  else{
   const maxOffset=Math.min((p.bx-p.cx)/2,(p.by-p.cy)/2)-margin;
   for(const s of choices){
    if(s>d/2)continue;
    for(let n=1;n<=60;n++){
     const last=s/2+(n-1)*s,outerOffset=last+d/2;
     if(outerOffset>=maxOffset)break;
     const outer=check(outerOffset);if(!outer.ok)continue;
     // Bound required Av by maximum over every reinforced critical ring.
     const cuts=[];for(let a=d/2;a<outerOffset;a+=s)cuts.push(check(a));
     cuts.push(inner);
     if(cuts.some(v=>v.vu>.75*v.cap))continue;
     const req=Math.max(...cuts.map(v=>Math.max(0,v.vu/.75-v.base)*v.b0*s/fs));
     const bx=p.cx+2*last,by=p.cy+2*last,per=2*(bx+by);
     let nx=Math.max(1,Math.ceil(bx/(2*d))),ny=Math.max(1,Math.ceil(by/(2*d)));
     while(2*(nx+ny)*bar.area<req){if(bx/nx>=by/ny)nx++;else ny++;}
     if(Math.min((p.cx+s)/nx,(p.cy+s)/ny)<Math.max(75,bar.diameter+25))continue;
     const Av=2*(nx+ny)*bar.area,provided=cuts.map(v=>({offset:v.offset,phiV:.75*Math.min(v.base+Av*fs/(s*v.b0),v.cap),vu:v.vu}));
     if(provided.some(v=>v.phiV<v.vu-1e-9))continue;
     Object.assign(pr,{ok:true,s,first:s/2,count:n,legs:2*(nx+ny),Av,requiredAv:req,outer,provided,phiV:provided[0].phiV,ratio:Math.max(...provided.map(v=>v.vu/v.phiV))});
     for(let k=0;k<n;k++){
      const off=s/2+k*s,hx=p.cx/2+off,hy=p.cy/2+off,pts=[];
      for(let i=0;i<nx;i++){pts.push({x:-hx+2*hx*i/nx,y:-hy},{x:hx-2*hx*i/nx,y:hy});}
      for(let j=0;j<ny;j++){pts.push({x:hx,y:-hy+2*hy*j/ny},{x:-hx,y:hy-2*hy*j/ny});}
      pr.rings.push({offset:off,hx,hy,points:pts});
      result.points.push(...pts.map(v=>({...v,type:'P',label:`뚫림 전단철근 ${k+1}열 · 상하 정착 수직 다리`})))
     }
     break;
    }
    if(pr.ok)break;
   }
   if(!pr.ok)pr.reason='보강 외곽의 무보강 위험둘레 또는 간격 조건을 만족할 공간 부족 · 기초 크기/두께 증대 필요';
  }
 }
 result.notes.push('표시 점은 수직 전단철근 다리입니다. 1방향은 인접 2다리를 폐쇄형 스터럽으로 묶고, 뚫림은 각 열의 상·하부 휨철근을 둘러싸도록 정착합니다. 상부 정착용 철근 및 정착 상세는 구조기술사 확인이 필요합니다.');
 result.notes.push('1방향 격자와 뚫림 둘레 보강은 각각의 전용 철근량입니다. 내력을 중복 합산하지 않습니다. 실제 시공 배치는 주철근·파일 두부와의 간섭을 조정해야 합니다.');
 if(result.punching.needed)result.notes.push('뚫림 보강은 모든 검토 둘레에서 총 계수축력과 모멘트 전량을 사용하여 반력 공제 없이 보수적으로 산정합니다. 가장 바깥 철근에서 d/2 떨어진 무보강 둘레까지 확인합니다.');
 return result;
}
root.RCFootingShear={design};if(typeof module!=='undefined'&&module.exports)module.exports=root.RCFootingShear;
})(typeof globalThis!=='undefined'?globalThis:this);
