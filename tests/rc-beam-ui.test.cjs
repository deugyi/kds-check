const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
// Small DOM adapter to smoke-test wiring; this does not test visual layout.
function load(extra={}){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),nodes={};
  function node(id){return nodes[id]||(nodes[id]={value:'',hidden:false,textContent:'',_html:'',events:{},style:{},classList:{remove(){},add(){},toggle(){}},addEventListener(t,f){this.events[t]=f;},querySelectorAll(){return [];},get innerHTML(){return this._html;},set innerHTML(v){this._html=v;for(const m of v.matchAll(/id="([^"]+)"/g))node(m[1]);}});}
  for(const m of html.matchAll(/id="([^"]+)"/g))node(m[1]);
  for(const m of html.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g)){nodes[m[1]].value=m[0].match(/value="([^"]*)"/)?.[1]||'';}
  for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
    const options=[...m[2].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)];const opt=options.find(x=>x[1].includes('selected'))||options[0];if(opt)nodes[m[1]].value=opt[1].match(/value="([^"]*)"/)?.[1]||opt[2];
  }
  const ids=['b_b','b_h','b_bar','b_stirrup','b_fck','b_fck_custom','b_fy','b_fyt','b_compression_bar','b_compression_count','b_cover','b_aggregate','b_legs','b_spacing','b_vu','b_skin_mode','b_skin_bar','b_skin_count','b_environment','b_concrete_price','b_steel_price','b_waste','b_cut_length'];nodes.t1.querySelectorAll=()=>ids.map(id=>nodes[id]);
  nodes.t7.querySelectorAll=()=>[...html.matchAll(/<(?:input|select)\b[^>]*id="(tb_[^"]+)"/g)].map(m=>nodes[m[1]]);
  const context=vm.createContext({console,...extra,document:{getElementById(id){assert.ok(nodes[id],`missing #${id}`);return nodes[id];},querySelectorAll(){return [];},addEventListener(){}}});
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){const file=m[1].match(/src="([^"]+)"/);vm.runInContext(file?fs.readFileSync(path.join(root,file[1].split('?')[0]),'utf8'):m[2],context);}
  return {nodes,context};
}
test('transfer final Vu updates outputs, indicates load scope and clears invalid results',()=>{
 const {nodes:n}=load();assert.equal(n.tb_final_vu.value,'');assert.match(n.tb_phase_results.innerHTML,/최종 Vu 미입력/);
 n.tb_span.value='20';n.tb_span.events.input();const before=n.tb_joint_results.innerHTML;
 n.tb_final_vu.value='10000';n.tb_final_vu.events.input();assert.equal(n.tb_error.hidden,true);
 assert.match(n.tb_phase_results.innerHTML,/10,000/);assert.match(n.tb_phase_results.innerHTML,/최종 입력 Vu 지배/);
 assert.match(n.tb_phase_results.innerHTML,/자중 Mu/);assert.match(n.tb_phase_results.innerHTML,/최종 하중의 휨 검토는 별도/);
 assert.notEqual(n.tb_joint_results.innerHTML,before);assert.match(n.tb_diagram.innerHTML,/<svg/);
 n.tb_final_vu.value='-1';n.tb_final_vu.events.input();assert.equal(n.tb_results.hidden,true);assert.equal(n.tb_joint_results.innerHTML,'');
 n.tb_final_vu.value='';n.tb_final_vu.events.input();assert.equal(n.tb_results.hidden,false);assert.equal(n.tb_joint_results.innerHTML,before);
});
test('development length UI switches modes, checks available length and removes stale results',()=>{
 const {nodes}=load();
 assert.equal(nodes.rd_error.hidden,true);assert.match(nodes.rd_summary.innerHTML,/소요 정착길이/);
 nodes.rd_type.value='compression';nodes.rd_type.events.change();assert.equal(nodes.rd_tension.hidden,true);assert.equal(nodes.rd_compression.hidden,false);assert.match(nodes.rd_calculation.innerHTML,/0.043/);
 nodes.rd_type.value='hook90';nodes.rd_type.events.change();assert.match(nodes.rd_diagram.innerHTML,/ldh/);
 nodes.rd_available.value='100';nodes.rd_available.events.input();assert.match(nodes.rd_summary.innerHTML,/확보 길이 부족/);
 nodes.rd_hookEndRequired.value='yes';nodes.rd_hookEndRequired.events.change();assert.match(nodes.rd_summary.innerHTML,/상세조건 미충족/);
 nodes.rd_fck.value='';nodes.rd_fck.events.input();assert.equal(nodes.rd_results.hidden,true);assert.equal(nodes.rd_summary.innerHTML,'');assert.equal(nodes.rd_error.hidden,false);
 nodes.rd_fck.value='30';nodes.rd_fck.events.input();assert.equal(nodes.rd_results.hidden,false);assert.equal(nodes.rd_error.hidden,true);
});
test('HTML and scripts initialize with the expected controls and initial results',()=>{
  const {nodes,context}=load();assert.equal(nodes.b_error.hidden,true);assert.match(nodes.b_rows.innerHTML,/418\.83/);assert.match(nodes.b_diagram.innerHTML,/<svg/);
  assert.equal(vm.runInContext('typeof RCColumn',context),'object');assert.match(nodes.c_axes.innerHTML,/<svg/);assert.match(nodes.c_diagram.innerHTML,/<svg/);assert.match(nodes.c_quantities.innerHTML,/만원/);assert.equal(vm.runInContext('typeof SteelBeam',context),'object');assert.match(nodes.sb_flexure.innerHTML,/kN·m/);assert.match(nodes.sb_props.innerHTML,/<svg/);assert.equal(vm.runInContext('typeof runSteelCol',context),'function');
});

