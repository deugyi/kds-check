-- Construction results intake and explicit supervisor approval. Existing drawing records are unchanged.
begin;
create schema site_progress_private;
revoke all on schema site_progress_private from public,anon,authenticated;
grant usage on schema site_progress_private to authenticated,service_role;

create table public.site_progress_companies (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
 site text not null default 'south' check(site in ('south','north')),
 supervisor_id uuid references public.site_members(user_id), active boolean not null default true,
 reminder_enabled boolean not null default false, reminder_time time not null default '17:00',
 work_days integer[] not null default array[1,2,3,4,5,6] check(work_days <@ array[0,1,2,3,4,5,6]),
 created_at timestamptz not null default now()
);
create unique index progress_company_name on public.site_progress_companies(site,lower(name));
create table public.site_progress_reports (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.site_progress_companies(id),
 work_date date not null, state text not null default 'pending' check(state in ('pending','returned','approved')),
 items jsonb not null default '[]', no_work boolean not null default false, note text not null default '' check(length(note)<=2000),
 source text not null check(source in ('web','telegram')), raw_text text not null default '' check(length(raw_text)<=12000),
 submitted_by uuid references public.site_members(user_id), reviewed_by uuid references public.site_members(user_id),
 reviewed_at timestamptz, review_note text not null default '' check(length(review_note)<=2000),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,work_date), check(work_date>=date '2020-01-01'), check(version>0),
 check((state='approved')=(reviewed_by is not null and reviewed_at is not null))
);
create index progress_report_date on public.site_progress_reports(work_date desc,company_id);
create index progress_report_reviewer on public.site_progress_companies(supervisor_id);
create index progress_report_author on public.site_progress_reports(submitted_by);
create index progress_report_reviewed on public.site_progress_reports(reviewed_by);

create table site_progress_private.contacts (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.site_progress_companies(id),
 kind text not null check(kind in ('supplier','supervisor')), user_id uuid references public.site_members(user_id),
 chat_id bigint not null, display_name text not null default '', active boolean not null default true,
 created_at timestamptz not null default now(), unique(company_id,kind,chat_id)
);
create table site_progress_private.invites (
 token_hash text primary key, company_id uuid not null references public.site_progress_companies(id),
 kind text not null check(kind in ('supplier','supervisor')), user_id uuid references public.site_members(user_id),
 expires_at timestamptz not null default now()+interval '24 hours', used_at timestamptz
);
create table site_progress_private.audit (
 id bigint generated always as identity primary key, report_id uuid not null references public.site_progress_reports(id),
 changed_at timestamptz not null default now(), changed_by uuid, action text not null,
 before_value jsonb, after_value jsonb not null
);
create table site_progress_private.bot_events (
 update_id bigint primary key, reply text not null, chat_id bigint not null, reply_sent boolean not null default false,
 created_at timestamptz not null default now()
);
create table site_progress_private.outbox (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.site_progress_companies(id),
 work_date date not null, contact_id uuid not null references site_progress_private.contacts(id),
 kind text not null check(kind in ('missing','pending','returned','approved')), report_version integer not null default 0,
 message text not null, state text not null default 'queued' check(state in ('queued','sending','sent','failed','skipped')),
 attempts integer not null default 0, queued_at timestamptz not null default now(), claimed_at timestamptz,
 sent_at timestamptz, error_text text not null default '',
 unique(company_id,work_date,contact_id,kind,report_version)
);
create index progress_outbox_queued on site_progress_private.outbox(state,queued_at);

alter table public.site_progress_companies enable row level security;
alter table public.site_progress_reports enable row level security;
alter table site_progress_private.contacts enable row level security;
alter table site_progress_private.invites enable row level security;
alter table site_progress_private.audit enable row level security;
alter table site_progress_private.bot_events enable row level security;
alter table site_progress_private.outbox enable row level security;
revoke all on public.site_progress_companies,public.site_progress_reports from public,anon,authenticated;
grant select on public.site_progress_companies,public.site_progress_reports to authenticated;
grant all on public.site_progress_companies,public.site_progress_reports to service_role;
revoke all on all tables in schema site_progress_private from public,anon,authenticated;
grant all on all tables in schema site_progress_private to service_role;
grant usage,select on all sequences in schema site_progress_private to service_role;
create policy progress_companies_read on public.site_progress_companies for select to authenticated
 using((select public.site_role()) in ('viewer','editor','admin'));
