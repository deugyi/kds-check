import '../_shared/progress-core.js';
import '../_shared/morning-core.js';
const P=(globalThis as any).SiteProgress,M=(globalThis as any).SiteMorning;
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'https://deugyi.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-siteone-kakao-key','Access-Control-Allow-Methods':'POST,OPTIONS'};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
const base=()=>Deno.env.get('SUPABASE_URL')!;
const service=()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
function same(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function skill(text:string){const max=900,parts=[];let rest=text;while(rest&&parts.length<3){let pos=rest.length<=max?rest.length:rest.lastIndexOf('\n',max);if(pos<1)pos=Math.min(rest.length,max);parts.push(rest.slice(0,pos));rest=rest.slice(pos).replace(/^\n/,'');}if(rest)parts[parts.length-1]=parts[parts.length-1].slice(0,790)+'\n나머지 항목은 사이트원에서 확인해 주세요.';
 return response({version:'2.0',template:{outputs:parts.map(text=>({simpleText:{text}})),quickReplies:[{label:'입력 안내',action:'message',messageText:'입력 안내'},{label:'오늘 계획',action:'message',messageText:'오늘 계획'},{label:'회신 안내',action:'message',messageText:'회신 안내'},{label:'사이트원 열기',action:'webLink',webLinkUrl:'https://deugyi.github.io/kds-check/'}]}});}
export async function handler(req:Request){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 const deadline=Date.now()+4300;
 const signal=()=>AbortSignal.timeout(Math.max(1,deadline-Date.now()));
 async function rpc(name:string,args:unknown={},bearer=service()){
  const r=await fetch(base()+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service(),Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify(args),signal:signal()});
  const data=await r.json();if(!r.ok)throw Error(data.message||'DATABASE_ERROR');return data;
 }
 try{
  if(Number(req.headers.get('Content-Length')||0)>65536)return response({error:'TOO_LARGE'},413);
  const rawBody=await req.text();if(rawBody.length>65536)return response({error:'TOO_LARGE'},413);
  let data:any;try{data=JSON.parse(rawBody);}catch{return response({error:'INVALID_JSON'},400);}
  if(data?.action==='status'){
   const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return response({error:'ADMIN_REQUIRED'},403);
   const u=await fetch(base()+'/auth/v1/user',{headers:{apikey:service(),Authorization:auth},signal:signal()});
   if(!u.ok||await rpc('site_role',{},auth.slice(7))!=='admin')return response({error:'ADMIN_REQUIRED'},403);
   const c=await rpc('site_progress_kakao_config');return response({configured:!!(c.enabled&&c.bot_id&&c.key),enabled:c.enabled,last_received:c.last_received,skill_url:base()+'/functions/v1/site-kakao-bot'});
  }
  const config=await rpc('site_progress_kakao_config');
  if(!same(req.headers.get('x-siteone-kakao-key')||'',config.key||''))return response({error:'UNAUTHORIZED'},401);
  if(!config.enabled||!config.bot_id)return response({error:'KAKAO_NOT_CONFIGURED'},409);
  const u=data?.userRequest?.user,text=data?.userRequest?.utterance,bot=data?.bot?.id;
  if(bot!==config.bot_id||typeof text!=='string'||text.length>12000)
   return response({error:'INVALID_KAKAO_REQUEST'},400);
  // Builder simulator calls are authenticated diagnostics, never supplier registrations or results.
  if(data.userRequest.params?.surface==='BuilderBotTest'||data.userRequest.params?.ignoreMe===true||data.userRequest.params?.ignoreMe==='true')
   return skill('사이트원 접수 서버가 응답했습니다. 관리자센터 테스트 화면에서는 업체 연결이나 실적을 저장하지 않습니다. 채널 연결·배포 후 실제 담당자 계정에서 연결 코드를 전송해 주세요.');
  if(u?.type!=='botUserKey'||typeof u.id!=='string'||!u.id||u.id.length>70||/[\u0000-\u001f]/.test(u.id))
   return response({error:'INVALID_KAKAO_REQUEST'},400);
  const raw=text.trim();let payload:any;
  const link=/^(?:연결|업체연결)\s+([a-f0-9]{48})$/i.exec(raw);
  const query=/^(오늘\s*계획|계획\s*조회|회신\s*안내)(?:\s+(\d{4}-\d{2}-\d{2}))?$/.exec(raw);
  try{
   if(link)payload={type:'link',token:link[1].toLowerCase()};
   else if(['입력 안내','입력안내','도움말','시작','/help'].includes(raw))payload={type:'help'};
   else if(query){const day=query[2]||P.today();if(!P.validDate(day)||day>P.today())throw Error('조회 날짜를 확인해 주세요.');payload={type:/회신/.test(query[1])?'feedback_help':'status',work_date:day};}
   else if(/^(?:\/)?작업결과(?:수정)?\s*\n/.test(raw))payload={type:'feedback',feedback:M.parseFeedback(raw)};
   else if(/업체명\s*:/.test(raw)&&/(?:작업내용|작업계획)/.test(raw))payload={type:'plan',document:M.parseMorning(raw)};
   else payload={type:'report',report:P.parseTelegram(raw)};
  }catch(e){return skill((e as Error).message+'\n\n'+M.help());}
  const fingerprint=await hash(bot+'\0'+u.id+'\0'+JSON.stringify(payload)+'\0'+raw);
  const requestId=req.headers.get('x-request-id');
  const key=requestId&&requestId.length<=200?await hash(bot+'\0'+u.id+'\0request\0'+requestId):fingerprint;
  const result=await rpc('site_progress_kakao_receive',{bot,user_key:u.id,event_key:key,request_hash:fingerprint,payload,raw});
  return skill(result.reply);
 }catch(e){
  if((e as Error).name==='TimeoutError'||Date.now()>=deadline)return skill('처리에 시간이 걸리고 있습니다. 같은 메시지를 다시 보내거나 사이트원에서 접수 여부를 확인해 주세요. 중복 접수는 방지합니다.');
  // Never log credentials, sender keys, message bodies or upstream database errors.
  return response({error:'REQUEST_FAILED'},500);
 }
}
if(typeof Deno!=='undefined')Deno.serve(handler);