test('steel column renders capacity and clears it after invalid input',()=>{
  const {nodes,context}=load();
  assert.equal(nodes.sc_error.hidden,true);assert.match(nodes.sc_summary.innerHTML,/5,987\.1/);
  assert.match(nodes.sc_diagram.innerHTML,/<svg/);assert.match(nodes.sc_axes.innerHTML,/Y · 약축 \(지배\)/);
  nodes.sc_pu.value='7000';vm.runInContext('runSteelCol()',context);assert.match(nodes.sc_summary.innerHTML,/압축강도 미달/);
  nodes.sc_pu.value='';vm.runInContext('runSteelCol()',context);assert.equal(nodes.sc_results.hidden,true);assert.equal(nodes.sc_summary.innerHTML,'');
  nodes.sc_pu.value='3000';vm.runInContext('runSteelCol()',context);assert.equal(nodes.sc_error.hidden,true);
  nodes.sc_mux.value='500';nodes.sc_muy.value='300';vm.runInContext('runSteelCol()',context);
  assert.match(nodes.sc_interaction.innerHTML,/축력–2축 휨 검토 미달/);assert.match(nodes.sc_moments.innerHTML,/약축/);
  nodes.sc_mux.value='';vm.runInContext('runSteelCol()',context);assert.equal(nodes.sc_interaction.innerHTML,'');
});

test('composite and slab screens expose new inputs and render the two load combinations',()=>{
  const {nodes,context}=load();
  assert.equal(nodes.cb_error.hidden,true);assert.match(nodes.cb_flow.innerHTML,/반 경간 22줄 = 44개/);
  assert.equal(nodes.s_error.hidden,true);assert.match(nodes.s_load.innerHTML,/1.2D \+ 1.6L/);
  nodes.s_live.value='10';vm.runInContext(fs.readFileSync(path.join(root,'rc-slab-uplift-ui.js'),'utf8'),context);
  assert.match(nodes.s_load.innerHTML,/28.78/);assert.match(nodes.s_sections.innerHTML,/중력하중 · 상부근/);
  nodes.cb_per_row.value='3';vm.runInContext(fs.readFileSync(path.join(root,'composite-beam-ui.js'),'utf8'),context);
  assert.match(nodes.cb_summary.innerHTML,/미달 항목/);assert.match(nodes.cb_flow.innerHTML,/플랜지 폭/);
});

test('custom concrete, stirrup strength and compression inputs refresh results',()=>{
  const {nodes}=load();nodes.b_fck.value='custom';nodes.b_fck_custom.value='32.5';nodes.b_fck.events.input();
  assert.equal(nodes.b_custom_field.hidden,false);assert.equal(nodes.b_error.hidden,true);assert.match(nodes.b_basis.innerHTML,/32\.50/);
  nodes.b_compression_count.value='2';nodes.b_compression_count.events.input();assert.equal(nodes.b_error.hidden,true);assert.match(nodes.b_detail_rows.innerHTML,/상부 2-D25/);
  const rows=nodes.b_rows.innerHTML;nodes.b_fyt.value='500';nodes.b_fyt.events.input();assert.equal(nodes.b_rows.innerHTML,rows);
  nodes.b_compression_count.value='100';nodes.b_compression_count.events.input();assert.equal(nodes.b_results.hidden,true);
  nodes.b_compression_count.value='0';nodes.b_fck_custom.value='';nodes.b_fck_custom.events.input();assert.equal(nodes.b_results.hidden,true);
  nodes.b_fck.value='24';nodes.b_fck.events.input();assert.equal(nodes.b_custom_field.hidden,true);assert.equal(nodes.b_error.hidden,true);
});

