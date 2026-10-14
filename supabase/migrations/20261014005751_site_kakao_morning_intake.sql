-- Kakao channel intake, morning plans and explicit plan-linked result feedback.
-- Existing company accounts, approvals, Telegram contacts and drawing records are retained.
begin;
set local lock_timeout='10s';

alter table public.site_progress_reports drop constraint site_progress_reports_source_check;
alter table public.site_progress_reports add constraint site_progress_reports_source_check check(source in ('web','telegram','kakao'));
create table public.site_progress_plans (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.site_progress_companies(id),
 work_date date not null check(work_date>=date '2020-01-01'),document jsonb not null,
 raw_text text not null check(length(raw_text)<=12000),source text not null check(source in ('web','kakao')),
 submitted_by uuid references public.site_members(user_id),version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,work_date)
);
alter table public.site_progress_reports add column plan_id uuid references public.site_progress_plans(id),
 add column plan_version integer,add column task_feedback jsonb not null default '[]';
alter table public.site_progress_reports add constraint progress_plan_feedback_fields check(
 (plan_id is null and plan_version is null and task_feedback='[]'::jsonb)
 or (plan_id is not null and plan_version>0 and jsonb_typeof(task_feedback)='array'));
create unique index progress_report_plan on public.site_progress_reports(plan_id) where plan_id is not null;
create index progress_plan_date on public.site_progress_plans(work_date desc,company_id);
create index progress_plan_author on public.site_progress_plans(submitted_by);
create table site_progress_private.plan_audit (
 id bigint generated always as identity primary key,plan_id uuid not null references public.site_progress_plans(id),
 changed_at timestamptz not null default now(),changed_by uuid,action text not null,before_value jsonb,after_value jsonb not null
);
create index progress_plan_audit_plan on site_progress_private.plan_audit(plan_id);
create table site_progress_private.kakao_settings (
 singleton boolean primary key default true check(singleton),bot_id text not null default '' check(length(bot_id)<=70),
 channel_url text not null default '' check(length(channel_url)<=200),enabled boolean not null default false,last_received timestamptz
);
insert into site_progress_private.kakao_settings(singleton) values(true);
create table site_progress_private.kakao_contacts (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.site_progress_companies(id),
 bot_id text not null check(length(bot_id) between 1 and 70),user_key text not null check(length(user_key) between 1 and 70),
 active boolean not null default true,created_at timestamptz not null default now(),unique(bot_id,user_key)
);
create index progress_kakao_contact_company on site_progress_private.kakao_contacts(company_id);
create table site_progress_private.kakao_invites (
 token_hash text primary key,company_id uuid not null references public.site_progress_companies(id),
 bot_id text not null,expires_at timestamptz not null default now()+interval '24 hours',used_at timestamptz
);
create index progress_kakao_invite_company on site_progress_private.kakao_invites(company_id);
create table site_progress_private.kakao_events (
 event_key text primary key check(length(event_key)=64),request_hash text not null check(length(request_hash)=64),
 bot_id text not null,user_key text not null,company_id uuid references public.site_progress_companies(id),
 plan_id uuid references public.site_progress_plans(id),report_id uuid references public.site_progress_reports(id),
 reply text not null,created_at timestamptz not null default now()
);
create index progress_kakao_event_company on site_progress_private.kakao_events(company_id);
create index progress_kakao_event_plan on site_progress_private.kakao_events(plan_id);
create index progress_kakao_event_report on site_progress_private.kakao_events(report_id);
alter table public.site_progress_plans enable row level security;
alter table site_progress_private.plan_audit enable row level security;
alter table site_progress_private.kakao_settings enable row level security;
alter table site_progress_private.kakao_contacts enable row level security;
alter table site_progress_private.kakao_invites enable row level security;
alter table site_progress_private.kakao_events enable row level security;
revoke all on public.site_progress_plans from public,anon,authenticated;
grant select on public.site_progress_plans to authenticated;
grant all on public.site_progress_plans to service_role;
revoke all on site_progress_private.plan_audit,site_progress_private.kakao_settings,site_progress_private.kakao_contacts,
 site_progress_private.kakao_invites,site_progress_private.kakao_events from public,anon,authenticated;
grant all on site_progress_private.plan_audit,site_progress_private.kakao_settings,site_progress_private.kakao_contacts,
 site_progress_private.kakao_invites,site_progress_private.kakao_events to service_role;
grant usage,select on sequence site_progress_private.plan_audit_id_seq to service_role;
create policy progress_plans_read on public.site_progress_plans for select to authenticated using(
 (select public.site_role()) in ('viewer','editor','admin') and
 (submitted_by=(select auth.uid()) or (select public.site_role())='admin'
 or exists(select 1 from public.site_progress_companies c where c.id=company_id and c.supervisor_id=(select auth.uid()))
 or exists(select 1 from public.site_progress_reports r where r.plan_id=site_progress_plans.id and r.state='approved')));