create policy progress_reports_read on public.site_progress_reports for select to authenticated using(
 (select public.site_role()) in ('viewer','editor','admin') and
 (state='approved' or submitted_by=(select auth.uid()) or (select public.site_role())='admin'
 or exists(select 1 from public.site_progress_companies c where c.id=company_id and c.supervisor_id=(select auth.uid())))
);

create function site_progress_private.require_member() returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then
 raise exception 'ACCESS_REQUIRED' using errcode='42501'; end if;
end $$;
create function site_progress_private.require_service() returns void language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501'; end if;
end $$;
create function site_progress_private.validate_result(work_date date,items jsonb,no_work boolean,note text) returns void
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
  or coalesce(item->>'unit','') not in ('m³','m²','t','대','장','부재','공','개','m')
  or jsonb_typeof(item->'quantity')<>'number' then raise exception 'INVALID_ITEM'; end if;
  qty:=(item->>'quantity')::numeric;
  if qty<0 or qty>1000000000 or qty<>round(qty,3) or
  (item->>'unit' in ('대','장','부재','공','개') and qty<>trunc(qty)) then raise exception 'INVALID_QUANTITY'; end if;
 end loop;
end $$;

create function site_progress_private.context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();
 return jsonb_build_object('companies',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object(
 'supplier_connected',exists(select 1 from site_progress_private.contacts t where t.company_id=c.id and t.kind='supplier' and t.active),
 'supervisor_connected',exists(select 1 from site_progress_private.contacts t where t.company_id=c.id and t.kind='supervisor' and t.active and t.user_id=c.supervisor_id)))
 from public.site_progress_companies c),'[]'),
 'members',case when public.site_role()='admin' then coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'email',email))
 from public.site_members where role in ('viewer','editor','admin')),'[]') else '[]'::jsonb end,
 'bot_username',(select decrypted_secret from vault.decrypted_secrets where name='site_progress_bot_username'),
 'telegram_configured',exists(select 1 from vault.secrets where name='site_progress_bot_token'));
end $$;
create function public.site_progress_context() returns jsonb language sql security invoker set search_path='' as $$
 select site_progress_private.context() $$;

create function site_progress_private.save_company(company uuid,company_name text,site_code text,supervisor uuid,
 is_active boolean,reminders boolean,reminder_at time,days integer[]) returns public.site_progress_companies
language plpgsql security definer set search_path='' as $$
declare result public.site_progress_companies;
begin
 perform site_progress_private.require_member();
 if public.site_role()<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if company_name is null or length(trim(company_name)) not between 1 and 100 or site_code not in ('south','north')
 or site_code is null or is_active is null or reminders is null or reminder_at is null or days is null or not(days <@ array[0,1,2,3,4,5,6])
 then raise exception 'INVALID_COMPANY'; end if;
 if supervisor is not null and not exists(select 1 from public.site_members where user_id=supervisor and role in ('viewer','editor','admin'))
 then raise exception 'SUPERVISOR_ACCESS_REQUIRED'; end if;
 if company is null then
  insert into public.site_progress_companies(name,site,supervisor_id,active,reminder_enabled,reminder_time,work_days)
  values(trim(company_name),site_code,supervisor,is_active,reminders,reminder_at,days) returning * into result;
 else
  update public.site_progress_companies set name=trim(company_name),site=site_code,supervisor_id=supervisor,
  active=is_active,reminder_enabled=reminders,reminder_time=reminder_at,work_days=days where id=company returning * into result;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
  update site_progress_private.contacts set active=false where company_id=company and kind='supervisor' and user_id is distinct from supervisor;
 end if;
 return result;
