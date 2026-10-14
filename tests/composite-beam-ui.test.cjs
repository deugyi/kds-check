const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{parseHTML}=require('linkedom');
const root=path.join(__dirname,'..');
function harness(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),{window,document}=parseHTML(html);
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked');}});
  // linkedom does not apply the browser's option-text fallback for value.
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,
    get(){const o=[...this.options].find(o=>o.hasAttribute('selected'))||this.options[0];return o?(o.getAttribute('value')??o.textContent):'';},
    set(v){const options=[...this.options];for(const o of options)o.removeAttribute('selected');const hit=options.find(o=>(o.getAttribute('value')??o.textContent)===v);if(hit)hit.setAttribute('selected','');}});
  const context=vm.createContext({console,window,document,Event:window.Event});
  for(const f of ['steel-spec.js','steel-section.js','steel-beam.js','composite-beam-loads.js','composite-beam.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
  const picker=html.match(/var SectionPicker=\(function\(\)\{[\s\S]*?\}\)\(\);/);assert.ok(picker);vm.runInContext(picker[0],context);
  vm.runInContext(fs.readFileSync(path.join(root,'composite-beam-ui.js'),'utf8'),context);
  const get=id=>document.getElementById(id),input=(id,value)=>{get(id).value=String(value);get(id).dispatchEvent(new window.Event('input',{bubbles:true}));};
  const click=id=>get(id).dispatchEvent(new window.Event('click',{bubbles:true}));
  const rowInput=(row,selector,value)=>{row.querySelector(selector).value=String(value);row.querySelector(selector).dispatchEvent(new window.Event('input',{bubbles:true}));};
  return {window,document,context,get,input,click,rowInput};
}
test('default automatic loads hide direct demands and react to live/finish changes',()=>{
  const h=harness();assert.equal(h.get('cb_error').hidden,true,h.get('cb_error').textContent);assert.equal(h.get('cb_direct_loads').hidden,true);
  assert.match(h.get('cb_loads').textContent,/1.4D/);assert.match(h.get('cb_loads').textContent,/1.2D \+ 1.6L/);
  const before=h.get('cb_loads').textContent;h.input('cb_live',6);assert.notEqual(h.get('cb_loads').textContent,before);
  const after=h.get('cb_loads').textContent;h.input('cb_finish',2);assert.notEqual(h.get('cb_loads').textContent,after);
});
test('multiple point rows add, change demand, classify construction and delete independently',()=>{
  const h=harness(),plain=h.get('cb_loads').textContent;h.click('cb_add_point');h.click('cb_add_point');
  const rows=[...h.get('cb_point_rows').querySelectorAll('[data-cb-point]')];assert.equal(rows.length,2);
  h.rowInput(rows[0],'[data-p]',100);h.rowInput(rows[0],'[data-x]',2);assert.equal(h.get('cb_error').hidden,true,h.get('cb_error').textContent);
  assert.match(h.get('cb_connection_checks').textContent,/집중하중 1/);assert.notEqual(h.get('cb_loads').textContent,plain);
  h.rowInput(rows[1],'[data-kind]','CP');h.rowInput(rows[1],'[data-p]',50);assert.match(h.get('cb_loads').textContent,/시공 작업하중 CP/);
  rows[0].querySelector('button').dispatchEvent(new h.window.Event('click',{bubbles:true}));assert.equal(h.get('cb_point_rows').querySelectorAll('[data-cb-point]').length,1);
  assert.match(h.get('cb_loads').textContent,/완공 0개 \/ 시공 1개/);
});
test('invalid position and blank loads clear old results, then recover',()=>{
  const h=harness();h.click('cb_add_point');const row=h.get('cb_point_rows').querySelector('[data-cb-point]');
  h.rowInput(row,'[data-p]',100);h.rowInput(row,'[data-x]',10);assert.equal(h.get('cb_results').hidden,true);assert.equal(h.get('cb_loads').innerHTML,'');assert.equal(h.get('cb_connection_checks').innerHTML,'');
  h.rowInput(row,'[data-x]',2);assert.equal(h.get('cb_results').hidden,false);h.input('cb_finish','');assert.equal(h.get('cb_results').hidden,true);
  h.input('cb_finish',1.5);assert.equal(h.get('cb_error').hidden,true);
});
test('direct mode ignores invalid hidden automatic inputs, preserves point rows and clears invalid direct demand',()=>{
  const h=harness();h.click('cb_add_point');h.input('cb_finish','');h.input('cb_load_mode','direct');
  assert.equal(h.get('cb_error').hidden,true);assert.equal(h.get('cb_auto_loads').hidden,true);assert.equal(h.get('cb_direct_loads').hidden,false);assert.match(h.get('cb_loads').textContent,/직접 입력/);
  h.input('cb_mu',-1);assert.equal(h.get('cb_results').hidden,true);h.input('cb_mu',500);assert.equal(h.get('cb_results').hidden,false);
  h.input('cb_finish',1.5);h.input('cb_load_mode','auto');assert.equal(h.get('cb_point_rows').querySelectorAll('[data-cb-point]').length,1);assert.equal(h.get('cb_error').hidden,true);
});
test('KS automatic selection updates dimensions, grade and source, then removes stale selection claims on edits',()=>{
  const h=harness();h.get('cb_J').value='100000';h.click('cb_auto_select');assert.match(h.get('cb_design_note').textContent,/단면적 최소/);
  const section=h.context.SteelSection.findSection(h.get('cb_sec').value);assert.ok(section);assert.equal(Number(h.get('cb_H').value),section.H);assert.equal(h.get('cb_J').value,'');
  assert.equal(Number(h.get('cb_fy').value),h.context.SteelSection.yieldStrength(h.get('cb_gr').value,section.tf));assert.equal(h.get('cb_error').hidden,true);
  assert.match(h.get('cb_summary').textContent,/조건 충족/);h.input('cb_live',7);assert.equal(h.get('cb_design_note').textContent,'');
});
test('no passing KS section leaves the original dimensions and shows a truthful result',()=>{
  const h=harness();h.input('cb_live',10000);const name=h.get('cb_sec').value;h.click('cb_auto_select');assert.equal(h.get('cb_sec').value,name);assert.match(h.get('cb_design_note').textContent,/만족하는 단면이 없습니다/);
});
