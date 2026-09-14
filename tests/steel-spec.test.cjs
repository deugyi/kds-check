const {test}=require('node:test');
const assert=require('node:assert/strict');
const {catalogs:c,find}=require('../steel-spec.js');
test('KS reference catalogs retain unique exact dimension combinations and positive values',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(c).map(([k,r])=>[k,r.length])),{H:95,PIPE:127,BOX:122,L:53,CHANNEL:24});
 for(const [kind,rows] of Object.entries(c)){
  assert.equal(new Set(rows.map(r=>r.name)).size,rows.length);
  for(const r of rows){for(const k of ['H','B','A','mass','Ix','Iy'])assert.ok(Number.isFinite(r[k])&&r[k]>0,r.name+' '+k);assert.equal(find(kind,r.id),r);}
 }
 assert.ok(!c.PIPE.some(r=>r.D===21.7&&r.t===3.2));
 assert.ok(c.BOX.some(r=>r.H!==r.B));assert.ok(c.L.some(r=>r.H!==r.B));
});
test('published KS fixtures include root radii, small and large sections, and both angle axes',()=>{
 const h=c.H.find(r=>r.H===100&&r.B===50);assert.deepEqual([h.r,h.A,h.mass,h.Ix,h.Iy],[8,11.85,9.3,187,14.8]);
 const large=c.H.find(r=>r.H===918);assert.deepEqual([large.A,large.mass,large.Ix,large.Iy],[391.3,307,542000,17200]);
 const b=c.BOX.find(r=>r.H===400&&r.t===12);assert.deepEqual([b.A,b.mass,b.Ix,b.Iy],[134.5,106,27300,9230]);
 const l=c.L.find(r=>r.H===150&&r.B===100&&r.t===15);assert.deepEqual([l.r,l.r2,l.A,l.mass,l.Ix,l.Iy],[12,8.5,35.25,27.7,782,276]);
});
test('PIPE computes annulus area and equal second moments with correct unit conversions',()=>{
 const r=c.PIPE.find(r=>r.D===216.3&&r.t===6),outer=216.3/10,inner=(216.3-12)/10;
 assert.ok(Math.abs(r.A-Math.PI/4*(outer**2-inner**2))<1e-10);
 assert.ok(Math.abs(r.Ix-Math.PI/64*(outer**4-inner**4))<1e-9);
 assert.equal(r.Iy,r.Ix);assert.ok(Math.abs(r.mass-31.116)<.001);assert.equal(r.calculated,true);
});
test('original-table inconsistencies remain flagged rather than silently replacing published values',()=>{
 const flagged=Object.values(c).flat().filter(r=>r.issue);assert.equal(flagged.length,4);
 assert.equal(c.H.find(r=>r.H===208).Ix,6350);
 assert.equal(c.BOX.find(r=>r.H===200&&r.B===200&&r.t===5).A,45.63);
 assert.equal(c.BOX.find(r=>r.H===200&&r.B===200&&r.t===6).A,59.73);
 assert.equal(c.BOX.find(r=>r.H===350&&r.t===12.5).A,158.5);
});
test('H table moments cross-check against independent numerical strip integration including fillets',()=>{
 for(const r of c.H.filter(r=>!r.issue)){
  let Ix=0,Iy=0;const dy=r.H/20000;
  for(let j=0;j<20000;j++){
   const y=(j+.5)*dy,u=Math.min(y-r.tf,r.H-r.tf-y);
   const width=u<0?r.B:r.tw+(u<r.r?2*(r.r-Math.sqrt(r.r**2-(r.r-u)**2)):0);
   Ix+=width*(y-r.H/2)**2*dy;Iy+=width**3/12*dy;
  }
  assert.ok(Math.abs(Ix/1e4/r.Ix-1)<.013,r.name+' Ix');assert.ok(Math.abs(Iy/1e4/r.Iy-1)<.013,r.name+' Iy');
 }
});

test('Channel KS tables 5 and 6 preserve distinct flange types and centroid-axis properties',()=>{
 const rows=c.CHANNEL;assert.equal(rows.filter(r=>r.variant==='tapered').length,16);assert.equal(rows.filter(r=>r.variant==='parallel').length,8);
 const t=rows.find(r=>r.H===200&&r.B===80&&r.variant==='tapered');
 assert.deepEqual([t.tw,t.tf,t.r,t.r2,t.A,t.mass,t.Ix,t.Iy,t.Cy],[7.5,11,12,6,31.33,24.6,1950,168,2.21]);
 const p=rows.find(r=>r.H===200&&r.B===80&&r.variant==='parallel');
 assert.deepEqual([p.tw,p.tf,p.r,p.A,p.mass,p.Ix,p.Iy,p.Cy],[6.5,11.5,12,30.5,24,1984,192.5,2.55]);
 for(const r of rows){assert.ok(r.Cy*10>r.tw&&r.Cy*10<r.B);assert.ok(Math.abs(r.mass/(r.A*.785)-1)<.005);assert.ok(r.Ix>r.Iy);}
});