test('quantity, shear and skin controls update with selected section and clear on invalid input',()=>{
  const {nodes}=load();assert.match(nodes.b_quantities.innerHTML,/0\.2400 m³/);assert.match(nodes.b_shear.innerHTML,/設計|설계전단강도/);
  nodes.b_h.value='1000';nodes.b_h.events.input();assert.match(nodes.b_skin.innerHTML,/표피철근 간격 조건 충족/);assert.match(nodes.b_diagram.innerHTML,/fill="var\(--ok\)"/);
  nodes.b_legs.value='6';nodes.b_legs.events.input();assert.match(nodes.b_shear.innerHTML,/Av = 6/);assert.match(nodes.b_diagram.innerHTML,/스터럽 6다리/);
  nodes.b_vu.value='9999';nodes.b_vu.events.input();assert.match(nodes.b_shear.innerHTML,/소요전단력 Vu가/);
  nodes.b_skin_mode.value='none';nodes.b_skin_mode.events.input();assert.match(nodes.b_skin.innerHTML,/표피철근 필요/);
  nodes.b_concrete_price.value='';nodes.b_concrete_price.events.input();assert.match(nodes.b_quantities.textContent,/단가/);
  nodes.b_b.value='';nodes.b_b.events.input();assert.equal(nodes.b_results.hidden,true);assert.equal(nodes.b_quantities.innerHTML,'');
});
test('changing stirrup refreshes rows; bad input clears stale results',()=>{
  const {nodes}=load();nodes.b_b.value='370';nodes.b_b.events.input();assert.match(nodes.b_rows.innerHTML,/data-key="5"/);
  nodes.b_stirrup.value='D13';nodes.b_stirrup.events.input();assert.doesNotMatch(nodes.b_rows.innerHTML,/data-key="5"/);
  nodes.b_b.value='';nodes.b_b.events.input();assert.equal(nodes.b_results.hidden,true);assert.equal(nodes.b_error.hidden,false);assert.equal(nodes.b_rows.innerHTML,'');
  nodes.b_b.value='400';nodes.b_b.events.input();assert.equal(nodes.b_error.hidden,true);assert.equal(nodes.b_results.hidden,false);
});

test('slab plain concrete height converts mm to load with fixed unit weights',()=>{
  const {nodes,context}=load();
  const refresh=()=>vm.runInContext(fs.readFileSync(path.join(root,'rc-slab-uplift-ui.js'),'utf8'),context);
  assert.equal(nodes.s_live.value,'3');assert.equal(nodes.s_plain_height.value,'150');
  assert.equal(nodes.s_gw,undefined);assert.equal(nodes.s_gc,undefined);
  assert.match(nodes.s_load.innerHTML,/3\.45/);assert.match(nodes.s_load.innerHTML,/17\.58/);
  nodes.s_plain_height.value='300';refresh();
  assert.match(nodes.s_load.innerHTML,/6\.90/);assert.match(nodes.s_load.innerHTML,/21\.72/);
  nodes.s_plain_height.value='0';refresh();assert.equal(nodes.s_error.hidden,true);assert.match(nodes.s_load.innerHTML,/13\.44/);
  for(const bad of ['-1','']){nodes.s_plain_height.value=bad;refresh();assert.equal(nodes.s_results.hidden,true);assert.match(nodes.s_error.textContent,/무근 콘크리트 높이/);assert.equal(nodes.s_load.innerHTML,'');}
});


test('RH plus tee initializes and restores the existing single-RH search',()=>{
  const {nodes}=load();
  assert.match(nodes.br_assembly_results.innerHTML,/동일 규격/);assert.match(nodes.br_diagram.innerHTML,/가운데 플랜지 제외/);
  assert.match(nodes.br_assembly_results.innerHTML,/정모멘트/);assert.match(nodes.br_assembly_results.innerHTML,/부모멘트/);
  nodes.br_scheme.value='single';nodes.t8.events.input();
  assert.equal(nodes.br_tee_fields.hidden,true);assert.equal(nodes.br_assembly_details.hidden,true);
  assert.match(nodes.br_compare.innerHTML,/H-588×300×12×20/);
});
test('RH plus tee clears stale results after missing cut height and recovers',()=>{
  const {nodes}=load();nodes.br_cutMode.value='custom';nodes.br_cutHeight.value='';nodes.t8.events.input();
  assert.match(nodes.br_error.textContent,/절단 높이/);assert.equal(nodes.br_rows.innerHTML,'');assert.equal(nodes.br_assembly_details.hidden,true);
  nodes.br_cutHeight.value='300';nodes.t8.events.input();assert.match(nodes.br_assembly_results.innerHTML,/동일 규격/);assert.match(nodes.br_rows.innerHTML,/전체 H/);
});


test('replacement uses one material dropdown and colors RH and tee in a single model drawing',()=>{
 const {nodes}=load();assert.ok(!nodes.br_rhGrade&&!nodes.br_teeGrade);
 assert.match(nodes.br_compare.innerHTML,/SM355/);assert.doesNotMatch(nodes.br_compare.innerHTML,/SHN355/);
 assert.ok(!nodes.br_view_actual&&!nodes.br_view_model);assert.match(nodes.br_diagram.innerHTML,/검토 단면: 가운데 플랜지 제외/);assert.match(nodes.br_diagram.innerHTML,/fill="#248466"/);assert.match(nodes.br_diagram.innerHTML,/fill="#1764b5"/);
 nodes.br_bhGrade.value='SM275';nodes.t8.events.input();assert.match(nodes.br_material.textContent,/모두 SM275/);
});


