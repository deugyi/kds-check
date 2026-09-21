// Synthetic geometry only. Set PRD_DRAWING_FIXTURE for private integration checks.
if(process.env.PRD_DRAWING_FIXTURE){module.exports=require(require('node:path').resolve(process.env.PRD_DRAWING_FIXTURE));}
else{
 const counts={A1:120,A2:118,A3:115,B1:70,B2:81,B3:77,C1:44,C2:37,C3:88,C4:40},piles=[],paths=[];
 for(const [i,[zone,count]] of Object.entries(counts).entries()){
  const x=(i%4)*20000,y=Math.floor(i/4)*20000;
  paths.push({layer:'-zoning',closed:true,zoneName:zone,points:[[x,y],[x+18000,y],[x+18000,y+18000],[x,y+18000]]});
  for(let n=0;n<count;n++)piles.push({key:(piles.length+1).toString(16),x:x+1000+(n%12)*1300,y:y+1000+Math.floor(n/12)*1300,radius:200,number:[zone+'-'+String(n+1).padStart(3,'0')],name:['synthetic'],type:['test'],reaction:[],warnings:[],layer:'test'});
 }
 module.exports={version:1,id:'a'.repeat(64),filename:'synthetic.dxf',drawing:{piles,paths,warnings:[],units:'mm'},records:{}};
}
