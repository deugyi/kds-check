const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const tick=()=>new Promise(r=>setImmediate(r));
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
async function load(role=null,config={}){
 let current=role,offline=false,onAuth,created,oauth,signout=0,registerWait=null;const opened=[],events=[],timers=[],store=new Map(),calls=[],queries=[];
 const make=()=>({hidden:false,textContent:'',innerHTML:'',events:{},dataset:{},addEventListener(k,f){this.events[k]=f;}});
 const panels=[],pages=[...html.matchAll(/<section class="tab site-page" id="([^"]+)" data-site-title="([^"]+)"/g)].map(([,id,siteTitle])=>({id,dataset:{siteTitle},prepend(panel){this.panel=panel;panels.push(panel);},querySelector(){return this.panel;}}));
 const classes=new Set(),body={classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)}};
 const client={auth:{getUser:async()=>{if(offline)return {data:{user:null},error:Error('offline')};return {data:{user:current?{id:'user-1',email:'test@example.test'}:null},error:null};},onAuthStateChange:f=>onAuth=f,signInWithOAuth:async opts=>{oauth=opts;return {};},signOut:async()=>{current=null;signout++;return {};}},rpc:async(name,args)=>{calls.push([name,args]);if(name==='site_register'&&registerWait)await registerWait;return {data:name==='site_register'?{user_id:'user-1',email:'test@example.test',role:current}:{version:2},error:null};},from:name=>{
 const chain={select(){return this;},eq(key,value){queries.push([name,key,value]);return this;},order(){return this;},range(){return Promise.resolve({data:[],error:null});},single(){return Promise.resolve({data:{document:{id:'a'.repeat(64)}},error:null});},then(resolve){return Promise.resolve({data:[{user_id:'evil',email:'<img src=x onerror=alert(1)>',role:'pending'}],error:null}).then(resolve);}};return chain;
 }};
 const context=vm.createContext({console,openKDSPage:id=>opened.push(id),SITE_CONFIG:{url:'https://example.supabase.co',key:'public-key',redirect:'https://example.test/app/',drawing:'a'.repeat(64),...config},supabase:{createClient:(...args)=>{created=args;return client;}},sessionStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k),removeItem:k=>store.delete(k)},confirm:()=>true,setInterval(){},setTimeout:f=>timers.push(f),CustomEvent:class{constructor(type){this.type=type;}},document:{body,querySelectorAll:()=>pages,querySelector:()=>null,createElementNS(){},createElement(){const p=make(),parts=new Map();p.querySelector=s=>{if(!parts.has(s))parts.set(s,make());return parts.get(s);};return p;},addEventListener(){},dispatchEvent:e=>events.push(e.type)}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../site-auth.js'),'utf8'),context);await tick();
 async function click(attribute,panel=panels[0]){const b={hasAttribute:a=>a===attribute,dataset:{}};await panel.events.click({target:{closest:()=>b}});await tick();}
 return {context,panels,pages,store,opened,classes,events,calls,queries,click,holdRegistration(){let release;registerWait=new Promise(r=>release=r);return ()=>{registerWait=null;release();};},get created(){return created;},get oauth(){return oauth;},get signout(){return signout;},async change(next){current=next;await context.SiteCloud.refresh();},async disconnect(){offline=true;await context.SiteCloud.refresh();}};
}