test('replacement model shows a faint excluded flange and expanded-cut proposal',()=>{
 const {nodes}=load();assert.match(nodes.br_diagram.innerHTML,/data-middle-flange="excluded"/);assert.ok(!nodes.br_summary);assert.match(nodes.br_rows.innerHTML,/[+]20\.6%/);assert.match(nodes.br_rows.innerHTML,/data-br-section="[^"|]+[|][0-9.]+"/);
 nodes.br_cutMode.value='half';nodes.t8.events.input();assert.ok([...nodes.br_rows.innerHTML.matchAll(/<span class="beam-muted">hT [^<]+/g)].every(m=>m[0].includes('(50% · 기본)')));assert.match(nodes.br_compare.innerHTML,/원안 대비 중량 증감률/);
});


test('SRC and both CFT screens render, toggle controls and clear stale results',()=>{
 const {nodes}=load();assert.equal(nodes.cc_error.hidden,true);assert.match(nodes.cc_summary.innerHTML,/SRC/);assert.match(nodes.cc_diagram.innerHTML,/svg/);
 for(const type of ['rect','circle','src']){nodes.cc_type.value=type;nodes.t9.events.input();assert.equal(nodes.cc_error.hidden,true);assert.match(nodes.cc_interaction.innerHTML,/상호작용식/);assert.equal(nodes.cc_src_fields.hidden,type!=='src');assert.equal(nodes.cc_H_field.hidden,type==='circle');}
 nodes.cc_Pu.value='';nodes.t9.events.input();assert.equal(nodes.cc_error.hidden,false);assert.equal(nodes.cc_results.hidden,true);assert.equal(nodes.cc_diagram.innerHTML,'');
 nodes.cc_Pu.value='4000';nodes.t9.events.input();assert.equal(nodes.cc_error.hidden,true);assert.equal(nodes.cc_results.hidden,false);
});


test('composite column defaults to 800 mm, automatic Ec, RH selection and stud diagrams',()=>{
 const {nodes}=load();assert.ok(!nodes.cc_Ec);assert.equal(nodes.cc_B.value,'800');assert.equal(nodes.cc_H.value,'800');
 assert.equal(nodes.cc_shapeMode.value,'rh');assert.equal(nodes.cc_sh.readOnly,true);assert.equal(Number(nodes.cc_sb.value),400);
 assert.match(nodes.cc_axial.innerHTML,/자동 산정 Ec/);assert.match(nodes.cc_stud_graph.innerHTML,/data-stud=/);assert.match(nodes.cc_stud_results.innerHTML,/하중도입부|도입부/);
 nodes.cc_shapeMode.value='bh';nodes.t9.events.input();assert.equal(nodes.cc_sh.readOnly,false);
 nodes.cc_studS.value='0';nodes.t9.events.input();assert.equal(nodes.cc_error.hidden,false);assert.equal(nodes.cc_stud_graph.innerHTML,'');
});


test('RC wall menu, default inputs, view switching and error recovery are wired',()=>{
 const {nodes}=load();
 assert.equal(nodes.w_error.hidden,true);assert.match(nodes.w_inplane.innerHTML,/4.9-1/);assert.match(nodes.w_outplane.innerHTML,/수직방향/);assert.match(nodes.w_diagram.innerHTML,/<svg/);
 nodes.w_view_v.events.click();assert.match(nodes.w_diagram.innerHTML,/축력–휨/);
 const first=nodes.w_inplane.innerHTML;nodes.w_M.value='3000';nodes.w_M.events.input();assert.notEqual(nodes.w_inplane.innerHTML,first);
 nodes.w_fck.value='custom';nodes.w_fck_custom.value='32.5';nodes.w_fck.events.input();assert.equal(nodes.w_custom_field.hidden,false);assert.equal(nodes.w_error.hidden,true);
 nodes.w_Nv.value='100000';nodes.w_Nv.events.input();assert.match(nodes.w_outplane.innerHTML,/축력 범위 밖/);
 nodes.w_t.value='';nodes.w_t.events.input();assert.equal(nodes.w_results.hidden,true);assert.equal(nodes.w_diagram.innerHTML,'');assert.equal(nodes.w_outplane.innerHTML,'');
 nodes.w_t.value='300';nodes.w_Nv.value='';nodes.w_t.events.input();assert.equal(nodes.w_results.hidden,false);
});