create function site_progress_private.validate_plan(day date,doc jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare v jsonb; n integer; total integer:=0; seen text[]:='{}';
begin
 if day is null or day<date '2020-01-01' or day>(now() at time zone 'Asia/Seoul')::date
 or doc is null or jsonb_typeof(doc)<>'object' or doc->>'work_date' is distinct from day::text
 or length(coalesce(doc->>'company_name','')) not between 1 and 100 then raise exception 'INVALID_PLAN'; end if;
 if jsonb_typeof(doc->'tasks') is distinct from 'array' or jsonb_array_length(doc->'tasks') not between 1 and 50
 or jsonb_typeof(doc->'staffing') is distinct from 'array' or jsonb_array_length(doc->'staffing')>30
 or jsonb_typeof(doc->'equipment') is distinct from 'array' or jsonb_array_length(doc->'equipment')>50
 or jsonb_typeof(doc->'materials') is distinct from 'array' or jsonb_array_length(doc->'materials')>50
 or length(coalesce(doc->>'newcomers',''))>2000 then raise exception 'INVALID_PLAN'; end if;
 n:=0;
 for v in select value from jsonb_array_elements(doc->'tasks') loop
  n:=n+1;
  if jsonb_typeof(v)<>'object' or jsonb_typeof(v->'no') is distinct from 'number' or v->>'no'<>n::text
  or length(coalesce(v->>'description','')) not between 1 and 500 or length(coalesce(v->>'raw',''))>500
  or length(coalesce(v->>'floor',''))>50 or length(coalesce(v->>'zone',''))>50 or length(coalesce(v->>'location',''))>100
  then raise exception 'INVALID_PLAN_TASK'; end if;
 end loop;
 for v in select value from jsonb_array_elements(doc->'staffing') loop
  if length(coalesce(v->>'role','')) not between 1 and 80 or jsonb_typeof(v->'count') is distinct from 'number'
  or (v->>'count')::numeric not between 0 and 10000 or (v->>'count')::numeric<>trunc((v->>'count')::numeric)
  or v->>'role'=any(seen) then raise exception 'INVALID_STAFFING'; end if;
  seen:=array_append(seen,v->>'role');total:=total+(v->>'count')::integer;
 end loop;
 if doc->'reported_headcount' is not null and doc->'reported_headcount'<>'null'::jsonb then
  if jsonb_typeof(doc->'reported_headcount')<>'number' or (doc->>'reported_headcount')::numeric not between 0 and 10000
  or (doc->>'reported_headcount')::numeric<>trunc((doc->>'reported_headcount')::numeric)
  or (jsonb_array_length(doc->'staffing')>0 and (doc->>'reported_headcount')::integer<>total)
  then raise exception 'STAFF_TOTAL_MISMATCH'; end if;
 end if;
 for v in select value from jsonb_array_elements(doc->'equipment') loop
  if length(coalesce(v->>'name','')) not between 1 and 120 or jsonb_typeof(v->'count') is distinct from 'number'
  or (v->>'count')::numeric not between 0 and 10000 or (v->>'count')::numeric<>trunc((v->>'count')::numeric)
  or v->>'unit' is distinct from '대' then raise exception 'INVALID_EQUIPMENT'; end if;
 end loop;
 for v in select value from jsonb_array_elements(doc->'materials') loop
  if length(coalesce(v->>'description','')) not between 1 and 500 or length(coalesce(v->>'raw',''))>500
  or length(coalesce(v->>'floor',''))>50 or length(coalesce(v->>'zone',''))>50
  or (v->'vehicle_count' is not null and v->'vehicle_count'<>'null'::jsonb and
  (jsonb_typeof(v->'vehicle_count')<>'number' or (v->>'vehicle_count')::numeric not between 0 and 10000
  or (v->>'vehicle_count')::numeric<>trunc((v->>'vehicle_count')::numeric))) then raise exception 'INVALID_MATERIAL'; end if;
 end loop;
end $$;

create function site_progress_private.store_plan(company uuid,day date,doc jsonb,raw text,source_code text,actor uuid,expected integer)
returns public.site_progress_plans language plpgsql security invoker set search_path='' as $$
declare c public.site_progress_companies; old public.site_progress_plans; result public.site_progress_plans;
begin
 perform site_progress_private.validate_plan(day,doc);
 select * into c from public.site_progress_companies where id=company and active;
 if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
 if regexp_replace(doc->>'company_name','\s','','g')<>regexp_replace(c.name,'\s','','g') then raise exception 'COMPANY_NAME_MISMATCH'; end if;
 if raw is null or length(raw)>12000 or source_code not in ('web','kakao') then raise exception 'INVALID_PLAN'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(company::text||':'||day::text,0));
 select * into old from public.site_progress_plans where company_id=company and work_date=day for update;
 if expected is null or expected<>coalesce(old.version,0) then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 if exists(select 1 from public.site_progress_reports where plan_id=old.id) then raise exception 'PLAN_FEEDBACK_LOCKED'; end if;
 if old.id is null then
  insert into public.site_progress_plans(company_id,work_date,document,raw_text,source,submitted_by)
  values(company,day,doc,raw,source_code,actor) returning * into result;
 else
  update public.site_progress_plans set document=doc,raw_text=raw,source=source_code,submitted_by=actor,version=version+1,updated_at=now()
  where id=old.id returning * into result;
 end if;
 insert into site_progress_private.plan_audit(plan_id,changed_by,action,before_value,after_value)
 values(result.id,actor,source_code||'_plan',case when old.id is not null then to_jsonb(old) end,to_jsonb(result));
 return result;