end $$;
create function public.site_progress_save_company(company uuid,company_name text,site_code text,supervisor uuid,
 is_active boolean,reminders boolean,reminder_at time,days integer[]) returns public.site_progress_companies
language sql security invoker set search_path='' as $$
 select site_progress_private.save_company(company,company_name,site_code,supervisor,is_active,reminders,reminder_at,days) $$;

create function site_progress_private.invite(company uuid,contact_kind text) returns text
language plpgsql security definer set search_path='' as $$
declare c public.site_progress_companies; token text:=encode(extensions.gen_random_bytes(24),'hex');
begin
 perform site_progress_private.require_member();
 select * into c from public.site_progress_companies where id=company and active;
 if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
 if contact_kind='supplier' then
  if public.site_role()<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 elsif contact_kind='supervisor' then
  if c.supervisor_id is distinct from auth.uid() then raise exception 'SUPERVISOR_REQUIRED' using errcode='42501'; end if;
 else raise exception 'INVALID_CONTACT'; end if;
 insert into site_progress_private.invites(token_hash,company_id,kind,user_id)
 values(encode(extensions.digest(token,'sha256'),'hex'),company,contact_kind,case when contact_kind='supervisor' then auth.uid() end);
 return token;
end $$;
create function public.site_progress_invite(company uuid,contact_kind text) returns text language sql security invoker set search_path='' as $$
 select site_progress_private.invite(company,contact_kind) $$;

create function site_progress_private.submit(company uuid,day date,lines jsonb,work_none boolean,memo text,expected integer)
returns public.site_progress_reports language plpgsql security definer set search_path='' as $$
declare c public.site_progress_companies; old public.site_progress_reports; result public.site_progress_reports;
begin
 perform site_progress_private.require_member();
 select * into c from public.site_progress_companies where id=company and active;
 if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
 if public.site_role()<>'admin' and c.supervisor_id is distinct from auth.uid() then raise exception 'SUBMIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 perform site_progress_private.validate_result(day,lines,work_none,memo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(company::text||':'||day::text,0));
 select * into old from public.site_progress_reports where company_id=company and work_date=day for update;
 if expected is null or expected<>coalesce(old.version,0) then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 if old.state='approved' then raise exception 'APPROVED_RESULT_LOCKED'; end if;
 insert into public.site_progress_reports(company_id,work_date,items,no_work,note,source,submitted_by,version)
 values(company,day,lines,work_none,memo,'web',auth.uid(),coalesce(old.version,0)+1)
 on conflict(company_id,work_date) do update set items=excluded.items,no_work=excluded.no_work,note=excluded.note,
 state='pending',source='web',submitted_by=auth.uid(),raw_text='',version=excluded.version,updated_at=now(),review_note='',reviewed_by=null,reviewed_at=null
 returning * into result;
 insert into site_progress_private.audit(report_id,changed_by,action,before_value,after_value)
 values(result.id,auth.uid(),'submit',case when old.id is not null then to_jsonb(old) end,to_jsonb(result));
 return result;
end $$;
create function public.site_progress_submit(company uuid,day date,lines jsonb,work_none boolean,memo text,expected integer)
returns public.site_progress_reports language sql security invoker set search_path='' as $$
 select site_progress_private.submit(company,day,lines,work_none,memo,expected) $$;