test('floor reads and writes target the selected drawing and reject an unconfigured floor',async()=>{
 const b1='b'.repeat(64),b2='c'.repeat(64),h=await load('admin',{planDrawing:b1,planFloors:[{id:'B1',drawing:b1},{id:'B2',drawing:b2}]});
 await h.context.SiteCloud.loadPlan(b2);
 assert.deepEqual(h.queries.filter(([table])=>table==='site_drawings'),[['site_drawings','id',b2]]);
 for(const table of ['site_trade_records','site_member_visibility','site_slab_regions'])assert.ok(h.queries.some(q=>q[0]===table&&q[1]==='drawing_id'&&q[2]===b2));
 await h.context.SiteCloud.saveTrade('steel','B2-member',{label:'',spec:'',delivered:'',completed:'2026-10-03',note:''},0,b2);
 assert.equal(h.calls.at(-1)[1].drawing,b2);
 await h.context.SiteCloud.setMemberHidden('B2-member',true,0,b2);assert.equal(h.calls.at(-1)[1].drawing,b2);
 await h.context.SiteCloud.saveSlabRegion('panel',{points:[[0,0],[1000,0],[1000,1000]],holes:[]},false,2,b2);assert.equal(h.calls.at(-1)[0],'site_save_slab_region');assert.equal(h.calls.at(-1)[1].drawing,b2);assert.equal(h.calls.at(-1)[1].expected_version,2);
 await h.context.SiteCloud.saveSlabRegions([{item_key:'panel',geometry:{},hidden:false,expected_version:2}],{panel:2},b2);assert.equal(h.calls.at(-1)[0],'site_save_slab_regions');assert.equal(h.calls.at(-1)[1].drawing,b2);assert.equal(h.calls.at(-1)[1].expected_state.panel,2);
 await h.context.SiteCloud.planState();assert.ok(h.queries.some(q=>q[1]==='drawing_id'&&q[2]===b1));
 const reads=h.queries.length,writes=h.calls.length;
 await assert.rejects(()=>h.context.SiteCloud.loadPlan('unconfigured'),/UNKNOWN_FLOOR/);
 await assert.rejects(()=>h.context.SiteCloud.saveTrade('steel','member',{label:'',spec:'',note:''},0,'unconfigured'),/UNKNOWN_FLOOR/);
 await assert.rejects(()=>h.context.SiteCloud.saveSlabRegion('panel',{},false,0,'unconfigured'),/UNKNOWN_FLOOR/);
 await assert.rejects(()=>h.context.SiteCloud.saveSlabRegions([],{},'unconfigured'),/UNKNOWN_FLOOR/);
 assert.equal(h.queries.length,reads);assert.equal(h.calls.length,writes);
});

test('same-account role refresh does not interrupt drawing loading; a revoked role closes access on completion',async()=>{
 const h=await load('admin'),release=h.holdRegistration();
 const refresh=h.context.SiteCloud.refresh();await tick();
 assert.equal(h.context.SiteCloud.allowed(),true);
 await assert.doesNotReject(()=>h.context.SiteCloud.load());
 release();await refresh;
 await h.change('blocked');
 await assert.rejects(()=>h.context.SiteCloud.load(),/ACCESS_REQUIRED/);
});
test('anonymous calculator session is public; site controls are locked and PKCE is configured',async()=>{
 const h=await load();assert.equal(h.context.SiteCloud.allowed(),false);assert.equal(h.classes.has('site-authorized'),false);assert.equal(h.created[2].auth.flowType,'pkce');
 await assert.rejects(()=>h.context.SiteCloud.load(),/ACCESS_REQUIRED/);assert.equal(h.calls.length,0);
 await h.click('data-site-login');assert.equal(h.oauth.provider,'google');assert.equal(h.oauth.options.redirectTo,'https://example.test/app/');
});
test('pending and blocked remain locked; ordinary user can read but cannot save PRD',async()=>{
 const h=await load('pending');assert.equal(h.context.SiteCloud.allowed(),false);assert.match(h.panels[0].querySelector('.site-auth-message').textContent,/관리자 승인/);
 await h.change('blocked');assert.equal(h.classes.has('site-authorized'),false);
 await h.change('viewer');assert.equal(h.classes.has('site-authorized'),true);assert.equal(h.context.SiteCloud.canEdit(),false);await assert.rejects(()=>h.context.SiteCloud.save('a',{},0),/ACCESS_REQUIRED/);
});

