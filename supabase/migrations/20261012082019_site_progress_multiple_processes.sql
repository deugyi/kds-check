-- Allow non-overlapping processes on the same company/work date, retaining report IDs and approvals.
begin;
set local lock_timeout='10s';

alter table public.site_progress_reports drop constraint site_progress_reports_company_id_work_date_key;
create index progress_report_company_date on public.site_progress_reports(company_id,work_date);
alter table site_progress_private.outbox add column report_id uuid references public.site_progress_reports(id);
update site_progress_private.outbox o set report_id=r.id from public.site_progress_reports r
where o.company_id=r.company_id and o.work_date=r.work_date and o.kind<>'missing';
alter table site_progress_private.outbox drop constraint outbox_company_id_work_date_contact_id_kind_report_version_key;
create unique index progress_outbox_report_dedupe on site_progress_private.outbox
(company_id,work_date,contact_id,kind,coalesce(report_id,'00000000-0000-0000-0000-000000000000'::uuid),report_version);
create index progress_outbox_report on site_progress_private.outbox(report_id);

create function site_progress_private.processes(lines jsonb) returns text[]
language sql immutable security invoker set search_path='' as $$
 select coalesce(array_agg(distinct btrim(v->>'process') order by btrim(v->>'process')),'{}'::text[])
 from jsonb_array_elements(lines) v $$;
revoke all on function site_progress_private.processes(jsonb) from public,anon,authenticated,service_role;

-- Owner-only helper; callers verify member/supplier identity before reaching it.
create function site_progress_private.store_report(company uuid,day date,lines jsonb,work_none boolean,memo text,
 report uuid,expected integer,source_code text,raw_text text,actor uuid)
returns public.site_progress_reports language plpgsql security invoker set search_path='' as $$
declare old public.site_progress_reports; result public.site_progress_reports; names text[];
begin
 perform site_progress_private.validate_result(day,lines,work_none,memo);
 names:=site_progress_private.processes(lines);
 if ''=any(names) or source_code not in ('web','telegram') or source_code is null or raw_text is null or length(raw_text)>12000
 then raise exception 'INVALID_RESULT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(company::text||':'||day::text,0));
 if report is not null then
  select * into old from public.site_progress_reports where id=report and company_id=company and work_date=day for update;
  if not found then raise exception 'REPORT_NOT_FOUND'; end if;
 end if;
 if expected is null or expected<>coalesce(old.version,0) then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 if old.state='approved' then raise exception 'APPROVED_RESULT_LOCKED'; end if;
 if exists(select 1 from public.site_progress_reports r where r.company_id=company and r.work_date=day
 and r.id is distinct from report and (work_none or r.no_work)) then raise exception 'NO_WORK_CONFLICT'; end if;
 if exists(select 1 from public.site_progress_reports r where r.company_id=company and r.work_date=day
 and r.id is distinct from report and site_progress_private.processes(r.items)&&names) then raise exception 'PROCESS_ALREADY_REPORTED'; end if;
 if report is null then
  insert into public.site_progress_reports(company_id,work_date,items,no_work,note,source,raw_text,submitted_by)
  values(company,day,lines,work_none,memo,source_code,raw_text,actor) returning * into result;
 else
  update public.site_progress_reports set items=lines,no_work=work_none,note=memo,source=source_code,
  raw_text=store_report.raw_text,submitted_by=actor,state='pending',version=version+1,updated_at=now(),
  review_note='',reviewed_by=null,reviewed_at=null where id=report returning * into result;
 end if;
 insert into site_progress_private.audit(report_id,changed_by,action,before_value,after_value)
 values(result.id,actor,case when source_code='telegram' then 'telegram_submit' else 'submit' end,
 case when old.id is not null then to_jsonb(old) end,to_jsonb(result));
 return result;