create function site_progress_private.review(report uuid,expected integer,decision text,memo text)
returns public.site_progress_reports language plpgsql security definer set search_path='' as $$
declare old public.site_progress_reports; result public.site_progress_reports;
begin
 perform site_progress_private.require_member();
 select * into old from public.site_progress_reports where id=report for update;
 if not found then raise exception 'REPORT_NOT_FOUND'; end if;
 if not exists(select 1 from public.site_progress_companies c where c.id=old.company_id and c.active and c.supervisor_id=auth.uid())
 then raise exception 'SUPERVISOR_REQUIRED' using errcode='42501'; end if;
 if expected is null or expected<>old.version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 if decision not in ('approved','returned') or decision is null or memo is null or length(memo)>2000 then raise exception 'INVALID_REVIEW'; end if;
 if decision='approved' and old.state<>'pending' then raise exception 'PENDING_REQUIRED'; end if;
 if decision='returned' and length(trim(memo))=0 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
 update public.site_progress_reports set state=decision,review_note=memo,version=version+1,updated_at=now(),
 reviewed_by=case when decision='approved' then auth.uid() end,reviewed_at=case when decision='approved' then now() end
 where id=report returning * into result;
 insert into site_progress_private.audit(report_id,changed_by,action,before_value,after_value)
 values(report,auth.uid(),decision,to_jsonb(old),to_jsonb(result));
 insert into site_progress_private.outbox(company_id,work_date,contact_id,kind,report_version,message)
 select result.company_id,result.work_date,t.id,decision,result.version,
 '[사이트원] '||result.work_date::text||' 공사 실적이 '||case when decision='approved' then '승인되어 정식 등록되었습니다.' else '보완 요청되었습니다. 사유: '||memo||E'\n수정 후 /수정 양식으로 다시 전송해 주세요.' end
 from site_progress_private.contacts t where t.company_id=result.company_id and t.kind='supplier' and t.active
 on conflict do nothing;
 return result;
end $$;
create function public.site_progress_review(report uuid,expected integer,decision text,memo text)
returns public.site_progress_reports language sql security invoker set search_path='' as $$
 select site_progress_private.review(report,expected,decision,memo) $$;