test('RC frame editor solves, changes support and load forms, and clears unstable results',()=>{
 const {nodes}=load();assert.equal(nodes.fr_error.hidden,true);assert.match(nodes.fr_summary.innerHTML,/3경간/);assert.match(nodes.fr_plot.innerHTML,/<svg/);
 nodes.fr_model.events.click({type:'click',target:{closest:()=>({getAttribute:k=>k==='data-node'?'3':null})},preventDefault(){}});assert.equal(nodes.fr_node.value,'3');
 nodes.fr_support.value='pin';nodes.fr_support.events.change();nodes.fr_copy_support.events.click();assert.match(nodes.fr_column_results.innerHTML,/기둥 없는/);
 nodes.fr_loadType.value='trapezoid';nodes.fr_loadType.events.change();assert.equal(nodes.fr_rise_field.hidden,false);assert.match(nodes.fr_load_diagram.innerHTML,/<polygon/);
 nodes.fr_add_load.events.click();nodes.fr_loadType.value='point';nodes.fr_loadType.events.change();nodes.fr_loadValue.value='100';nodes.fr_loadValue.events.input();assert.equal(nodes.fr_extent_field.hidden,true);assert.equal(nodes.fr_error.hidden,true);
 nodes.fr_count.value='1';nodes.fr_count.events.change();nodes.fr_node.value='1';nodes.fr_node.events.change();nodes.fr_support.value='free';nodes.fr_support.events.change();assert.equal(nodes.fr_results.hidden,true);assert.equal(nodes.fr_plot.innerHTML,'');
 nodes.fr_node.value='0';nodes.fr_node.events.change();nodes.fr_support.value='fixed';nodes.fr_support.events.change();assert.equal(nodes.fr_error.hidden,true);assert.equal(nodes.fr_results.hidden,false);
 nodes.fr_L.value='';nodes.fr_L.events.input();assert.equal(nodes.fr_results.hidden,true);nodes.fr_L.value='6';nodes.fr_L.events.input();assert.equal(nodes.fr_results.hidden,false);
});


test('one-way slab initializes, switches load mode, selects steel and clears invalid results',()=>{
 const {nodes,context}=load();
 for(const [key,value] of Object.entries({fck:'30',fy:'500',h:'150',L:'3',cover:'20',environment:'other'}))assert.equal(nodes['ow_'+key].value,value);
 assert.equal(nodes.ow_error.hidden,true);assert.match(nodes.ow_diagram.innerHTML,/<svg/);assert.match(nodes.ow_load.innerHTML,/12.15/);
 nodes.ow_mode.value='direct';nodes.ow_Mp.value='1000';vm.runInContext('runRCSlabOneWay()',context);
 assert.equal(nodes.ow_direct.hidden,false);assert.equal(nodes.ow_auto.hidden,true);assert.match(nodes.ow_error.textContent,/미달/);assert.equal(nodes.ow_results.hidden,true);
 nodes.ow_Mp.value='20';vm.runInContext('runRCSlabOneWay()',context);
 nodes.ow_diagram.events.click({target:{closest:()=>({dataset:{face:'top'}})}});assert.match(nodes.ow_selected.innerHTML,/상부/);
 nodes.ow_h.value='';vm.runInContext('runRCSlabOneWay()',context);assert.equal(nodes.ow_results.hidden,true);assert.equal(nodes.ow_diagram.innerHTML,'');
 nodes.ow_h.value='200';nodes.ow_mode.value='auto';vm.runInContext('runRCSlabOneWay()',context);assert.equal(nodes.ow_error.hidden,true);assert.equal(nodes.ow_results.hidden,false);
});


test('slab load combinations, propped end and prominent distribution/shear results are wired',()=>{
 const {nodes,context}=load();assert.equal(nodes.ow_aggregate,undefined);
 assert.match(nodes.ow_summary.innerHTML,/하부 주철근/);assert.match(nodes.ow_summary.innerHTML,/상부 주철근/);assert.match(nodes.ow_summary.innerHTML,/전단내력/);
 assert.match(nodes.ow_temp.innerHTML,/최대 중심간격/);assert.match(nodes.ow_temp.innerHTML,/순간격/);
 nodes.ow_support.value='propped';nodes.ow_point.value='10';vm.runInContext('runRCSlabOneWay()',context);
 assert.equal(nodes.ow_error.hidden,true);assert.match(nodes.ow_load.innerHTML,/21.15/);assert.match(nodes.ow_load.innerHTML,/1.4D/);
 nodes.ow_diagram.events.click({target:{closest:()=>({dataset:{face:'temp'}})}});assert.match(nodes.ow_selected.innerHTML,/배력근/);
 nodes.ow_pointX.value='4';vm.runInContext('runRCSlabOneWay()',context);assert.equal(nodes.ow_results.hidden,true);assert.equal(nodes.ow_summary.innerHTML,'');
 nodes.ow_pointX.value='1.5';vm.runInContext('runRCSlabOneWay()',context);assert.equal(nodes.ow_error.hidden,true);assert.match(nodes.ow_suggestions.innerHTML,/상·하부 주철근 공통 간격/);assert.equal(nodes.ow_tempSpacing,undefined);
});

