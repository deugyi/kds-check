const {test}=require('node:test'),a=require('node:assert/strict'),E=require('../rebar-development');
const near=(x,y)=>a.ok(Math.abs(x-y)<1e-8*Math.max(1,Math.abs(y)),`${x} != ${y}`);
const base={bar:'D25',fck:25,fy:400,cover:50.8,clear:101.6};
test('straight tension hand examples: cover limit, top/epoxy product cap and small-bar factor',()=>{
 const r=E.calculate(base);near(r.c,63.5);near(r.confinement,2.5);near(r.required,731.52);a.equal(r.suggested,740);
 near(E.calculate({...base,top:true}).required,950.976);
 near(E.calculate({...base,top:true,epoxy:true}).required,1243.584);
 near(E.calculate({...base,bar:'D19',cover:200,clear:200}).required,440.064);
 const q=E.calculate({...base,epoxy:true,cover:76.2,clear:152.4});near(q.factors.beta,1.2);
});
test('transverse reinforcement index and high-strength detailing boundaries',()=>{
 const p={...base,fy:600};a.equal(E.calculate(p).detailingOK,true);a.equal(E.calculate({...p,clear:100}).detailingOK,false);
 const ties={...p,ties:true,Atr:47.625,s:100,n:3,cover:38.1,clear:76.2};
 const r=E.calculate(ties);near(r.Ktr,6.35);near(r.confinement,2.25);a.equal(r.detailingOK,true);
 a.equal(E.calculate({...ties,Atr:47}).detailingOK,false);
 a.equal(E.calculate({...ties,cover:37}).detailingOK,false);
 // At 550 MPa the extra detailing conditions do not apply.
 a.equal(E.calculate({...p,fy:550,clear:25}).detailingOK,true);
});
test('compression applies both lower bounds, then confinement and 200mm minimum',()=>{
 near(E.calculate({...base,type:'compression'}).required,508);
 near(E.calculate({...base,type:'compression',compressionConfined:true}).required,381);
 near(E.calculate({...base,type:'compression',fck:90}).required,436.88);
 a.equal(E.calculate({type:'compression',bar:'D10',fck:90,fy:300,compressionConfined:true}).required,200);
});
test('90 and 180 degree hooks: side and end cover, confinement, high strength exclusions',()=>{
 const p={...base,type:'hook90',hookSide:70,hookTail:50,hookTie:'perpendicular',hookSpacing:75,hookFirst:50};
 near(E.calculate({...base,type:'hook90'}).required,487.68);
 near(E.calculate(p).required,273.1008);
 a.equal(E.calculate({...p,hookTail:49}).factors.cover,1);
 a.equal(E.calculate({...p,type:'hook180',hookTail:0}).factors.cover,.7);
 a.equal(E.calculate({...p,fy:600}).factors.confinement,1);
 a.equal(E.calculate({...p,hookEndRequired:true}).factors.confinement,1);
 a.equal(E.calculate({...p,hookEndRequired:true,hookTie:'none'}).detailingOK,false);
 a.equal(E.calculate({...p,hookEndRequired:true,hookTie:'parallel'}).detailingOK,false);
 a.equal(E.calculate({...p,type:'hook180',hookTie:'parallel'}).detailingOK,false);
 a.equal(E.calculate({...p,hookSpacing:77}).detailingOK,false);
 a.equal(E.calculate({...p,hookFirst:51}).detailingOK,false);
 const q=E.calculate({...p,bar:'D38'});a.equal(q.factors.cover,1);a.equal(q.factors.confinement,1);
 a.equal(E.calculate({type:'hook90',bar:'D10',fy:300,fck:90}).required,150);
});
test('sqrt strength cap, lambda, minimum length and provided-length comparison',()=>{
 near(E.calculate({...base,fck:100}).required,E.calculate({...base,fck:70.56}).required);
 near(E.calculate({...base,lambda:.75}).required,731.52/.75);
 a.equal(E.calculate({...base,available:731.52}).lengthOK,true);a.equal(E.calculate({...base,available:731.5}).lengthOK,false);
 a.equal(E.calculate(base).lengthOK,null);
 a.equal(E.calculate({bar:'D10',fy:300,fck:90,cover:200,clear:200}).required,300);
});
test('invalid active inputs fail and every offered bar and anchorage type returns finite results',()=>{
 for(const p of [{fck:0},{fy:601},{lambda:.74},{bar:'D57'},{cover:0},{clear:NaN},{ties:true,n:1.5},{available:0},{type:'bad'}])a.throws(()=>E.calculate(p));
 for(const bar of E.bars)for(const type of ['tension','compression','hook90','hook180']){const r=E.calculate({bar:bar.name,type});a.ok(Number.isFinite(r.required));a.ok(r.suggested>=r.required);}
});