test('PRD specification saves send the three values atomically; legacy date imports keep their existing RPC',async()=>{
 const h=await load('editor'),specifications={diameter:1200,column_spec:'BH-650',insert_spec:'H-400'};
 await h.context.SiteCloud.save('pile',{note:'memo',drilled:'2026-09-09',specifications},3);
 assert.equal(h.calls.at(-1)[0],'site_save_prd_details');assert.deepEqual(h.calls.at(-1)[1].specification,specifications);assert.equal(h.calls.at(-1)[1].expected_version,3);assert.equal(h.calls.at(-1)[1].drilled_date,'2026-09-09');
 await h.context.SiteCloud.save('legacy',{note:'memo'},0);assert.equal(h.calls.at(-1)[0],'site_save_prd');assert.equal(h.calls.at(-1)[1].specification,undefined);
});

test('approved ordinary user may save steel and slab dates, while unapproved accounts remain denied',async()=>{
 const h=await load('viewer');assert.equal(h.context.SiteCloud.canEditTrade(),true);assert.equal(h.context.SiteCloud.canEdit(),false);
 const value={label:'B-1',spec:'H',delivered:'',completed:'2026-10-02',note:'memo'};
 await h.context.SiteCloud.saveTrade('steel','item',value,3);assert.equal(h.calls.at(-1)[0],'site_save_steel_components');assert.equal(h.calls.at(-1)[1].installation_done,true);assert.equal(h.calls.at(-1)[1].expected_version,3);
 await h.context.SiteCloud.saveTrade('steel','item',{...value,completed:'',installation_complete:true},4);assert.equal(h.calls.at(-1)[1].installation_done,true);assert.equal(h.calls.at(-1)[1].completed_date,null);assert.equal(h.calls.at(-1)[1].member_spec,'H');assert.equal(h.calls.at(-1)[1].reinforcing_spec,'');
 await h.context.SiteCloud.saveTrade('steel','item',{...value,reinforcement_spec:'CT300 · SM355'},5);assert.equal(h.calls.at(-1)[1].reinforcing_spec,'CT300 · SM355');assert.equal(h.calls.at(-1)[1].member_spec,'H');
 await h.context.SiteCloud.saveTrade('steel','item',{...value,completed:'',installation_complete:false},5);assert.equal(h.calls.at(-1)[1].installation_done,false);
 await h.context.SiteCloud.saveTrade('slab','item',{...value,slab_kind:'deck',decked:'2026-09-29',reinforced:'2026-10-01'},3);
 assert.equal(h.calls.at(-1)[0],'site_save_slab_progress');assert.deepEqual(JSON.parse(JSON.stringify(h.calls.at(-1)[1])),{item:'item',expected_version:3,member_label:'B-1',member_spec:'H',slab_type:'deck',deck_date:'2026-09-29',rebar_date:'2026-10-01',cast_date:'2026-10-02',memo:'memo',rebar_in_progress:false});
 await h.context.SiteCloud.saveTrade('slab','item',{...value,slab_kind:'deck',completed:'',reinforcement_in_progress:true},4);assert.equal(h.calls.at(-1)[1].rebar_in_progress,true);assert.equal(h.calls.at(-1)[1].rebar_date,null);assert.equal(h.calls.at(-1)[1].cast_date,null);
 await h.context.SiteCloud.saveSlabRegion('panel',{},false,0);assert.equal(h.calls.at(-1)[0],'site_save_slab_region');
 for(const role of ['pending','blocked',null]){await h.change(role);assert.equal(h.context.SiteCloud.canEditTrade(),false);await assert.rejects(()=>h.context.SiteCloud.saveTrade('steel','item',value,3),/ACCESS_REQUIRED/);await assert.rejects(()=>h.context.SiteCloud.saveSlabRegion('panel',{},false,0),/ACCESS_REQUIRED/);await assert.rejects(()=>h.context.SiteCloud.planSlabRegions(),/ACCESS_REQUIRED/);}
});
test('admin panel escapes member text; editor cannot see the account list',async()=>{
 const h=await load('admin');await h.click('data-site-users');const list=h.panels[0].querySelector('.site-member-list');assert.match(list.innerHTML,/&lt;img/);assert.doesNotMatch(list.innerHTML,/<img/);
 await h.change('editor');assert.equal(list.innerHTML,'');assert.equal(h.panels[0].querySelector('.site-admin').hidden,true);assert.equal(h.context.SiteCloud.canEdit(),true);
});