end $$;
create function site_progress_private.save_plan(company uuid,day date,doc jsonb,raw text,expected integer)
returns public.site_progress_plans language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();
 if not exists(select 1 from public.site_progress_companies where id=company and active and
 (public.site_role()='admin' or supervisor_id=auth.uid())) then raise exception 'SUBMIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 return site_progress_private.store_plan(company,day,doc,raw,'web',auth.uid(),expected);
end $$;
create function public.site_progress_save_plan(company uuid,day date,doc jsonb,raw text,expected integer)
returns public.site_progress_plans language sql security invoker set search_path='' as $$select site_progress_private.save_plan(company,day,doc,raw,expected)$$;

create or replace function site_progress_private.validate_result(work_date date,items jsonb,no_work boolean,note text) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb; qty numeric;
begin
 if work_date is null or work_date<date '2020-01-01' or work_date>(now() at time zone 'Asia/Seoul')::date
 or no_work is null or note is null or length(note)>2000 or items is null or jsonb_typeof(items)<>'array'
 then raise exception 'INVALID_RESULT'; end if;
 if no_work then
  if jsonb_array_length(items)<>0 then raise exception 'NO_WORK_WITH_ITEMS'; end if;
 elsif jsonb_array_length(items) not between 1 and 50 then raise exception 'ITEMS_REQUIRED'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item)<>'object' or length(coalesce(item->>'process','')) not between 1 and 80
  or length(coalesce(item->>'floor','')) not between 1 and 50 or length(coalesce(item->>'zone','')) not between 1 and 50
  or coalesce(item->>'unit','') not in ('m³','m²','t','대','장','부재','공','개','m','개소')
  or jsonb_typeof(item->'quantity') is distinct from 'number' then raise exception 'INVALID_ITEM'; end if;
  qty:=(item->>'quantity')::numeric;
  if qty<0 or qty>1000000000 or qty<>round(qty,3) or
  (item->>'unit' in ('대','장','부재','공','개','개소') and qty<>trunc(qty)) then raise exception 'INVALID_QUANTITY'; end if;
 end loop;
