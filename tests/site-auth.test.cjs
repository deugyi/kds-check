const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const tick=()=>new Promise(r=>setImmediate(r));
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
async function load(role=null){
 let current=role,offline=false,onAuth,created,oauth,signout=0;const opened=[],events=[],timers=[],store=new Map(),calls=[];
 const make=()=>({hidden:false,textContent:'',innerHTML:'',events:{},dataset:{},addEventListener(k,f){this.events[k]=f;}});
 const panels=[],pages=[...html.matchAll(/<section class="tab site-page" id="([^"]+)" data-site-title="([^"]+)"/g)].map(([,id,siteTitle])=>({id,dataset:{siteTitle},prepend(panel){this.panel=panel;panels.push(panel);},querySelector(){return this.panel;}}));
 const classes=new Set(),body={classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)}};
 const client={auth:{getUser:async()=>{if(offline)return {data:{user:null},error:Error('offline')};return {data:{user:current?{id:'user-1',email:'test@example.test'}:null},error:null};},onAuthStateChange:f=>onAuth=f,signInWithOAuth:async opts=>{oauth=opts;return {};},signOut:async()=>{current=null;signout++;return {};}},rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='site_register'?{user_id:'user-1',email:'test@example.test',role:current}:{version:2},error:null};},from:name=>{
 const chain={select(){return this;},eq(){return this;},order(){return this;},range(){return Promise.resolve({data:[],error:null});},single(){return Promise.resolve({data:{document:{id:'a'.repeat(64)}},error:null});},then(resolve){return Promise.resolve({data:[{user_id:'evil',email:'<img src=x onerror=alert(1)>',role:'pending'}],error:null}).then(resolve);}};return chain;
 }};
 const context=vm.createContext({console,openKDSPage:id=>opened.push(id),SITE_CONFIG:{url:'https://example.supabase.co',key:'public-key',redirect:'https://example.test/app/',drawing:'a'.repeat(64)},supabase:{createClient:(...args)=>{created=args;return client;}},sessionStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k),removeItem:k=>store.delete(k)},confirm:()=>true,setInterval(){},setTimeout:f=>timers.push(f),CustomEvent:class{constructor(type){this.type=type;}},document:{body,querySelectorAll:()=>pages,querySelector:()=>null,createElementNS(){},createElement(){const p=make(),parts=new Map();p.querySelector=s=>{if(!parts.has(s))parts.set(s,make());return parts.get(s);};return p;},addEventListener(){},dispatchEvent:e=>events.push(e.type)}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../site-auth.js'),'utf8'),context);await tick();
 async function click(attribute,panel=panels[0]){const b={hasAttribute:a=>a===attribute,dataset:{}};await panel.events.click({target:{closest:()=>b}});await tick();}
 return {context,panels,pages,store,opened,classes,events,calls,click,get created(){return created;},get oauth(){return oauth;},get signout(){return signout;},async change(next){current=next;await context.SiteCloud.refresh();},async disconnect(){offline=true;await context.SiteCloud.refresh();}};
}
test('anonymous calculator session is public; site controls are locked and PKCE is configured',async()=>{
 const h=await load();assert.equal(h.context.SiteCloud.allowed(),false);assert.equal(h.classes.has('site-authorized'),false);assert.equal(h.created[2].auth.flowType,'pkce');
 await assert.rejects(()=>h.context.SiteCloud.load(),/ACCESS_REQUIRED/);assert.equal(h.calls.length,0);
 await h.click('data-site-login');assert.equal(h.oauth.provider,'google');assert.equal(h.oauth.options.redirectTo,'https://example.test/app/');
});
test('pending and blocked remain locked; viewer can read but cannot save',async()=>{
 const h=await load('pending');assert.equal(h.context.SiteCloud.allowed(),false);assert.match(h.panels[0].querySelector('.site-auth-message').textContent,/관리자 승인/);
 await h.change('blocked');assert.equal(h.classes.has('site-authorized'),false);
 await h.change('viewer');assert.equal(h.classes.has('site-authorized'),true);assert.equal(h.context.SiteCloud.canEdit(),false);await assert.rejects(()=>h.context.SiteCloud.save('a',{},0),/ACCESS_REQUIRED/);
});
test('admin panel escapes member text; editor cannot see the account list',async()=>{
 const h=await load('admin');await h.click('data-site-users');const list=h.panels[0].querySelector('.site-member-list');assert.match(list.innerHTML,/&lt;img/);assert.doesNotMatch(list.innerHTML,/<img/);
 await h.change('editor');assert.equal(list.innerHTML,'');assert.equal(h.panels[0].querySelector('.site-admin').hidden,true);assert.equal(h.context.SiteCloud.canEdit(),true);
});
test('permission check failure closes site access; logout emits a state change',async()=>{
 const h=await load('editor');await h.disconnect();assert.equal(h.context.SiteCloud.allowed(),false);assert.equal(h.classes.has('site-authorized'),false);assert.match(h.panels[0].querySelector('.site-auth-message').textContent,/서버 연결/);
 const g=await load('admin');await g.click('data-site-logout');assert.equal(g.signout,1);assert.equal(g.context.SiteCloud.allowed(),false);assert.equal(g.events.at(-1),'site-auth-change');
});

test('south and north menus and home cards share the same order and all six pages are gated',async()=>{
 const h=await load();
 const expected=['site-prd','site-steel','site-slab','site-north-prd','site-north-steel','site-north-slab'];
 assert.deepEqual(h.pages.map(p=>p.id),expected);
 assert.deepEqual([...html.matchAll(/data-t="(site-[^"]+)"/g)].map(m=>m[1]),expected);
 assert.deepEqual([...html.matchAll(/data-open="(site-[^"]+)"/g)].map(m=>m[1]),expected);
 for(const [i,page] of h.pages.entries()){
  assert.equal(h.panels[i].querySelector('h2').textContent,i<3?'서리풀 : 남측':'서리풀 : 북측');
  assert.equal(h.panels[i].querySelector('[data-site-login]').hidden,false);
  const section=html.match(new RegExp('<section[^>]+id="'+page.id+'"[^>]*>([\\s\\S]*?)</section>'))[1];
  assert.ok(section.startsWith('<div class="site-content">'));
 }
 assert.match(fs.readFileSync(path.join(__dirname,'../site-auth.css'),'utf8'),/body:not\(\.site-authorized\) \.site-content\{display:none!important\}/);
});
test('each north login restores its own page; pending remains denied and logout locks both sides',async()=>{
 const h=await load();
 for(let i=3;i<6;i++){
  await h.click('data-site-login',h.panels[i]);
  assert.equal(h.store.get('kds-site-return'),h.pages[i].id);
  await h.change('pending');
  assert.equal(h.opened.at(-1),h.pages[i].id);
  assert.equal(h.context.SiteCloud.allowed(),false);
  await h.change(null);
 }
 await h.change('viewer');
 for(const panel of h.panels)assert.equal(panel.querySelector('[data-site-login]').hidden,true);
 await h.click('data-site-logout',h.panels[3]);
 assert.equal(h.classes.has('site-authorized'),false);
 for(const panel of h.panels)assert.equal(panel.querySelector('[data-site-login]').hidden,false);
});
