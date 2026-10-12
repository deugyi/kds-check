import '../_shared/progress-core.js';
const P=(globalThis as any).SiteProgress;
const origin='https://deugyi.github.io';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const answer=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
const url=()=>Deno.env.get('SUPABASE_URL')!;
const service=()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rpc(name:string,args:unknown={},key=service(),bearer=key){const r=await fetch(url()+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify(args)});const data=await r.json();if(!r.ok)throw Error(data.message||'DATABASE_ERROR');return data;}
async function telegram(token:string,method:string,data:unknown){const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});const value=await r.json();if(!r.ok||!value.ok)throw Error('TELEGRAM_REQUEST_FAILED');return value.result;}
function safeEqual(a:string,b:string){if(!a||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
async function admin(req:Request){const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))throw Error('ADMIN_REQUIRED');
 const r=await fetch(url()+'/auth/v1/user',{headers:{apikey:service(),Authorization:auth}});if(!r.ok)throw Error('ADMIN_REQUIRED');
 const role=await rpc('site_role',{},service(),auth.slice(7));if(role!=='admin')throw Error('ADMIN_REQUIRED');}
async function dispatch(config:Record<string,string>){const queue=await rpc('site_progress_bot_claim');let sent=0,failed=0;
 for(const m of queue){try{await telegram(config.site_progress_bot_token,'sendMessage',{chat_id:m.chat_id,text:m.message+'\nhttps://deugyi.github.io/kds-check/'});await rpc('site_progress_bot_delivery',{message_id:m.id,success:true,error_text:''});sent++;}
 catch{await rpc('site_progress_bot_delivery',{message_id:m.id,success:false,error_text:'텔레그램 전송에 실패했습니다. 연결 상태를 확인해 주세요.'});failed++;}}
 return {sent,failed};}
export async function handler(req:Request){if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return answer({error:'METHOD_NOT_ALLOWED'},405);
 try{if(Number(req.headers.get('Content-Length')||0)>20000)return answer({error:'TOO_LARGE'},413);const raw=await req.text();if(raw.length>20000)return answer({error:'TOO_LARGE'},413);
 const data=JSON.parse(raw),config=await rpc('site_progress_bot_config');
 if(data.action==='configure'){
  await admin(req);const token=String(data.token||'').trim();if(!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token))return answer({error:'BOT_TOKEN_INVALID'},400);
  const bot=await telegram(token,'getMe',{});if(!bot.is_bot)return answer({error:'BOT_TOKEN_INVALID'},400);
  if(config.site_progress_bot_username&&config.site_progress_bot_username!==bot.username)return answer({error:'BOT_CHANGE_NOT_ALLOWED'},400);
  const secret=config.site_progress_webhook_secret||Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
  await rpc('site_progress_bot_config',{values_json:{site_progress_bot_token:token,site_progress_bot_username:bot.username,site_progress_webhook_secret:secret}});
  await telegram(token,'setWebhook',{url:url()+'/functions/v1/site-process-bot',secret_token:secret,allowed_updates:['message'],drop_pending_updates:false});
  return answer({configured:true,username:bot.username});
 }
 if(data.action==='status'){await admin(req);if(!config.site_progress_bot_token)return answer({configured:false});const info=await telegram(config.site_progress_bot_token,'getWebhookInfo',{});return answer({configured:true,username:config.site_progress_bot_username,webhook:info.url===url()+'/functions/v1/site-process-bot',pending:info.pending_update_count,last_error:info.last_error_message?'수신 연결 오류가 있습니다. 다시 연결해 주세요.':null});}
 if(data.action==='dispatch'){if(!safeEqual(req.headers.get('X-Site-Progress-Cron')||'',config.site_progress_cron_secret||''))await admin(req);
  if(!config.site_progress_bot_token)return answer({error:'TELEGRAM_NOT_CONFIGURED'},409);return answer(await dispatch(config));}
 if(!safeEqual(req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'',config.site_progress_webhook_secret||''))return answer({error:'UNAUTHORIZED'},401);
 if(!config.site_progress_bot_token)return answer({error:'TELEGRAM_NOT_CONFIGURED'},409);
 const message=data.message;if(!Number.isSafeInteger(data.update_id)||!message||message.chat?.type!=='private'||message.from?.is_bot||message.chat.id!==message.from?.id||typeof message.text!=='string')return answer({ok:true});
 const text=message.text.trim(),chat=message.chat.id,token=config.site_progress_bot_token;
 const keyboard={keyboard:[[{text:'입력 안내'},{text:'사이트원 열기'}]],resize_keyboard:true};
 if(text==='사이트원 열기'){await telegram(token,'sendMessage',{chat_id:chat,text:'https://deugyi.github.io/kds-check/',reply_markup:keyboard});return answer({ok:true});}
 if(['/start','/help','입력 안내','실적 전송'].includes(text)){await telegram(token,'sendMessage',{chat_id:chat,text:P.help(),reply_markup:keyboard});return answer({ok:true});}
 const match=/^\/start\s+([a-f0-9]{48})$/.exec(text);let parsed:any={work_date:null,items:[],no_work:false,note:'',revision:false};
 if(!match){try{parsed=P.parseTelegram(text);}catch(e){await telegram(token,'sendMessage',{chat_id:chat,text:(e as Error).message+'\n\n'+P.help(),reply_markup:keyboard});return answer({ok:true});}}
 const result=await rpc('site_progress_bot_receive',{event_id:data.update_id,chat,display:[message.from.first_name,message.from.last_name].filter(Boolean).join(' '),invite_token:match?.[1]||null,
 day:parsed.work_date,lines:parsed.items,work_none:parsed.no_work,memo:parsed.note,raw:text,is_revision:parsed.revision});
 if(!result.sent){await telegram(token,'sendMessage',{chat_id:chat,text:result.reply,reply_markup:keyboard});await rpc('site_progress_bot_ack',{event_id:data.update_id});}
 return answer({ok:true});
 }catch(e){const message=(e as Error).message;if(message==='ADMIN_REQUIRED')return answer({error:message},403);
 // Never log tokens, chat contents, auth headers, or upstream response bodies.
 return answer({error:'REQUEST_FAILED'},500);}
}
if(typeof Deno!=='undefined')Deno.serve(handler);