end $$;
create function site_progress_private.validate_feedback(p public.site_progress_plans,expected integer,lines jsonb,feedback jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare v jsonb; f jsonb; seen integer[]:='{}'; task integer; n integer;
begin
 if expected is null or expected<>p.version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 if jsonb_typeof(feedback) is distinct from 'array' or jsonb_array_length(feedback)<>jsonb_array_length(p.document->'tasks')
 then raise exception 'ALL_TASKS_REQUIRED'; end if;
 for f in select value from jsonb_array_elements(feedback) loop
  if jsonb_typeof(f->'task_no') is distinct from 'number' or f->>'state' not in ('done','partial','not_done')
  or f->>'state' is null or length(coalesce(f->>'reason',''))>2000 then raise exception 'INVALID_FEEDBACK'; end if;
  task:=(f->>'task_no')::integer;
  if f->>'task_no'<>task::text or task=any(seen) or not exists(select 1 from jsonb_array_elements(p.document->'tasks') t where t->>'no'=task::text)
  then raise exception 'INVALID_FEEDBACK_TASK'; end if;
  seen:=array_append(seen,task);
  if f->>'state'<>'done' and length(btrim(coalesce(f->>'reason','')))=0 then raise exception 'FEEDBACK_REASON_REQUIRED'; end if;
  select count(*) into n from jsonb_array_elements(lines) l where l->>'plan_item'=task::text;
  if (f->>'state'='not_done' and n<>0) or (f->>'state'<>'not_done' and n=0) then raise exception 'FEEDBACK_QUANTITY_MISMATCH'; end if;
 end loop;
 for v in select value from jsonb_array_elements(lines) loop
  if (v->>'quantity')::numeric<=0 then raise exception 'INVALID_QUANTITY'; end if;
  if v ? 'plan_item' and (jsonb_typeof(v->'plan_item')<>'number' or not (v->>'plan_item')::integer=any(seen)
   or v->>'plan_item'<>((v->>'plan_item')::integer)::text) then raise exception 'INVALID_FEEDBACK_TASK'; end if;
 end loop;
end $$;

-- Owner-only store. API wrappers validate account or paired supplier before calling it.
create function site_progress_private.store_report(company uuid,day date,lines jsonb,work_none boolean,memo text,
 report uuid,expected integer,source_code text,raw_text text,actor uuid,plan_ref uuid,plan_expected integer,feedback jsonb)
returns public.site_progress_reports language plpgsql security invoker set search_path='' as $$
declare old public.site_progress_reports; result public.site_progress_reports; names text[]; p public.site_progress_plans;
begin
 perform site_progress_private.validate_result(day,lines,work_none,memo);
 names:=site_progress_private.processes(lines);
 if ''=any(names) or source_code not in ('web','telegram','kakao') or source_code is null or raw_text is null or length(raw_text)>12000
 then raise exception 'INVALID_RESULT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(company::text||':'||day::text,0));
 if report is not null then
  select * into old from public.site_progress_reports where id=report and company_id=company and work_date=day for update;
  if not found then raise exception 'REPORT_NOT_FOUND'; end if;
 end if;
 if expected is null or expected<>coalesce(old.version,0) then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 if old.state='approved' then raise exception 'APPROVED_RESULT_LOCKED'; end if;
 if old.plan_id is not null and old.plan_id is distinct from plan_ref then raise exception 'PLAN_FEEDBACK_EDIT_REQUIRED'; end if;
 if plan_ref is not null then
  select * into p from public.site_progress_plans where id=plan_ref and company_id=company and work_date=day for update;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  perform site_progress_private.validate_feedback(p,plan_expected,lines,feedback);
  if exists(select 1 from public.site_progress_reports r where r.plan_id=plan_ref and r.id is distinct from report) then raise exception 'PLAN_ALREADY_REPLIED'; end if;
 elsif plan_expected is not null or feedback is distinct from '[]'::jsonb then raise exception 'INVALID_FEEDBACK'; end if;
 if exists(select 1 from public.site_progress_reports r where r.company_id=company and r.work_date=day
 and r.id is distinct from report and (work_none or r.no_work)) then raise exception 'NO_WORK_CONFLICT'; end if;
 if exists(select 1 from public.site_progress_reports r where r.company_id=company and r.work_date=day
 and r.id is distinct from report and site_progress_private.processes(r.items)&&names) then raise exception 'PROCESS_ALREADY_REPORTED'; end if;
 if report is null then
  insert into public.site_progress_reports(company_id,work_date,items,no_work,note,source,raw_text,submitted_by,plan_id,plan_version,task_feedback)
  values(company,day,lines,work_none,memo,source_code,raw_text,actor,plan_ref,plan_expected,feedback) returning * into result;
 else
  update public.site_progress_reports set items=lines,no_work=work_none,note=memo,source=source_code,
  raw_text=store_report.raw_text,submitted_by=actor,state='pending',version=version+1,updated_at=now(),
  review_note='',reviewed_by=null,reviewed_at=null,plan_id=plan_ref,plan_version=plan_expected,task_feedback=feedback
  where id=report returning * into result;
 end if;
 insert into site_progress_private.audit(report_id,changed_by,action,before_value,after_value)
 values(result.id,actor,case when source_code='web' then 'submit' else source_code||'_submit' end,case when old.id is not null then to_jsonb(old) end,to_jsonb(result));
 return result;
end $$;
create or replace function site_progress_private.store_report(company uuid,day date,lines jsonb,work_none boolean,memo text,
 report uuid,expected integer,source_code text,raw_text text,actor uuid)
returns public.site_progress_reports language sql security invoker set search_path='' as $$
 select site_progress_private.store_report(company,day,lines,work_none,memo,report,expected,source_code,raw_text,actor,null,null,'[]') $$;
create function site_progress_private.submit_feedback(plan uuid,expected_plan integer,report uuid,expected integer,lines jsonb,feedback jsonb,memo text)
returns public.site_progress_reports language plpgsql security definer set search_path='' as $$
declare p public.site_progress_plans;
begin
 perform site_progress_private.require_member();
 select * into p from public.site_progress_plans where id=plan;
 if not found then raise exception 'PLAN_NOT_FOUND'; end if;
 if not exists(select 1 from public.site_progress_companies where id=p.company_id and active and
 (public.site_role()='admin' or supervisor_id=auth.uid())) then raise exception 'SUBMIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 return site_progress_private.store_report(p.company_id,p.work_date,lines,jsonb_array_length(lines)=0,memo,
 report,expected,'web','',auth.uid(),plan,expected_plan,feedback);
end $$;
create function public.site_progress_submit_feedback(plan uuid,expected_plan integer,report uuid,expected integer,lines jsonb,feedback jsonb,memo text)
returns public.site_progress_reports language sql security invoker set search_path='' as $$select site_progress_private.submit_feedback(plan,expected_plan,report,expected,lines,feedback,memo)$$;

create function site_progress_private.kakao_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare s site_progress_private.kakao_settings;
begin
 perform site_progress_private.require_member();select * into s from site_progress_private.kakao_settings where singleton;
 return jsonb_build_object('enabled',s.enabled,'bot_id',s.bot_id,'channel_url',s.channel_url,'last_received',s.last_received,
 'key_issued',exists(select 1 from vault.secrets where name='site_kakao_skill_key'),
 'companies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'connected',exists(select 1 from site_progress_private.kakao_contacts t where t.company_id=c.id and t.active)))
 from public.site_progress_companies c where public.site_role()='admin' or c.supervisor_id=auth.uid()),'[]'));
