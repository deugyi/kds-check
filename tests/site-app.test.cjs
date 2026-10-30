const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{parseHTML}=require('linkedom');
const {render}=require('../scripts/build-site-apps.cjs'),root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,fs.existsSync(path.join(root,'app-template.html'))?'app-template.html':'index.html'),'utf8');
const tick=()=>new Promise(r=>setImmediate(r)),key='siteone-app-login-return';
async function harness(site=null,{store=new Map(),role=null,oauthError=false}={}){
 const {window,document}=parseHTML(site?render(source,site):source),redirects=[],opened=[],events=[],oauth=[],timers=[];
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const o=[...this.options].find(o=>o.hasAttribute('selected'))||this.options[0];return o?(o.getAttribute('value')??o.textContent):'';},set(v){for(const o of this.options)o.toggleAttribute('selected',(o.getAttribute('value')??o.textContent)===v);}});
 window.HTMLElement.prototype.focus=function(){};
 document.addEventListener('site-auth-change',()=>events.push('auth-change'));
 let current=role;
 const client={auth:{getUser:async()=>({data:{user:current?{id:'sample-user',email:'example@example.test'}:null}}),onAuthStateChange(){},signInWithOAuth:async opts=>{oauth.push(opts);return {error:oauthError?Error('test-oauth-failure'):null};},signOut:async()=>{current=null;return {};}},rpc:async name=>({data:name==='site_register'?{role:current}:[]})};
 const context=vm.createContext({document,window,console,URL,Date,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},location:{origin:'https://deugyi.github.io',replace:url=>redirects.push(url)},SITE_CONFIG:{url:'https://example.supabase.co',key:'public-example',redirect:'https://deugyi.github.io/kds-check/',planFloors:[]},supabase:{createClient:()=>client},CustomEvent:window.CustomEvent,setInterval(){},setTimeout:f=>timers.push(f),confirm:()=>true,scrollTo(){},closeMenus(){},PRDCloudUI:{beforeTradeChange:async()=>true,onFullscreenChange(){},hasUnsaved:()=>false},SitePlanUI:{beforeTradeChange:async()=>true,isReady:()=>true,hasUnsaved:()=>false},SiteOverviewUI:{activate:p=>opened.push(p.id)}});
 for(const file of ['site-app.js','site-auth.js','site-workspace.js','home.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 await tick();await tick();
 return {context,document,window,store,redirects,events,oauth,opened,active:()=>[...document.querySelectorAll('section.tab.on')].map(e=>e.id),async login(){document.querySelector((site==='north'?'#site-north-prd':site==='south'?'#site-prd':'.site-page')+' [data-site-login]').click();await tick();},async role(next){current=next;await context.SiteCloud.refresh();}};
}

test('generated entrances retain their own URL and resolve local assets to shared files',()=>{
 for(const site of ['south','north']){
  const html=render(source,site),base=new URL('./',`https://deugyi.github.io/siteone-${site}/`);
  const target=path.join(root,'app-target.json');if(fs.existsSync(target)&&JSON.parse(fs.readFileSync(target,'utf8')).site===site)assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n'),html);
  assert.match(html,new RegExp(`<html lang="ko" data-site-app="${site}">`));assert.equal((html.match(/<base /g)||[]).length,1);assert.doesNotMatch(html,/<iframe|http-equiv="refresh"/i);
  for(const [,file] of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"\n]*)?"/g)){
   if(/^(?:https?:|data:|\/)/.test(file)||file.endsWith('/'))continue;
   const url=new URL(file,base);assert.ok(url.pathname.startsWith(`/siteone-${site}/`));assert.ok(fs.existsSync(path.join(root,file)),file);
  }
 }
});