test('two-way slab automatically designs all faces and responds to supports, loads and invalid input',()=>{
 const {nodes}=load();assert.equal(nodes.ts_error.hidden,true);assert.match(nodes.ts_summary.innerHTML,/상·하부 X·Y 모두/);assert.match(nodes.ts_load.innerHTML,/1.4D/);
 for(const [key,value] of Object.entries({fck:'30',fy:'500',h:'150',lx:'3',ly:'3',cover:'20',environment:'other'}))assert.equal(nodes['ts_'+key].value,value);
 const before=nodes.ts_table.innerHTML;nodes.ts_left.value='fixed';nodes.ts_left.events.change();assert.equal(nodes.ts_error.hidden,true);assert.notEqual(nodes.ts_table.innerHTML,before);
 nodes.ts_plot.events.click({target:{closest:()=>({dataset:{slab:'tY'}})}});assert.match(nodes.ts_selection.textContent,/상부 Y/);
 nodes.ts_mode.value='direct';nodes.ts_VX.value='1000';nodes.ts_mode.events.change();assert.equal(nodes.ts_auto.hidden,true);assert.equal(nodes.ts_direct.hidden,false);assert.match(nodes.ts_summary.innerHTML,/전단내력 또는 두께 미달/);
 nodes.ts_MbX.value='';nodes.ts_MbX.events.input();assert.equal(nodes.ts_results.hidden,true);assert.equal(nodes.ts_table.innerHTML,'');assert.equal(nodes.ts_plot.innerHTML,'');
 nodes.ts_mode.value='auto';nodes.ts_mode.events.change();assert.equal(nodes.ts_results.hidden,false);assert.equal(nodes.ts_error.hidden,true);
});

test('seismic UI initializes, responds to changed inputs and clears invalid results',()=>{const {nodes}=load();assert.equal(nodes.eq_error.hidden,true);assert.match(nodes.eq_plot.innerHTML,/설계응답스펙트럼/);assert.match(nodes.eq_axes.innerHTML,/보정 후 동적/);nodes.eq_x_Vt.value='0';nodes.eq_x_Vt.events.input();assert.equal(nodes.eq_results.hidden,true);assert.equal(nodes.eq_summary.innerHTML,'');nodes.eq_correction.value='no';nodes.eq_correction.events.change();assert.equal(nodes.eq_error.hidden,true);assert.match(nodes.eq_summary.innerHTML,/검토 안 함/);nodes.eq_soil.value='S6';nodes.eq_soil.events.change();assert.equal(nodes.eq_results.hidden,true);});

test('wind screens initialize, update, and remove stale results',()=>{
 const {nodes}=load();assert.equal(nodes.wm_error.hidden,true);assert.match(nodes.wm_plot.innerHTML,/<svg/);assert.equal(nodes.wc_error.hidden,true);assert.match(nodes.wc_table.innerHTML,/부압/);
 nodes.wm_xFrequency.value='0.4';nodes.wm_xFrequency.events.input();assert.equal(nodes.wm_flexible.hidden,false);assert.match(nodes.wm_coefficients.innerHTML,/유연/);
 nodes.wm_H.value='';nodes.wm_H.events.input();assert.equal(nodes.wm_results.hidden,true);assert.equal(nodes.wm_summary.innerHTML,'');assert.equal(nodes.wm_plot.innerHTML,'');
 nodes.wm_H.value='30';nodes.wm_H.events.input();assert.equal(nodes.wm_results.hidden,false);
 nodes.wc_H.value='19';nodes.wc_H.events.input();assert.match(nodes.wc_coefficients.innerHTML,/20m 미만 외부마감 보정/);
 nodes.wc_area.value='0';nodes.wc_area.events.input();assert.equal(nodes.wc_results.hidden,true);assert.equal(nodes.wc_table.innerHTML,'');
 nodes.wc_area.value='2';nodes.wc_area.events.input();assert.equal(nodes.wc_results.hidden,false);
});
test('foundation screens offer automatic steel and Ps/Pu only, updating and clearing invalid results',()=>{
 const {nodes:n}=load();
 for(const pre of ['fs','fp']){
  assert.equal(n[pre+'_error'].hidden,true);assert.match(n[pre+'_checks'].innerHTML,/기둥 뚫림/);assert.match(n[pre+'_plot'].innerHTML,/<svg/);
  assert.match(n[pre+'_mainRebar'].innerHTML,/D16@140/);assert.match(n[pre+'_mainRebar'].innerHTML,/X·Y 공통 간격/);
  for(const k of ['Ns','Nu','Mxs','Mys','Mxu','Myu','barX','barY','spacingX','spacingY','weightFactor'])assert.equal(n[pre+'_'+k],undefined);
  assert.match(n[pre+'_basis'].innerHTML,/기둥 사용 축력 Ps/);
  n[pre+'_Pu'].value='5000';n[pre+'_Pu'].events.input();assert.equal(n[pre+'_results'].hidden,false);assert.doesNotMatch(n[pre+'_mainRebar'].innerHTML,/D16@140/);
  n[pre+'_fy'].value='500';n[pre+'_fy'].events.change();assert.equal(n[pre+'_results'].hidden,false);
  n[pre+'_Ps'].value='';n[pre+'_Ps'].events.input();assert.equal(n[pre+'_results'].hidden,true);
  for(const k of ['mainRebar','summary','plot','checks','basis','reinforcement'])assert.equal(n[pre+'_'+k].innerHTML,'');
  n[pre+'_Ps'].value='1500';n[pre+'_Ps'].events.input();assert.equal(n[pre+'_results'].hidden,false);
 }
});

