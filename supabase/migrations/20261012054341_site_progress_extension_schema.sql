-- pg_net was just introduced and is still unused. Set its carrier schema at installation.
-- The HTTP API remains in net; this extension is not relocatable.
begin;
do $$begin
 if exists(select 1 from net.http_request_queue) or exists(select 1 from net._http_response)
 or exists(select 1 from vault.secrets where name='site_progress_bot_token') then
 raise exception 'NETWORK_EXTENSION_ALREADY_IN_USE'; end if;
end $$;
drop extension pg_net;
create extension pg_net with schema extensions;
commit;