test('north omits south drawing and progress-intake controllers',()=>{
 const north=render(source,'north');for(const file of ['prd-ui.js','site-plan-ui.js','site-reports-ui.js','site-progress-ui.js','site-morning-ui.js'])assert.ok(!north.includes(`<script src="${file}?`));
 const south=render(source,'south');for(const file of ['prd-ui.js','site-plan-ui.js','site-reports-ui.js'])assert.ok(south.includes(`<script src="${file}?`));
 assert.match(north,/북측 PRD 도면을 준비 중입니다/);
});

test('each app starts at its own workspace and rejects navigation to another site or calculator',async()=>{
 for(const [site,page] of [['south','site-prd'],['north','site-north-prd']]){
  const h=await harness(site);assert.deepEqual(h.active(),[page]);assert.equal(h.document.querySelectorAll('.site-access').length,site==='south'?2:1);assert.ok(h.document.title.includes(site==='south'?'남측':'북측'));
  for(const target of ['home','t9','site-progress','site-prd','site-north-prd','site-steel']){await h.context.openKDSPage(target);assert.deepEqual(h.active(),[site==='south'&&target==='site-progress'?'site-progress':page]);}
  assert.equal(h.context.SiteCloud.allowed(),false);assert.match(h.document.querySelector('.site-auth-message').textContent,/승인된 계정/);
 }
});

test('legacy root retains calculator and both-site navigation',async()=>{
 const h=await harness();assert.equal(h.context.SiteApp.site,null);assert.deepEqual(h.active(),['home']);assert.equal(h.document.querySelectorAll('.site-access').length,3);
 for(const target of ['t9','site-north-prd','site-prd','home']){await h.context.openKDSPage(target);assert.deepEqual(h.active(),[target]);}
});

test('OAuth uses the existing allowed callback and returns to the originating dedicated URL after session restoration',async()=>{
 for(const site of ['south','north']){
  const store=new Map(),h=await harness(site,{store});await h.login();assert.equal(h.oauth.length,1);assert.equal(h.oauth[0].options.redirectTo,'https://deugyi.github.io/kds-check/');assert.equal(JSON.parse(store.get(key)).site,site);
  const returned=await harness(null,{store,role:'viewer'});assert.deepEqual(returned.redirects,[`https://deugyi.github.io/siteone-${site}/`]);assert.equal(store.has(key),false);assert.deepEqual(returned.events,[],'do not notify root south drawing loaders during a north callback');
  const landed=await harness(site,{store,role:'viewer'});assert.equal(landed.context.SiteCloud.allowed(),true);assert.deepEqual(landed.active(),[site==='south'?'site-prd':'site-north-prd']);assert.deepEqual(landed.redirects,[]);
 }
});

test('dedicated app ignores another tab workspace return target and logout preserves access checks',async()=>{
 const store=new Map([['kds-site-return','site-prd']]),h=await harness('north',{store,role:'viewer'});
 assert.deepEqual(h.active(),['site-north-prd']);await h.role('pending');assert.equal(h.context.SiteCloud.allowed(),false);assert.match(h.document.querySelector('.site-auth-message').textContent,/관리자 승인/);
 await h.role('viewer');h.document.querySelector('[data-site-logout]').click();await tick();assert.equal(h.context.SiteCloud.allowed(),false);assert.deepEqual(h.active(),['site-north-prd']);
});

test('return state is one-shot, time limited and cannot redirect to an external or unexpected URL',async()=>{
 for(const saved of [{site:'https://external.test/',at:Date.now()},{site:'__proto__',at:Date.now()},{site:'south',at:Date.now()-16*60000},{site:'north',at:Date.now()+60000},{site:'north',at:'now'},'bad json']){
  const h=await harness(null,{store:new Map([[key,typeof saved==='string'?saved:JSON.stringify(saved)]])});assert.deepEqual(h.redirects,[]);assert.equal(h.store.has(key),false);
 }
 const h=await harness('south',{oauthError:true});await h.login();assert.equal(h.store.has(key),false);assert.match(h.document.querySelector('.site-auth-message').textContent,/서버 연결/);
});
