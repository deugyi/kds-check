const {test}=require('node:test'),a=require('node:assert/strict');
const S=require('../steel-section.js'),B=require('../steel-beam.js'),C=require('../steel-column.js'),CB=require('../composite-beam.js'),CC=require('../composite-column.js'),R=require('../steel-replacement.js');
const positive=x=>a.ok(Number.isFinite(x)&&x>0,String(x));
const beam=s=>({...s,Fy:325,E:210000,rolled:true,Lb:3000,Cb:1,Mu:0,Vu:0});
test('all 95 current KS sections preserve selected J through beam and biaxial column engines',()=>{
 for(const s of S.SECTIONS){
  const p=beam(s),b=B.calculate(p);a.equal(b.props.J,s.J,s.name);a.ok(b.supported,s.name);positive(b.flexure.phiMn);positive(b.shear.phiVn);
  const c=C.calculate({...p,klx:4000,kly:4000,Pu:100,Mux:10,Muy:10});a.equal(c.props.J,s.J,s.name);
  if(c.nonslender)positive(c.phiPn);else {a.equal(c.phiPn,null);a.equal(c.ok,false);}
 }
});
test('all 95 current KS sections reach composite beam construction and SRC geometry calculations',()=>{
 for(const s of S.SECTIONS){
  const c=CB.calculate({...beam(s),span:9000,spacing:3000,edge:null,ts:150,hr:0,fck:30,wc:2300,stud:'D19',Fu:400,studCount:40,studLength:100,MuConstruction:0,LbConstruction:3000,CbConstruction:1});
  a.equal(c.props.J,s.J,s.name);a.equal(c.steel.props.J,s.J,s.name);positive(c.phiMn);positive(c.steel.flexure.phiMn);
  const o=CC.calculate({type:'src',shapeMode:'rh',section:s.name,B:s.B+200,H:s.H+200,fck:30,Fy:325,klx:4000,kly:4000,Pu:100,Mux:10,Muy:10,fy:500,bar:'D19',tie:'D10',cover:40,tieSpacing:150,nb:3,nh:3});
  a.equal(o.p.sh,s.H);a.equal(o.p.sb,s.B);a.equal(o.p.tw,s.tw);a.equal(o.p.tf,s.tf);a.equal(o.props.steel.A,s.A);positive(o.Pr);positive(o.mx.phiMn);positive(o.my.phiMn);
 }
});
test('replacement and half-cut RH plus tee search cover all 95 current source sections',()=>{
 const p={mode:'capacity',bhGrade:'SM355',rhGrade:'SM355',H:600,B:250,tw:12,tf:20,Lb:3000,Cb:1,Mu:700,Vu:300,maxH:null,maxB:null,keepStiffness:true};
 const r=R.calculate(p);a.equal(r.rows.length,95);a.deepEqual(new Set(r.rows.map(x=>x.section.name)),new Set(S.SECTIONS.map(s=>s.name)));
 for(const row of r.rows){a.equal(row.out.props.J,row.section.J);positive(row.mass);if(row.out.supported)positive(row.out.flexure.phiMn);else a.equal(row.eligible,false);}
 const t=R.calculate({...p,scheme:'tee',topSection:'auto',bending:'both',cutMode:'half',cutHeight:null});a.equal(t.rows.length,95);a.deepEqual(new Set(t.rows.map(x=>x.section.name)),new Set(S.SECTIONS.map(s=>s.name)));
 for(const row of t.rows){positive(row.mass);positive(row.out.props.J);if(!row.out.supported)a.equal(row.eligible,false);}
});
test('manual J remains authoritative for both legacy and new catalog sections',()=>{
 for(const method of ['table','thin-wall']){const s=S.SECTIONS.find(v=>v.JMethod===method);a.equal(B.calculate({...beam(s),J:123456}).props.J,123456);}
});