test('member hiding is administrator-only and calls the versioned server action',async()=>{
 const h=await load('editor');assert.equal(h.context.SiteCloud.isAdmin(),false);await assert.rejects(()=>h.context.SiteCloud.setMemberHidden('beam',true,0),/ADMIN_REQUIRED/);assert.equal(h.calls.some(([name])=>name==='site_set_member_visibility'),false);
 await h.change('admin');assert.equal(h.context.SiteCloud.isAdmin(),true);await h.context.SiteCloud.setMemberHidden('beam',true,7);assert.equal(h.calls.at(-1)[0],'site_set_member_visibility');assert.equal(h.calls.at(-1)[1].expected_version,7);assert.equal(h.calls.at(-1)[1].hide_member,true);await h.context.SiteCloud.planState();
 await h.change('viewer');await assert.rejects(()=>h.context.SiteCloud.setMemberHidden('beam',false,8),/ADMIN_REQUIRED/);
});
test('permission check failure closes site access; logout emits a state change',async()=>{
 const h=await load('editor');await h.disconnect();assert.equal(h.context.SiteCloud.allowed(),false);assert.equal(h.classes.has('site-authorized'),false);assert.match(h.panels[0].querySelector('.site-auth-message').textContent,/서버 연결/);
 const g=await load('admin');await g.click('data-site-logout');assert.equal(g.signout,1);assert.equal(g.context.SiteCloud.allowed(),false);assert.equal(g.events.at(-1),'site-auth-change');
});

test('south and north unified workspaces gate the overview and four trade panes',async()=>{
 const h=await load();
 const expected=['site-prd','site-north-prd'];
 assert.deepEqual(h.pages.map(p=>p.id),expected);
 assert.deepEqual([...html.matchAll(/data-t="(site-[^"]+)"/g)].map(m=>m[1]),expected);
 assert.deepEqual([...html.matchAll(/data-open="(site-[^"]+)"/g)].map(m=>m[1]),expected);
 for(const [i,page] of h.pages.entries()){
  assert.equal(h.panels[i].querySelector('h2').textContent,i===0?'서리풀 : 남측':'서리풀 : 북측');
  assert.equal(h.panels[i].querySelector('[data-site-login]').hidden,false);
  const section=html.match(new RegExp('<section[^>]+id="'+page.id+'"[^>]*>([\\s\\S]*?)</section>'))[1];
  assert.ok(section.startsWith('<div class="site-content">'));
  assert.deepEqual([...section.matchAll(/class="site-trade-pane" data-trade="([^"]+)"/g)].map(m=>m[1]),['overview','prd','steel','slab','curtainwall']);
 }
 assert.match(fs.readFileSync(path.join(__dirname,'../site-auth.css'),'utf8'),/body:not\(\.site-authorized\) \.site-content\{display:none!important\}/);
});
test('each site login restores its workspace; pending remains denied and logout locks both sides',async()=>{
 const h=await load();
 for(let i=0;i<2;i++){
  await h.click('data-site-login',h.panels[i]);
  assert.equal(h.store.get('kds-site-return'),h.pages[i].id);
  await h.change('pending');
  assert.equal(h.opened.at(-1),h.pages[i].id);
  assert.equal(h.context.SiteCloud.allowed(),false);
  await h.change(null);
 }
 await h.change('viewer');
 for(const panel of h.panels)assert.equal(panel.querySelector('[data-site-login]').hidden,true);
 await h.click('data-site-logout',h.panels[1]);
 assert.equal(h.classes.has('site-authorized'),false);
 for(const panel of h.panels)assert.equal(panel.querySelector('[data-site-login]').hidden,false);
});