end $$;
create function public.site_progress_kakao_status() returns jsonb language sql security invoker set search_path='' as $$select site_progress_private.kakao_status()$$;
create function site_progress_private.kakao_setup(bot text,channel text,is_enabled boolean,rotate boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s site_progress_private.kakao_settings; key_value text; secret_id uuid;
begin
 perform site_progress_private.require_member();if public.site_role()<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 select * into s from site_progress_private.kakao_settings where singleton for update;
 if bot is null or channel is null or is_enabled is null or rotate is null or length(bot)>70 or length(channel)>200
 or (channel<>'' and channel!~'^https://pf\.kakao\.com/[A-Za-z0-9_-]+$') or (is_enabled and (bot='' or channel=''))
 then raise exception 'INVALID_KAKAO_SETTINGS'; end if;
 if s.bot_id<>bot and exists(select 1 from site_progress_private.kakao_contacts where active)
 then raise exception 'BOT_CHANGE_NOT_ALLOWED'; end if;
 select id,decrypted_secret into secret_id,key_value from vault.decrypted_secrets where name='site_kakao_skill_key';
 if secret_id is null or rotate then
  key_value:=encode(extensions.gen_random_bytes(32),'hex');
  if secret_id is null then perform vault.create_secret(key_value,'site_kakao_skill_key');else perform vault.update_secret(secret_id,key_value,'site_kakao_skill_key');end if;
 end if;
 update site_progress_private.kakao_settings set bot_id=bot,channel_url=channel,enabled=is_enabled where singleton;
 return jsonb_build_object('header_name','x-siteone-kakao-key','header_value',key_value,'enabled',is_enabled);
end $$;
create function public.site_progress_kakao_setup(bot text,channel text,is_enabled boolean,rotate boolean) returns jsonb
language sql security invoker set search_path='' as $$select site_progress_private.kakao_setup(bot,channel,is_enabled,rotate)$$;
create function site_progress_private.kakao_credentials() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();if public.site_role()<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return jsonb_build_object('header_name','x-siteone-kakao-key','header_value',(select decrypted_secret from vault.decrypted_secrets where name='site_kakao_skill_key'));
end $$;
create function public.site_progress_kakao_credentials() returns jsonb language sql security invoker set search_path='' as $$select site_progress_private.kakao_credentials()$$;
create function site_progress_private.kakao_config() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_service();
 return (select to_jsonb(s) from site_progress_private.kakao_settings s where singleton)||jsonb_build_object('key',(select decrypted_secret from vault.decrypted_secrets where name='site_kakao_skill_key'));
end $$;
create function public.site_progress_kakao_config() returns jsonb language sql security invoker set search_path='' as $$select site_progress_private.kakao_config()$$;
create function site_progress_private.kakao_invite(company uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text:=encode(extensions.gen_random_bytes(24),'hex');s site_progress_private.kakao_settings;
begin
 perform site_progress_private.require_member();if public.site_role()<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 select * into s from site_progress_private.kakao_settings where singleton;
 if not s.enabled or s.bot_id='' then raise exception 'KAKAO_NOT_CONFIGURED'; end if;
 if not exists(select 1 from public.site_progress_companies where id=company and active) then raise exception 'COMPANY_NOT_FOUND'; end if;
 insert into site_progress_private.kakao_invites(token_hash,company_id,bot_id) values(encode(extensions.digest(token,'sha256'),'hex'),company,s.bot_id);
 return token;
end $$;
create function public.site_progress_kakao_invite(company uuid) returns text language sql security invoker set search_path='' as $$select site_progress_private.kakao_invite(company)$$;
create function site_progress_private.kakao_disconnect(company uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();if public.site_role()<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 update site_progress_private.kakao_invites set used_at=now() where company_id=company and used_at is null;
 update site_progress_private.kakao_contacts set active=false where company_id=company;
end $$;
create function public.site_progress_kakao_disconnect(company uuid) returns void language sql security invoker set search_path='' as $$select site_progress_private.kakao_disconnect(company)$$;

create function site_progress_private.kakao_receive(bot text,user_key text,event_key text,request_hash text,payload jsonb,raw text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s site_progress_private.kakao_settings; ev site_progress_private.kakao_events;
 c public.site_progress_companies; co site_progress_private.kakao_contacts; iv site_progress_private.kakao_invites;
 p public.site_progress_plans; old public.site_progress_reports; r public.site_progress_reports;
 kind text:=payload->>'type';v jsonb;t jsonb;lines jsonb:='[]';day date;reply text;names text[];found_count integer;code text;
begin
 perform site_progress_private.require_service();
 select * into s from site_progress_private.kakao_settings where singleton for share;
 if not s.enabled or s.bot_id is distinct from bot then raise exception 'KAKAO_NOT_CONFIGURED'; end if;
 if user_key is null or length(user_key) not between 1 and 70 or event_key!~'^[a-f0-9]{64}$' or request_hash!~'^[a-f0-9]{64}$'
 or raw is null or length(raw)>12000 or kind not in ('link','plan','report','feedback','status','feedback_help','help') or kind is null
 then raise exception 'INVALID_KAKAO_REQUEST'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(bot||':'||user_key,0));
 if kind not in ('status','feedback_help','help') then
 select * into ev from site_progress_private.kakao_events e where e.event_key=kakao_receive.event_key;
 if found then
  if ev.bot_id<>bot or ev.user_key<>kakao_receive.user_key or ev.request_hash<>kakao_receive.request_hash then raise exception 'EVENT_CONFLICT'; end if;
  return jsonb_build_object('reply',ev.reply,'duplicate',true);
 end if;
 end if;
 if kind='link' then
  select * into iv from site_progress_private.kakao_invites where token_hash=encode(extensions.digest(coalesce(payload->>'token',''),'sha256'),'hex') for update;
  if not found or iv.used_at is not null or iv.expires_at<now() or iv.bot_id<>bot then
   reply:='업체 연결 코드가 만료되었거나 이미 사용되었습니다. 사이트원 관리자에게 새 코드를 요청해 주세요.';
  else
   select * into c from public.site_progress_companies where id=iv.company_id and active;
   select * into co from site_progress_private.kakao_contacts k where k.bot_id=bot and k.user_key=kakao_receive.user_key and active;
   if c.id is null then reply:='현재 운영 중인 업체가 아닙니다. 관리자에게 확인해 주세요.';
   elsif co.id is not null and co.company_id<>iv.company_id then reply:='이미 다른 업체에 연결된 계정입니다. 관리자에게 연결 해제를 요청해 주세요.';
   else
    insert into site_progress_private.kakao_contacts(company_id,bot_id,user_key) values(iv.company_id,bot,kakao_receive.user_key)
    on conflict on constraint kakao_contacts_bot_id_user_key_key do update set company_id=excluded.company_id,active=true;
    update site_progress_private.kakao_invites set used_at=now() where token_hash=iv.token_hash;
    reply:=c.name||' 담당자로 연결되었습니다. 아침 작업계획은 원문을 그대로 보내 주세요. 실제 작업량은 회신 안내로 확인하고 감독자 승인 후 등록합니다.';
   end if;
  end if;
 else
  select k.* into co from site_progress_private.kakao_contacts k join public.site_progress_companies x on x.id=k.company_id
  where k.bot_id=bot and k.user_key=kakao_receive.user_key and k.active and x.active for share of k;
  if not found then reply:='먼저 사이트원 관리자가 발급한 업체 연결 코드를 이 채널에 보내 주세요. 양식: 연결 코드';
  else
   select * into c from public.site_progress_companies where id=co.company_id and active for share;
   begin
    if kind='plan' then
     v:=payload->'document';day:=(v->>'work_date')::date;
     p:=site_progress_private.store_plan(co.company_id,day,v,raw,'kakao',null,coalesce((v->>'expected')::integer,0));
     reply:=day::text||' '||c.name||' 아침계획 '||jsonb_array_length(p.document->'tasks')||'개 항목을 접수했습니다. 계획버전: '||p.version||E'\n예정 작업은 완료 실적으로 집계하지 않습니다. 마감 후 회신 안내를 눌러 실제 수량을 보내 주세요.';
    elsif kind='report' then
     v:=payload->'report';day:=(v->>'work_date')::date;lines:=v->'items';names:=site_progress_private.processes(lines);
     perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(co.company_id::text||':'||day::text,0));
     if coalesce((v->>'revision')::boolean,false) then
      select count(*) into found_count from public.site_progress_reports x where x.company_id=co.company_id and x.work_date=day
      and x.no_work=(v->>'no_work')::boolean and site_progress_private.processes(x.items)=names;
      if found_count<>1 then raise exception 'REVISION_REPORT_NOT_FOUND'; end if;
      select * into old from public.site_progress_reports x where x.company_id=co.company_id and x.work_date=day
      and x.no_work=(v->>'no_work')::boolean and site_progress_private.processes(x.items)=names for update;
     end if;
     r:=site_progress_private.store_report(co.company_id,day,lines,(v->>'no_work')::boolean,coalesce(v->>'note',''),
      old.id,coalesce(old.version,0),'kakao',raw,null);
     reply:=day::text||' 실제 실적을 접수했습니다. 감독자 승인 대기 상태이며 승인 후 정식 등록됩니다.';
    elsif kind='feedback' then
     v:=payload->'feedback';day:=(v->>'work_date')::date;
     perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(co.company_id::text||':'||day::text,0));
     select * into p from public.site_progress_plans where company_id=co.company_id and work_date=day for update;
     if not found then raise exception 'PLAN_NOT_FOUND'; end if;
     select * into old from public.site_progress_reports where plan_id=p.id for update;
     if old.id is not null and not coalesce((v->>'revision')::boolean,false) then raise exception 'PLAN_ALREADY_REPLIED'; end if;
     if coalesce((v->>'revision')::boolean,false) and (old.id is null or (v->>'expected_report')::integer is distinct from old.version)
     then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
     if jsonb_typeof(v->'rows') is distinct from 'array' or jsonb_typeof(v->'extras') is distinct from 'array' then raise exception 'INVALID_FEEDBACK'; end if;
     for t in select value from jsonb_array_elements(v->'rows') loop
      select value into lines from jsonb_array_elements(p.document->'tasks') x where x->>'no'=t->>'task_no';
      if lines is null then raise exception 'INVALID_FEEDBACK_TASK'; end if;
     end loop;
     select coalesce(jsonb_agg(jsonb_build_object('floor',coalesce(j->>'floor','미기재'),'zone',coalesce(j->>'zone','미기재'),
       'process',a->>'process','quantity',a->'quantity','unit',a->>'unit','plan_item',a->'task_no')),'[]') into lines
     from jsonb_array_elements(v->'rows') a join jsonb_array_elements(p.document->'tasks') j on j->>'no'=a->>'task_no';
     lines:=lines||(v->'extras');
     r:=site_progress_private.store_report(co.company_id,day,lines,jsonb_array_length(lines)=0,coalesce(v->>'note',''),old.id,
      coalesce(old.version,0),'kakao',raw,null,p.id,(v->>'expected_plan')::integer,v->'feedback');
     reply:=day::text||' 계획별 작업결과를 접수했습니다. 감독자 승인 대기 상태입니다. 승인 후 실제 수량만 정식 집계합니다.';
    else
     day:=coalesce((payload->>'work_date')::date,(now() at time zone 'Asia/Seoul')::date);
     select * into p from public.site_progress_plans where company_id=co.company_id and work_date=day;
     select * into old from public.site_progress_reports where plan_id=p.id;
     if kind='help' then reply:=c.name||E'\n아침 계획은 날짜·업체명·출력인원·장비·작업내용·자재반입·신규자가 있는 메시지를 그대로 보내 주세요. 실제 실적은 날짜 다음 줄부터 층 / 공구 / 공정 / 실제 수량 / 단위로 입력합니다.\n계획별 작업결과는 회신 안내를 눌러 양식을 확인하세요. 승인은 사이트원에서 지정 감독자가 합니다.';
     elsif p.id is null then reply:=day::text||' 아침 작업계획이 없습니다. 먼저 아침 메시지를 보내 주세요.';
     elsif kind='status' then
      reply:=day::text||' '||c.name||' 계획버전: '||p.version||E'\n'||case when old.id is null then '실적 미회신' when old.state='approved' then '승인됨' when old.state='pending' then '감독자 승인 대기' else '보완 요청: '||old.review_note end||E'\n'||
       (select string_agg(t->>'no'||'. '||coalesce(t->>'zone','공구 미기재')||' '||coalesce(t->>'floor','층 미기재')||' '||t->>'description',E'\n') from jsonb_array_elements(p.document->'tasks') t);
     else
      reply:='다음 양식의 대괄호를 실제 내용으로 바꿔 모든 계획의 결과를 보내 주세요. 설치·용접 등은 같은 계획번호로 행을 나눌 수 있습니다.'||E'\n'||
       case when old.id is not null then '작업결과수정' else '작업결과' end||E'\n'||day::text||E'\n계획버전: '||p.version||
       case when old.id is not null then E'\n실적버전: '||old.version else '' end||E'\n'||
       (select string_agg(t->>'no'||' / [완료·일부 완료·미실시] / [실제 작업] / [수량] / [단위] / [잔여·미실시 사유]',E'\n') from jsonb_array_elements(p.document->'tasks') t)||
       E'\n미실시는 실제 작업·수량·단위에 -를 넣고 사유를 입력합니다. 추가 작업: 추가 / 층 / 공구 / 공정 / 수량 / 단위 / 비고';
      if old.state='approved' then reply:='승인된 실적입니다. 수정을 하려면 지정 감독자가 사이트원에서 승인 취소·보완 요청을 먼저 처리해야 합니다.';end if;
     end if;
    end if;
   exception when others then
    code:=SQLERRM;
    reply:=case code
     when 'COMPANY_NAME_MISMATCH' then '원문의 업체명이 연결된 업체와 다릅니다. 관리자에게 등록 업체명을 확인해 주세요.'
     when 'RECORD_CONFLICT' then '기존 자료 또는 버전이 다릅니다. 오늘 계획·회신 안내에서 최신 버전을 확인해 수정 양식으로 보내 주세요.'
     when 'PLAN_FEEDBACK_LOCKED' then '이미 작업결과가 접수된 계획은 변경할 수 없습니다. 실적 내용은 감독자 검토 후 보완해 주세요.'
     when 'PLAN_ALREADY_REPLIED' then '이미 계획별 작업결과를 접수했습니다. 회신 안내의 실적버전으로 작업결과수정 양식을 사용해 주세요.'
     when 'PLAN_NOT_FOUND' then '해당 날짜의 아침계획을 먼저 보내 주세요.'
     when 'PLAN_FEEDBACK_EDIT_REQUIRED' then '계획에 연결된 실적은 작업결과수정 양식으로 보완해 주세요.'
     when 'APPROVED_RESULT_LOCKED' then '승인된 실적입니다. 감독자가 승인 취소·보완 요청한 뒤 수정할 수 있습니다.'
     when 'PROCESS_ALREADY_REPORTED' then '같은 날짜·공종의 실적이 이미 있습니다. 기존 실적을 보완해 주세요. 계획 결과와 따로 접수한 같은 작업은 중복 집계하지 않습니다.'
     when 'NO_WORK_CONFLICT' then '작업 없음과 실제 실적을 같은 날짜에 함께 등록할 수 없습니다. 기존 건을 확인해 주세요.'
     when 'ALL_TASKS_REQUIRED' then '모든 계획 항목의 작업결과를 입력해 주세요. 미실시 항목도 사유를 포함해 주세요.'
     when 'FEEDBACK_REASON_REQUIRED' then '일부 완료·미실시는 잔여 작업 또는 미실시 사유가 필요합니다.'
     when 'FEEDBACK_QUANTITY_MISMATCH' then '계획별 진행 상태와 실제 작업·수량을 확인해 주세요.'
     when 'REVISION_REPORT_NOT_FOUND' then '수정할 해당 날짜·공종의 기존 실적이 없습니다. 새 실적이면 /수정을 빼고 보내 주세요.'
     else '항목·날짜·수량·단위를 확인해 주세요. 접수되지 않았습니다. 입력 안내를 참고하거나 사이트원에서 내용을 확인해 주세요.' end;
    if code not in ('COMPANY_NAME_MISMATCH','RECORD_CONFLICT','PLAN_FEEDBACK_LOCKED','PLAN_ALREADY_REPLIED','PLAN_NOT_FOUND',
     'PLAN_FEEDBACK_EDIT_REQUIRED','APPROVED_RESULT_LOCKED','PROCESS_ALREADY_REPORTED','NO_WORK_CONFLICT','ALL_TASKS_REQUIRED',
     'FEEDBACK_REASON_REQUIRED','FEEDBACK_QUANTITY_MISMATCH','REVISION_REPORT_NOT_FOUND') and code!~'^(INVALID_|STAFF_|ITEMS_|NO_WORK_)'
     then raise; end if;
   end;
  end if;
 end if;
 if kind not in ('status','feedback_help','help') then
  insert into site_progress_private.kakao_events(event_key,request_hash,bot_id,user_key,company_id,plan_id,report_id,reply)
  values(kakao_receive.event_key,kakao_receive.request_hash,bot,kakao_receive.user_key,coalesce(c.id,co.company_id),p.id,r.id,reply);
 end if;
 update site_progress_private.kakao_settings set last_received=now() where singleton;
 return jsonb_build_object('reply',reply,'duplicate',false);
end $$;
create function public.site_progress_kakao_receive(bot text,user_key text,event_key text,request_hash text,payload jsonb,raw text)
returns jsonb language sql security invoker set search_path='' as $$select site_progress_private.kakao_receive(bot,user_key,event_key,request_hash,payload,raw)$$;

revoke all on function site_progress_private.validate_plan(date,jsonb),
 site_progress_private.store_plan(uuid,date,jsonb,text,text,uuid,integer),
 site_progress_private.validate_feedback(public.site_progress_plans,integer,jsonb,jsonb),
 site_progress_private.store_report(uuid,date,jsonb,boolean,text,uuid,integer,text,text,uuid,uuid,integer,jsonb)
 from public,anon,authenticated,service_role;
revoke all on function site_progress_private.save_plan(uuid,date,jsonb,text,integer),public.site_progress_save_plan(uuid,date,jsonb,text,integer),
 site_progress_private.submit_feedback(uuid,integer,uuid,integer,jsonb,jsonb,text),public.site_progress_submit_feedback(uuid,integer,uuid,integer,jsonb,jsonb,text),
 site_progress_private.kakao_status(),public.site_progress_kakao_status(),
 site_progress_private.kakao_setup(text,text,boolean,boolean),public.site_progress_kakao_setup(text,text,boolean,boolean),
 site_progress_private.kakao_credentials(),public.site_progress_kakao_credentials(),
 site_progress_private.kakao_invite(uuid),public.site_progress_kakao_invite(uuid),
 site_progress_private.kakao_disconnect(uuid),public.site_progress_kakao_disconnect(uuid) from public,anon,authenticated,service_role;
grant execute on function site_progress_private.save_plan(uuid,date,jsonb,text,integer),public.site_progress_save_plan(uuid,date,jsonb,text,integer),
 site_progress_private.submit_feedback(uuid,integer,uuid,integer,jsonb,jsonb,text),public.site_progress_submit_feedback(uuid,integer,uuid,integer,jsonb,jsonb,text),
 site_progress_private.kakao_status(),public.site_progress_kakao_status(),
 site_progress_private.kakao_setup(text,text,boolean,boolean),public.site_progress_kakao_setup(text,text,boolean,boolean),
 site_progress_private.kakao_credentials(),public.site_progress_kakao_credentials(),
 site_progress_private.kakao_invite(uuid),public.site_progress_kakao_invite(uuid),
 site_progress_private.kakao_disconnect(uuid),public.site_progress_kakao_disconnect(uuid) to authenticated;
revoke all on function site_progress_private.kakao_config(),public.site_progress_kakao_config(),
 site_progress_private.kakao_receive(text,text,text,text,jsonb,text),public.site_progress_kakao_receive(text,text,text,text,jsonb,text)
 from public,anon,authenticated,service_role;
grant execute on function site_progress_private.kakao_config(),public.site_progress_kakao_config(),
 site_progress_private.kakao_receive(text,text,text,text,jsonb,text),public.site_progress_kakao_receive(text,text,text,text,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