end $$;
revoke all on function site_progress_private.store_report(uuid,date,jsonb,boolean,text,uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;

create function site_progress_private.submit_report(company uuid,day date,lines jsonb,work_none boolean,memo text,expected integer,report uuid)
returns public.site_progress_reports language plpgsql security definer set search_path='' as $$
declare c public.site_progress_companies;
begin
 perform site_progress_private.require_member();
 select * into c from public.site_progress_companies where id=company and active;
 if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
 if public.site_role()<>'admin' and c.supervisor_id is distinct from auth.uid() then raise exception 'SUBMIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 return site_progress_private.store_report(company,day,lines,work_none,memo,report,expected,'web','',auth.uid());
end $$;
create function public.site_progress_submit_report(company uuid,day date,lines jsonb,work_none boolean,memo text,expected integer,report uuid)
returns public.site_progress_reports language sql security invoker set search_path='' as $$
 select site_progress_private.submit_report(company,day,lines,work_none,memo,expected,report) $$;
revoke all on function site_progress_private.submit_report(uuid,date,jsonb,boolean,text,integer,uuid),
 public.site_progress_submit_report(uuid,date,jsonb,boolean,text,integer,uuid) from public,anon,authenticated;
grant execute on function site_progress_private.submit_report(uuid,date,jsonb,boolean,text,integer,uuid),
 public.site_progress_submit_report(uuid,date,jsonb,boolean,text,integer,uuid) to authenticated,service_role;

-- Preserve the older RPC for cached clients. Ambiguous edits must reload and use an explicit report ID.
create or replace function site_progress_private.submit(company uuid,day date,lines jsonb,work_none boolean,memo text,expected integer)
returns public.site_progress_reports language plpgsql security definer set search_path='' as $$
declare target uuid; c public.site_progress_companies;
begin
 perform site_progress_private.require_member();
 select * into c from public.site_progress_companies where id=company and active;
 if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
 if public.site_role()<>'admin' and c.supervisor_id is distinct from auth.uid() then raise exception 'SUBMIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(company::text||':'||day::text,0));
 if expected>0 then
  if (select count(*) from public.site_progress_reports where company_id=company and work_date=day)<>1
  then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
  select id into target from public.site_progress_reports where company_id=company and work_date=day;
 end if;
 return site_progress_private.submit_report(company,day,lines,work_none,memo,expected,target);
end $$;

create or replace function site_progress_private.review(report uuid,expected integer,decision text,memo text)
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
 insert into site_progress_private.outbox(company_id,work_date,contact_id,kind,report_id,report_version,message)
 select result.company_id,result.work_date,t.id,decision,result.id,result.version,
 '[사이트원] '||result.work_date::text||' '||case when result.no_work then '작업 없음' else array_to_string(site_progress_private.processes(result.items),', ') end||' 실적이 '||
 case when decision='approved' then '감독자 승인을 받아 승인됨·정식 등록 상태로 변경되었습니다.' else '보완 요청되었습니다. 사유: '||memo||E'\n해당 공종의 전체 항목을 /수정 양식으로 다시 전송해 주세요.' end
 from site_progress_private.contacts t where t.company_id=result.company_id and t.kind='supplier' and t.active
 on conflict do nothing;
 return result;
end $$;

create or replace function site_progress_private.bot_receive(event_id bigint,chat bigint,display text,invite_token text,
 day date,lines jsonb,work_none boolean,memo text,raw text,is_revision boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved site_progress_private.bot_events; iv site_progress_private.invites; co site_progress_private.contacts;
 c public.site_progress_companies; old public.site_progress_reports; result public.site_progress_reports; reply text; names text[];
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
   if raw is null or length(raw)>12000 or is_revision is null then raise exception 'INVALID_RESULT'; end if;
   names:=site_progress_private.processes(lines);
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(co.company_id::text||':'||day::text,0));
   if is_revision then
    select * into old from public.site_progress_reports r where r.company_id=co.company_id and r.work_date=day
    and r.no_work=work_none and site_progress_private.processes(r.items)=names for update;
    if not found then reply:='수정할 해당 날짜·공종의 실적이 없습니다. 새 공종 실적은 /수정을 빼고 전송해 주세요. 공종을 변경하거나 일부 항목을 삭제하려면 사이트원에서 기존 건을 보완해 주세요.';
    elsif old.state='approved' then reply:='이 날짜·공종의 실적은 이미 승인됐습니다. 수정이 필요하면 감독자에게 보완 요청을 문의해 주세요.'; end if;
   end if;
   if reply is null then
    begin
     result:=site_progress_private.store_report(co.company_id,day,lines,work_none,memo,old.id,coalesce(old.version,0),'telegram',raw,null);
     reply:=day::text||' '||case when work_none then '작업 없음' else array_to_string(names,', ') end||' 실적을 접수했습니다. 현재 상태는 감독자 승인 대기입니다. 감독자가 승인하면 승인됨으로 표시되고 정식 등록됩니다.';
    exception when raise_exception then
     if SQLERRM='PROCESS_ALREADY_REPORTED' then reply:='이 날짜의 해당 공종 실적이 이미 접수됐습니다. 수정하려면 /수정과 날짜, 해당 공종의 전체 항목을 전송해 주세요. 승인된 건은 감독자의 보완 요청 후 수정할 수 있습니다.';
     elsif SQLERRM='NO_WORK_CONFLICT' then reply:='작업 없음과 실제 실적을 같은 날짜에 함께 등록할 수 없습니다. 사이트원에서 기존 건을 보완해 주세요.';
     else raise; end if;
    end;
   end if;
  end if;
 end if;
 insert into site_progress_private.bot_events(update_id,chat_id,reply) values(event_id,chat,reply);
 return jsonb_build_object('reply',reply,'sent',false);
end $$;

create or replace function site_progress_private.queue_reminders() returns void language plpgsql security definer set search_path='' as $$
declare local_now timestamp:=(now() at time zone 'Asia/Seoul');
begin
 insert into site_progress_private.outbox(company_id,work_date,contact_id,kind,report_id,report_version,message)
 select c.id,local_now::date,t.id,case when r.state='pending' then 'pending' when r.state='returned' then 'returned' else 'missing' end,
 r.id,coalesce(r.version,0),'[사이트원] '||c.name||E'\n'||local_now::date::text||case
 when r.state='pending' then ' '||case when r.no_work then '작업 없음' else array_to_string(site_progress_private.processes(r.items),', ') end||' 실적이 감독자 승인 대기 상태입니다. 사이트원 공정별 진행현황에서 확인·승인해 주세요.'
 when r.state='returned' then ' '||case when r.no_work then '작업 없음' else array_to_string(site_progress_private.processes(r.items),', ') end||' 실적의 보완이 필요합니다. 해당 공종의 전체 항목을 /수정 양식으로 다시 전송해 주세요.'
 else ' 공사 실적이 아직 접수되지 않았습니다. 당일 실적을 전송해 주세요. 작업이 없으면 작업 없음으로 제출해 주세요.' end
 from public.site_progress_companies c left join public.site_progress_reports r on r.company_id=c.id and r.work_date=local_now::date
 join site_progress_private.contacts t on t.company_id=c.id and t.active and
 t.kind=case when r.state='pending' then 'supervisor' else 'supplier' end
 where c.active and c.reminder_enabled and extract(dow from local_now)::integer=any(c.work_days) and local_now::time>=c.reminder_time
 and coalesce(r.state,'missing')<>'approved'
 and (t.kind<>'supervisor' or (t.user_id=c.supervisor_id and exists(select 1 from public.site_members m where m.user_id=t.user_id and m.role in ('viewer','editor','admin'))))
 on conflict do nothing;
end $$;

create or replace function site_progress_private.claim_messages() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform site_progress_private.require_service();
 perform site_progress_private.queue_reminders();
 update site_progress_private.outbox o set state='skipped' where o.state in ('queued','sending') and
 (not exists(select 1 from site_progress_private.contacts t join public.site_progress_companies c on c.id=t.company_id
 where t.id=o.contact_id and t.active and c.active and (t.kind<>'supervisor' or (t.user_id=c.supervisor_id and exists(select 1 from public.site_members m where m.user_id=t.user_id and m.role in ('viewer','editor','admin')))))
 or (o.kind='missing' and (o.work_date<>(now() at time zone 'Asia/Seoul')::date or exists(select 1 from public.site_progress_reports r where r.company_id=o.company_id and r.work_date=o.work_date)))
 or (o.kind in ('pending','returned') and (o.work_date<>(now() at time zone 'Asia/Seoul')::date or not exists(
 select 1 from public.site_progress_reports r where r.id=o.report_id and r.company_id=o.company_id and r.work_date=o.work_date and r.state=o.kind and r.version=o.report_version)))
 or (o.kind='approved' and not exists(select 1 from public.site_progress_reports r where r.id=o.report_id and r.company_id=o.company_id and r.work_date=o.work_date and r.state='approved' and r.version=o.report_version)));
 with claimed as (
 update site_progress_private.outbox o set state='sending',attempts=attempts+1,claimed_at=now()
 where id in (select id from site_progress_private.outbox where attempts<3 and
 (state='queued' or (state='sending' and claimed_at<now()-interval '10 minutes')) order by queued_at for update skip locked limit 20)
 returning o.*)
 select coalesce(jsonb_agg(to_jsonb(claimed)||jsonb_build_object('chat_id',t.chat_id)),'[]') into result
 from claimed join site_progress_private.contacts t on t.id=claimed.contact_id;
 return result;
end $$;

create or replace function site_progress_private.notifications() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();
 return coalesce((select jsonb_agg(to_jsonb(v)) from (select o.id,o.company_id,o.work_date,o.kind,o.state,o.attempts,o.queued_at,o.sent_at,o.error_text,o.report_id,
 case when r.no_work then array['작업 없음'] else site_progress_private.processes(coalesce(r.items,'[]'::jsonb)) end as processes
 from site_progress_private.outbox o join public.site_progress_companies c on c.id=o.company_id left join public.site_progress_reports r on r.id=o.report_id
 where public.site_role()='admin' or c.supervisor_id=auth.uid() order by o.queued_at desc limit 100) v),'[]');
end $$;

notify pgrst,'reload schema';
commit;
