/* Dedicated company web-app entrances. These are navigation scopes, not roles. */
(function(root){
'use strict';
const sites={south:{page:'site-prd',name:'서리풀 : 남측',repository:'siteone-south'},north:{page:'site-north-prd',name:'서리풀 : 북측',repository:'siteone-north'}};
const site=document.documentElement?.getAttribute?.('data-site-app'),entry=Object.hasOwn(sites,site)?sites[site]:null;
const returnKey='siteone-app-login-return',maxAge=15*60*1000;
function cancelLogin(){try{root.sessionStorage.removeItem(returnKey);}catch{}}
function rememberLogin(){
 cancelLogin();
 if(entry)try{root.sessionStorage.setItem(returnKey,JSON.stringify({site,at:Date.now()}));}catch{}
}
function restoreAfterLogin(){
 if(entry)return false;
 let saved;try{saved=JSON.parse(root.sessionStorage.getItem(returnKey)||'null');}catch{cancelLogin();return false;}
 if(!saved)return false;cancelLogin();
 if(!Object.hasOwn(sites,saved.site)||!Number.isFinite(saved.at)||Date.now()-saved.at<0||Date.now()-saved.at>maxAge)return false;
 try{
  // OAuth still returns to the existing allowed URL. Redirect only after the
  // Supabase SDK has finished exchanging the code and restoring the session.
  const base=new URL(root.SITE_CONFIG.redirect);
  if(base.origin!==root.location.origin||!['https:','http:'].includes(base.protocol))return false;
  const target=new URL('../'+sites[saved.site].repository+'/',base);root.location.replace(target.href);return true;
 }catch{return false;}
}
root.SiteApp=Object.freeze({site:entry?site:null,page:entry?.page||null,
 includesPage:id=>!entry||id===entry.page,
 resolvePage:id=>entry?entry.page:id,
 rememberLogin,cancelLogin,restoreAfterLogin,
 start(){
  if(!entry)return;
  document.title='사이트원 · '+entry.name;
  const title=document.getElementById('home-title-link');title.textContent=document.title;title.setAttribute('aria-label',document.title+' · 시공 현황');title.href='./';
  document.getElementById('home-button').hidden=true;
  for(const menu of document.querySelectorAll('#nav .menu')){const button=menu.querySelector('button[data-t]');menu.hidden=!button||!root.SiteApp.includesPage(button.dataset.t);if(button?.dataset.t===entry.page)button.textContent='시공 현황';}
  document.getElementById('nav').hidden=true;
  root.openKDSPage(entry.page);
 }
});
})(globalThis);