create function site_progress_private.bot_config(values_json jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text;v text;s uuid; result jsonb;
begin
 perform site_progress_private.require_service();
 if values_json is not null then
  for k,v in select key,value from jsonb_each_text(values_json) loop
   if k not in ('site_progress_bot_token','site_progress_bot_username','site_progress_webhook_secret') then raise exception 'INVALID_SECRET'; end if;
   select id into s from vault.secrets where name=k;
   if s is null then perform vault.create_secret(v,k); else perform vault.update_secret(s,v,k); end if;
  end loop;
 end if;
 select coalesce(jsonb_object_agg(name,decrypted_secret),'{}') into result from vault.decrypted_secrets
 where name in ('site_progress_bot_token','site_progress_bot_username','site_progress_webhook_secret','site_progress_cron_secret');
 return result;
end $$;
create function public.site_progress_bot_config(values_json jsonb default null) returns jsonb
language sql security invoker set search_path='' as $$select site_progress_private.bot_config(values_json)$$;

create function site_progress_private.bot_receive(event_id bigint,chat bigint,display text,invite_token text,
 day date,lines jsonb,work_none boolean,memo text,raw text,is_revision boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved site_progress_private.bot_events; iv site_progress_private.invites; co site_progress_private.contacts;
 c public.site_progress_companies; old public.site_progress_reports; result public.site_progress_reports; reply text;
begin
 perform site_progress_private.require_service();
 perform pg_catalog.pg_advisory_xact_lock(event_id);
 select * into saved from site_progress_private.bot_events where update_id=event_id;
 if found then return jsonb_build_object('reply',saved.reply,'sent',saved.reply_sent); end if;
 if invite_token is not null then
  select * into iv from site_progress_private.invites where token_hash=encode(extensions.digest(invite_token,'sha256'),'hex')
  and expires_at>now() and used_at is null for update;
  if not found then reply:='연결 링크가 만료되었거나 이미 사용됐습니다. 사이트원 관리자에게 새 링크를 요청해 주세요.';
  else
   select * into c from public.site_progress_companies where id=iv.company_id and active;
   if c.id is null or (iv.kind='supervisor' and (c.supervisor_id is distinct from iv.user_id or not exists(select 1 from public.site_members where user_id=iv.user_id and role in ('viewer','editor','admin')))) then
    reply:='현재 연결할 수 없는 업체 또는 감독자입니다. 관리자에게 확인해 주세요.';
   elsif iv.kind='supplier' and exists(select 1 from site_progress_private.contacts where chat_id=chat and kind='supplier' and active and company_id<>iv.company_id) then
    reply:='이 계정은 이미 다른 업체에 연결되어 있습니다. 관리자에게 연결 해제를 요청해 주세요.';
   else
    insert into site_progress_private.contacts(company_id,kind,user_id,chat_id,display_name)
    values(iv.company_id,iv.kind,iv.user_id,chat,left(display,120))
    on conflict(company_id,kind,chat_id) do update set active=true,user_id=excluded.user_id,display_name=excluded.display_name;
    update site_progress_private.invites set used_at=now() where token_hash=iv.token_hash;
    reply:=c.name||case when iv.kind='supplier' then ' 실적 전송 계정으로 연결되었습니다. 입력 안내 버튼을 눌러 양식을 확인해 주세요.' else ' 감독자 알림 계정으로 연결되었습니다. 승인은 사이트원에서 처리합니다.' end;
   end if;
  end if;
 else
  select t.* into co from site_progress_private.contacts t join public.site_progress_companies x on x.id=t.company_id
  where t.chat_id=chat and t.kind='supplier' and t.active and x.active limit 1;
  if not found then reply:='업체 연결이 필요합니다. 사이트원 관리자가 발급한 업체 연결 링크를 먼저 열어 주세요.';
  else
   perform site_progress_private.validate_result(day,lines,work_none,memo);
   if raw is null or length(raw)>12000 then raise exception 'INVALID_RESULT'; end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(co.company_id::text||':'||day::text,0));
   select * into old from public.site_progress_reports where company_id=co.company_id and work_date=day for update;
   if old.state='approved' then reply:='이미 승인된 날짜입니다. 수정이 필요하면 감독자에게 보완 요청을 문의해 주세요.';
   elsif old.id is not null and not is_revision then reply:='이 날짜의 실적이 이미 접수되었습니다. 변경하려면 첫 줄에 /수정을 넣고 전체 실적을 다시 전송해 주세요.';
   else
    insert into public.site_progress_reports(company_id,work_date,items,no_work,note,source,raw_text,version)
    values(co.company_id,day,lines,work_none,memo,'telegram',raw,coalesce(old.version,0)+1)
    on conflict(company_id,work_date) do update set items=excluded.items,no_work=excluded.no_work,note=excluded.note,
    source='telegram',raw_text=excluded.raw_text,state='pending',submitted_by=null,version=excluded.version,updated_at=now(),
    reviewed_by=null,reviewed_at=null,review_note='' returning * into result;
    insert into site_progress_private.audit(report_id,action,before_value,after_value)
    values(result.id,'telegram_submit',case when old.id is not null then to_jsonb(old) end,to_jsonb(result));
    reply:=day::text||' 실적을 접수했습니다. 현재 승인 대기이며 감독자 승인 후 정식 등록됩니다.';
   end if;
  end if;
 end if;
 insert into site_progress_private.bot_events(update_id,chat_id,reply) values(event_id,chat,reply);
 return jsonb_build_object('reply',reply,'sent',false);
end $$;
create function public.site_progress_bot_receive(event_id bigint,chat bigint,display text,invite_token text,
 day date,lines jsonb,work_none boolean,memo text,raw text,is_revision boolean) returns jsonb
language sql security invoker set search_path='' as $$
 select site_progress_private.bot_receive(event_id,chat,display,invite_token,day,lines,work_none,memo,raw,is_revision) $$;
create function public.site_progress_bot_ack(event_id bigint) returns void language sql security invoker set search_path='' as $$
 update site_progress_private.bot_events set reply_sent=true where update_id=event_id $$;

create function site_progress_private.queue_reminders() returns void language plpgsql security definer set search_path='' as $$
declare local_now timestamp:=(now() at time zone 'Asia/Seoul');
begin
 insert into site_progress_private.outbox(company_id,work_date,contact_id,kind,report_version,message)
 select c.id,local_now::date,t.id,case when r.state='pending' then 'pending' when r.state='returned' then 'returned' else 'missing' end,
 coalesce(r.version,0),'[사이트원] '||c.name||E'\n'||local_now::date::text||case
 when r.state='pending' then ' 공사 실적이 승인 대기 중입니다. 사이트원 공정별 진행현황에서 확인·승인해 주세요.'
 when r.state='returned' then ' 공사 실적의 보완이 필요합니다. 보완 후 /수정 양식으로 다시 전송해 주세요.'
 else ' 공사 실적이 아직 접수되지 않았습니다. 당일 실적을 전송해 주세요. 작업이 없으면 작업 없음으로 제출해 주세요.' end
 from public.site_progress_companies c left join public.site_progress_reports r on r.company_id=c.id and r.work_date=local_now::date
 join site_progress_private.contacts t on t.company_id=c.id and t.active and
 t.kind=case when r.state='pending' then 'supervisor' else 'supplier' end
 where c.active and c.reminder_enabled and extract(dow from local_now)::integer=any(c.work_days) and local_now::time>=c.reminder_time
 and coalesce(r.state,'missing')<>'approved'
 and (t.kind<>'supervisor' or (t.user_id=c.supervisor_id and exists(select 1 from public.site_members m where m.user_id=t.user_id and m.role in ('viewer','editor','admin'))))
 on conflict do nothing;
end $$;
create function site_progress_private.claim_messages() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform site_progress_private.require_service();
 perform site_progress_private.queue_reminders();
 update site_progress_private.outbox o set state='skipped' where o.state in ('queued','sending') and
 (not exists(select 1 from site_progress_private.contacts t join public.site_progress_companies c on c.id=t.company_id
 where t.id=o.contact_id and t.active and c.active and (t.kind<>'supervisor' or (t.user_id=c.supervisor_id and exists(select 1 from public.site_members m where m.user_id=t.user_id and m.role in ('viewer','editor','admin')))))
 or (o.kind='approved' and not exists(select 1 from public.site_progress_reports r where r.company_id=o.company_id and r.work_date=o.work_date and r.state='approved' and r.version=o.report_version))
 or (o.kind in ('missing','pending','returned') and
 (o.work_date<>(now() at time zone 'Asia/Seoul')::date or
 exists(select 1 from public.site_progress_reports r where r.company_id=o.company_id and r.work_date=o.work_date
 and (r.state='approved' or (o.kind='missing') or (o.kind='pending' and r.state<>'pending') or (o.kind='returned' and r.state<>'returned'))))));
 with claimed as (
 update site_progress_private.outbox o set state='sending',attempts=attempts+1,claimed_at=now()
 where id in (select id from site_progress_private.outbox where attempts<3 and
 (state='queued' or (state='sending' and claimed_at<now()-interval '10 minutes')) order by queued_at for update skip locked limit 20)
 returning o.*)
 select coalesce(jsonb_agg(to_jsonb(claimed)||jsonb_build_object('chat_id',t.chat_id)),'[]') into result
 from claimed join site_progress_private.contacts t on t.id=claimed.contact_id;
 return result;
end $$;
create function public.site_progress_bot_claim() returns jsonb language sql security invoker set search_path='' as $$select site_progress_private.claim_messages()$$;
create function public.site_progress_bot_delivery(message_id uuid,success boolean,error_text text) returns void
language sql security invoker set search_path='' as $$
 update site_progress_private.outbox set state=case when success then 'sent' when attempts>=3 then 'failed' else 'queued' end,
 sent_at=case when success then now() end,error_text=left(coalesce(error_text,''),300)
 where id=message_id and state='sending' $$;

create function site_progress_private.notifications() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();
 return coalesce((select jsonb_agg(to_jsonb(v)) from (select o.id,o.company_id,o.work_date,o.kind,o.state,o.attempts,o.queued_at,o.sent_at,o.error_text
 from site_progress_private.outbox o join public.site_progress_companies c on c.id=o.company_id
 where public.site_role()='admin' or c.supervisor_id=auth.uid() order by o.queued_at desc limit 100) v),'[]');
end $$;
create function public.site_progress_notifications() returns jsonb language sql security invoker set search_path='' as $$select site_progress_private.notifications()$$;
create function site_progress_private.disconnect(company uuid,contact_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();
 if public.site_role()<>'admin' or contact_kind not in ('supplier','supervisor') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 update site_progress_private.contacts set active=false where company_id=company and kind=contact_kind;
 update site_progress_private.invites set used_at=now() where company_id=company and kind=contact_kind and used_at is null;
end $$;
create function public.site_progress_disconnect(company uuid,contact_kind text) returns void language sql security invoker set search_path='' as $$select site_progress_private.disconnect(company,contact_kind)$$;

-- Only private, explicitly authorized operations can mutate reports; public entrypoints are invoker wrappers.
revoke all on all functions in schema site_progress_private from public,anon,authenticated;
grant execute on function site_progress_private.context(),site_progress_private.save_company(uuid,text,text,uuid,boolean,boolean,time,integer[]),
 site_progress_private.invite(uuid,text),site_progress_private.submit(uuid,date,jsonb,boolean,text,integer),
 site_progress_private.review(uuid,integer,text,text),site_progress_private.notifications(),site_progress_private.disconnect(uuid,text),
 site_progress_private.require_member() to authenticated;
grant execute on all functions in schema site_progress_private to service_role;
revoke all on function public.site_progress_context(),public.site_progress_save_company(uuid,text,text,uuid,boolean,boolean,time,integer[]),
 public.site_progress_invite(uuid,text),public.site_progress_submit(uuid,date,jsonb,boolean,text,integer),public.site_progress_review(uuid,integer,text,text),
 public.site_progress_notifications(),public.site_progress_disconnect(uuid,text) from public,anon,authenticated;
grant execute on function public.site_progress_context(),public.site_progress_save_company(uuid,text,text,uuid,boolean,boolean,time,integer[]),
 public.site_progress_invite(uuid,text),public.site_progress_submit(uuid,date,jsonb,boolean,text,integer),public.site_progress_review(uuid,integer,text,text),
 public.site_progress_notifications(),public.site_progress_disconnect(uuid,text) to authenticated;
revoke all on function public.site_progress_bot_config(jsonb),public.site_progress_bot_receive(bigint,bigint,text,text,date,jsonb,boolean,text,text,boolean),
 public.site_progress_bot_ack(bigint),public.site_progress_bot_claim(),public.site_progress_bot_delivery(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.site_progress_bot_config(jsonb),public.site_progress_bot_receive(bigint,bigint,text,text,date,jsonb,boolean,text,text,boolean),
 public.site_progress_bot_ack(bigint),public.site_progress_bot_claim(),public.site_progress_bot_delivery(uuid,boolean,text) to service_role;

-- Scheduler is inert until the bot is configured and a company explicitly enables reminders.
create extension if not exists pg_net;
create extension if not exists pg_cron;
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'site_progress_cron_secret');
create function site_progress_private.dispatch() returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from vault.secrets where name='site_progress_bot_token') then return; end if;
 perform net.http_post(url:='https://qbrwzldrlwtiawgzwvit.supabase.co/functions/v1/site-process-bot',
 headers:=jsonb_build_object('Content-Type','application/json','X-Site-Progress-Cron',(select decrypted_secret from vault.decrypted_secrets where name='site_progress_cron_secret')),
 body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=10000);
end $$;
revoke all on function site_progress_private.dispatch() from public,anon,authenticated,service_role;
select cron.schedule('site-progress-notifications','*/5 * * * *','select site_progress_private.dispatch()');
notify pgrst,'reload schema';
commit;
