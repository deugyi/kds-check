// Retired endpoint: cached clients and old webhook retries cannot register or send anything.
// Keep this denial response deployed so the removed integration cannot resume.
export function handler(_req:Request){return new Response(JSON.stringify({error:'INTEGRATION_REMOVED'}),{status:410,headers:{'Content-Type':'application/json'}});}
if(typeof Deno!=='undefined')Deno.serve(handler);