test('pile screen labels and draws actual diagonal spacing and removes obsolete axis fields',()=>{
 const {nodes:n}=load();assert.equal(n.fp_sx,undefined);assert.equal(n.fp_sy,undefined);
 n.fp_pileCount.value='5';n.fp_pileCount.events.input();
 assert.equal(n.fp_minDistance.value,'1250');assert.equal(n.fp_bx.value,'3050');assert.equal(n.fp_by.value,'3050');
 assert.match(n.fp_plot.innerHTML,/대각선 최소 중심거리/);assert.match(n.fp_plot.innerHTML,/파일 3–5: 1,250 mm \(2.5D\)/);
 n.fp_gapFactor.value='3';n.fp_gapFactor.events.input();assert.equal(n.fp_minDistance.value,'1500');assert.match(n.fp_plot.innerHTML,/1,500 mm \(3D\)/);
 n.fp_gapFactor.value='2.5';n.fp_pileCount.value='3';n.fp_pileCount.events.input();assert.equal(n.fp_bx.value,'2500');assert.equal(n.fp_by.value,'2350');assert.match(n.fp_summary.innerHTML,/633.7/);assert.match(n.fp_plot.innerHTML,/기초 중심 이동/);assert.match(n.fp_basis.innerHTML,/21.4/);
 n.fp_pileCount.value='';n.fp_pileCount.events.input();assert.equal(n.fp_minDistance.value,'');assert.equal(n.fp_plot.innerHTML,'');
});

test('foundation auto shear layout is rendered and invalid inputs remove it',()=>{const {nodes:n}=load();for(const [k,v] of Object.entries({bx:4500,by:4500,h:450,Pu:3000}))n['fs_'+k].value=String(v);n.fs_Pu.events.input();assert.match(n.fs_reinforcement.innerHTML,/폐쇄형/);assert.match(n.fs_reinforcement.innerHTML,/보강 외곽/);assert.match(n.fs_plot.innerHTML,/뚫림 전단철근/);n.fs_Pu.value='';n.fs_Pu.events.input();assert.equal(n.fs_reinforcement.innerHTML,'');});
test('new initial calculator pages render results and remove stale invalid output',()=>{const {nodes:n}=load();for(const pre of ['ld','ts','bc','wcj']){assert.equal(n[pre+'_error'].hidden,true,pre);assert.match(n[pre+'_plot'].innerHTML,/<svg/);assert.ok(n[pre+'_table'].innerHTML.length>100);}n.bc_Vu.value='';n.bc_Vu.events.input();assert.equal(n.bc_results.hidden,true);assert.equal(n.bc_plot.innerHTML,'');n.bc_Vu.value='250';n.bc_Vu.events.input();assert.equal(n.bc_results.hidden,false);});

test('load schedule edits layers, duplicates independently and updates shared material values',()=>{
 const {nodes}=load();assert.match(nodes.ld_table.innerHTML,/12\.24/);
 nodes.ld_copy_case.events.click();assert.match(nodes.ld_case.innerHTML,/value="1"/);
 nodes.ld_thickness.value='200';nodes.ld_thickness.events.input();assert.match(nodes.ld_summary.innerHTML,/8\.50/);
 nodes.ld_case.value='0';nodes.ld_case.events.change();assert.equal(nodes.ld_thickness.value,100);assert.match(nodes.ld_summary.innerHTML,/6\.20/);
 nodes.ld_material_value.value='22';nodes.ld_material_value.events.input();assert.match(nodes.ld_table.innerHTML,/6\.10/);assert.match(nodes.ld_table.innerHTML,/8\.30/);
 nodes.ld_layer.value='1';nodes.ld_layer.events.change();assert.equal(nodes.ld_thickness_field.hidden,true);
 nodes.ld_material_value.value='0.4';nodes.ld_material_value.events.input();assert.match(nodes.ld_summary.innerHTML,/6\.40/);
 nodes.ld_live.value='';nodes.ld_live.events.input();assert.equal(nodes.ld_results.hidden,true);assert.equal(nodes.ld_table.innerHTML,'');
 nodes.ld_live.value='0';nodes.ld_live.events.input();assert.equal(nodes.ld_error.hidden,true);assert.match(nodes.ld_summary.innerHTML,/1\.4D/);
});
test('load schedule restores last valid state and escapes project and material text',()=>{
 let saved=null;const store={getItem(){return saved;},setItem(k,v){saved=v;}};
 const {nodes}=load({localStorage:store});nodes.ld_project.value='검토 프로젝트';nodes.ld_project.events.input();
 nodes.ld_use.value='<img src=x onerror=alert(1)>';nodes.ld_use.events.input();assert.doesNotMatch(nodes.ld_table.innerHTML,/<img/);assert.match(nodes.ld_table.innerHTML,/&lt;img/);
 nodes.ld_add_material.events.click();nodes.ld_material_name.value='<script>test</script>';nodes.ld_material_name.events.input();assert.doesNotMatch(nodes.ld_material_table.innerHTML,/<script>/);
 nodes.ld_live.value='7';nodes.ld_live.events.input();const valid=saved;
 nodes.ld_live.value='-1';nodes.ld_live.events.input();assert.equal(saved,valid);
 const next=load({localStorage:store});assert.equal(next.nodes.ld_project.value,'검토 프로젝트');assert.equal(next.nodes.ld_live.value,7);assert.equal(next.nodes.ld_error.hidden,true);
 const corrupt=load({localStorage:{getItem(){return '{';},setItem(){}}});assert.equal(corrupt.nodes.ld_error.hidden,true);assert.match(corrupt.nodes.ld_table.innerHTML,/12\.24/);
});

