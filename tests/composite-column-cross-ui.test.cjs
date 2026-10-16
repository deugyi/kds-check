const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{parseHTML}=require('linkedom');
const root=path.join(__dirname,'..');
function harness(){
 const {window,document}=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8'));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,
  get(){const o=[...this.options].find(o=>o.hasAttribute('selected'))||this.options[0];return o?(o.getAttribute('value')??o.textContent):'';},
  set(v){const options=[...this.options];for(const o of options)o.removeAttribute('selected');const hit=options.find(o=>(o.getAttribute('value')??o.textContent)===v);if(hit)hit.setAttribute('selected','');}});
 const context=vm.createContext({console,document,window});
 for(const file of ['steel-spec.js','steel-section.js','rc-beam.js','composite-column.js','composite-column-studs.js','composite-column-ui.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 const get=id=>document.getElementById('cc_'+id),input=(id,v)=>{get(id).value=String(v);get(id).dispatchEvent(new window.Event('input',{bubbles:true}));};
 return {document,get,input};
}
test('existing single H defaults and stud layout remain available',()=>{
 const h=harness();assert.equal(h.get('steelLayout').value,'single');assert.equal(h.get('cross_fields').hidden,true);assert.equal(h.get('error').hidden,true,h.get('error').textContent);
 assert.match(h.get('summary').textContent,/SRC · H형강 매입/);assert.match(h.get('stud_graph').textContent,/대칭 2면 배치/);
});
test('cross option exposes the second H, draws the cross and holds an unverified connection',()=>{
 const h=harness();h.input('steelLayout','cross');assert.equal(h.get('cross_fields').hidden,false);assert.equal(h.get('error').hidden,true,h.get('error').textContent);
 assert.match(h.get('summary').textContent,/십자형/);assert.match(h.get('summary').textContent,/상세 조건 확인 필요/);assert.match(h.get('checks').textContent,/연결 상세 미확인/);
 assert.match(h.get('diagram').innerHTML,/SRC 십자형 H형강 2개/);assert.match(h.get('stud_graph').textContent,/십자형 4면 균등 배치/);
 h.input('crossConnected','confirmed');assert.match(h.get('summary').textContent,/부재 축력·모멘트 검토 충족/);
});
test('independent RH selections update dimensions and BH exposes only the second H for editing',()=>{
 const h=harness();h.input('steelLayout','cross');h.input('section','H-500×200×10×16');h.input('section2','H-450×200×9×14');
 assert.equal(Number(h.get('sh').value),500);assert.equal(Number(h.get('sh2').value),450);assert.equal(h.get('sh2').readOnly,true);assert.equal(h.get('error').hidden,true);
 h.input('shapeMode2','bh');assert.equal(h.get('sh2').readOnly,false);assert.equal(h.get('sh').readOnly,true);h.input('sh2',470);assert.match(h.get('summary').textContent,/H-470×200×9×14/);
});
test('invalid rotated geometry removes all stale results and recovers after correction',()=>{
 const h=harness();h.input('steelLayout','cross');h.input('shapeMode2','bh');h.input('sh2',900);
 assert.equal(h.get('results').hidden,true);assert.equal(h.get('diagram').innerHTML,'');assert.equal(h.get('properties').innerHTML,'');assert.equal(h.get('stud_graph').innerHTML,'');assert.match(h.get('error').textContent,/90°/);
 h.input('sh2',400);assert.equal(h.get('error').hidden,true);assert.equal(h.get('results').hidden,false);
});
test('non-fourfold previous stud count is diagnosed and single/CFT mode restores the old options',()=>{
 const h=harness();h.input('studN',6);h.input('steelLayout','cross');assert.match(h.get('error').textContent,/4의 배수/);assert.equal(h.get('results').hidden,true);
 h.input('studN',4);assert.equal(h.get('error').hidden,true);h.input('type','rect');assert.equal(h.get('src_fields').hidden,true);assert.equal(h.get('error').hidden,true);
 assert.ok(!h.get('studN').querySelector('option').disabled);
 h.input('type','src');h.input('steelLayout','single');assert.equal(h.get('cross_fields').hidden,true);assert.match(h.get('stud_graph').textContent,/대칭 2면 배치/);
});
test('unused invalid second H cannot break CFT or single-H results',()=>{
 const h=harness();h.input('shapeMode2','bh');h.input('sh2','');h.input('type','circle');assert.equal(h.get('error').hidden,true);assert.match(h.get('summary').textContent,/원형강관/);
 h.input('type','src');assert.equal(h.get('error').hidden,true);h.input('steelLayout','cross');assert.equal(h.get('error').hidden,false);h.input('steelLayout','single');assert.equal(h.get('error').hidden,true);
});
