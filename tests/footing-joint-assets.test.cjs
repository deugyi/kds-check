const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
test('footing joint engine and UI cache tags match their deployed source contents',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const file of ['footing-joint.js','footing-joint-ui.js']){
  const source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
  const version=crypto.createHash('sha256').update(source).digest('hex').slice(0,12);
  const tags=[...html.matchAll(/<script src="([^"?]+)\?v=([^"]+)"/g)].filter(m=>m[1]===file);
  assert.equal(tags.length,1,file);
  assert.equal(tags[0][2],version,`Update index.html to ${file}?v=${version}`);
 }
});