test('horizontal footing joints initialize, switch foundation modes and clear invalid results',()=>{
 const {nodes}=load();assert.equal(nodes.fj_error.hidden,true);assert.match(nodes.fj_diagram.innerHTML,/<svg/);assert.match(nodes.fj_phases.innerHTML,/2차 타설 중/);
 nodes.fj_mode.value='pile';nodes.fj_mode.events.input();assert.equal(nodes.fj_bx.value,2500);assert.match(nodes.fj_reactions.innerHTML,/계수반력/);
 nodes.fj_mode.value='mat';nodes.fj_mode.events.input();assert.equal(nodes.fj_axial.hidden,true);assert.equal(nodes.fj_wet_inputs.hidden,false);
 nodes.fj_crossLegs.value='0';nodes.fj_crossLegs.events.input();assert.match(nodes.fj_joint_summary.innerHTML,/D16@/);assert.match(nodes.fj_diagram.innerHTML,/추가 다월바 D16/);
 nodes.fj_h.value='';nodes.fj_h.events.input();assert.equal(nodes.fj_results.hidden,true);assert.equal(nodes.fj_diagram.innerHTML,'');assert.equal(nodes.fj_joints.innerHTML,'');
 nodes.fj_h.value='1500';nodes.fj_h.events.input();assert.equal(nodes.fj_results.hidden,false);
});
test('footing-joint manual strengths track each lift and stage without assuming unmeasured values',()=>{
 const {nodes}=load();nodes.fj_strengthMode.value='manual';nodes.fj_strengthMode.events.input();assert.match(nodes.fj_joint_summary.innerHTML,/제안 보류/);
 nodes.fj_fc_0.value='30';nodes.fj_fc_0.events.input();
 nodes.fj_edit.value='1';nodes.fj_edit.events.change();nodes.fj_fc_0.value='30';nodes.fj_fc_0.events.input();nodes.fj_fc_1.value='30';nodes.fj_fc_1.events.input();
 assert.doesNotMatch(nodes.fj_joint_summary.innerHTML,/제안 보류/);assert.equal(nodes.fj_error.hidden,true);
 nodes.fj_fc_1.value='15';nodes.fj_fc_1.events.input();assert.match(nodes.fj_joint_summary.innerHTML,/제안 보류/);
 nodes.fj_strengthMode.value='estimate';nodes.fj_strengthMode.events.input();nodes.fj_count.value='3';nodes.fj_count.events.input();assert.match(nodes.fj_phases.innerHTML,/3차 양생 후/);assert.equal(nodes.fj_height.value,500);
});

test('foundation joint compression control is optional and reports its contribution separately',()=>{
 const {nodes}=load();assert.equal(nodes.fj_compression_field.hidden,true);
 nodes.fj_mode.value='mat';nodes.fj_mode.events.input();nodes.fj_crossLegs.value='0';nodes.fj_crossLegs.events.input();assert.match(nodes.fj_joint_summary.innerHTML,/D16@/);
 nodes.fj_compressionMode.value='manual';nodes.fj_compressionMode.events.input();assert.equal(nodes.fj_compression_field.hidden,false);
 nodes.fj_compression.value='1000';nodes.fj_compression.events.input();assert.match(nodes.fj_joint_summary.innerHTML,/영구 순압축력/);assert.doesNotMatch(nodes.fj_joint_summary.innerHTML,/D16@/);assert.match(nodes.fj_joints.innerHTML,/순압축/);
 nodes.fj_compression.value='-1';nodes.fj_compression.events.input();assert.equal(nodes.fj_results.hidden,true);
 nodes.fj_compressionMode.value='none';nodes.fj_compressionMode.events.input();assert.equal(nodes.fj_results.hidden,false);
 nodes.fj_mode.value='pile';nodes.fj_pileCount.value='3';nodes.fj_mode.events.input();assert.match(nodes.fj_capacity.innerHTML,/4.11.7/);
});
