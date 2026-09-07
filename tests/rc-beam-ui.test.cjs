const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
// Small DOM adapter to smoke-test wiring; this does not test visual layout.
function load(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),nodes={};
  function node(id){return nodes[id]||(nodes[id]={value:'',hidden:false,textContent:'',_html:'',events:{},style:{},classList:{remove(){},add(){},toggle(){}},addEventListener(t,f){this.events[t]=f;},querySelectorAll(){return [];},get innerHTML(){return this._html;},set innerHTML(v){this._html=v;for(const m of v.matchAll(/id="([^"]+)"/g))node(m[1]);}});}
  for(const m of html.matchAll(/id="([^"]+)"/g))node(m[1]);
  for(const m of html.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g)){nodes[m[1]].value=m[0].match(/value="([^"]*)"/)?.[1]||'';}
  for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
    const options=[...m[2].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)];const opt=options.find(x=>x[1].includes('selected'))||options[0];if(opt)nodes[m[1]].value=opt[1].match(/value="([^"]*)"/)?.[1]||opt[2];
  }
  const ids=['b_b','b_h','b_bar','b_stirrup','b_fck','b_fck_custom','b_fy','b_fyt','b_compression_bar','b_compression_count','b_cover','b_aggregate'];nodes.t1.querySelectorAll=()=>ids.map(id=>nodes[id]);
  const context=vm.createContext({console,document:{getElementById(id){assert.ok(nodes[id],`missing #${id}`);return nodes[id];},querySelectorAll(){return [];}}});
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){const file=m[1].match(/src="([^"]+)"/);vm.runInContext(file?fs.readFileSync(path.join(root,file[1].split('?')[0]),'utf8'):m[2],context);}
  return {nodes,context};
}
test('HTML and scripts initialize with the expected controls and initial results',()=>{
  const {nodes,context}=load();assert.equal(nodes.b_error.hidden,true);assert.match(nodes.b_rows.innerHTML,/336\.35/);assert.match(nodes.b_diagram.innerHTML,/<svg/);
  assert.equal(vm.runInContext('typeof runCol',context),'function');assert.equal(vm.runInContext('typeof runSteelBeam',context),'function');assert.equal(vm.runInContext('typeof runSteelCol',context),'function');
});

test('custom concrete, stirrup strength and compression inputs refresh results',()=>{
  const {nodes}=load();nodes.b_fck.value='custom';nodes.b_fck_custom.value='32.5';nodes.b_fck.events.input();
  assert.equal(nodes.b_custom_field.hidden,false);assert.equal(nodes.b_error.hidden,true);assert.match(nodes.b_basis.innerHTML,/32\.50/);
  nodes.b_compression_count.value='2';nodes.b_compression_count.events.input();assert.equal(nodes.b_error.hidden,true);assert.match(nodes.b_detail_rows.innerHTML,/상부 2-D25/);
  const rows=nodes.b_rows.innerHTML;nodes.b_fyt.value='600';nodes.b_fyt.events.input();assert.equal(nodes.b_rows.innerHTML,rows);
  nodes.b_compression_count.value='100';nodes.b_compression_count.events.input();assert.equal(nodes.b_results.hidden,true);
  nodes.b_compression_count.value='0';nodes.b_fck_custom.value='';nodes.b_fck_custom.events.input();assert.equal(nodes.b_results.hidden,true);
  nodes.b_fck.value='24';nodes.b_fck.events.input();assert.equal(nodes.b_custom_field.hidden,true);assert.equal(nodes.b_error.hidden,true);
});
test('changing stirrup refreshes rows; bad input clears stale results',()=>{
  const {nodes}=load();nodes.b_b.value='360';nodes.b_b.events.input();assert.match(nodes.b_rows.innerHTML,/data-key="5"/);
  nodes.b_stirrup.value='D13';nodes.b_stirrup.events.input();assert.doesNotMatch(nodes.b_rows.innerHTML,/data-key="5"/);
  nodes.b_b.value='';nodes.b_b.events.input();assert.equal(nodes.b_results.hidden,true);assert.equal(nodes.b_error.hidden,false);assert.equal(nodes.b_rows.innerHTML,'');
  nodes.b_b.value='400';nodes.b_b.events.input();assert.equal(nodes.b_error.hidden,true);assert.equal(nodes.b_results.hidden,false);
});
