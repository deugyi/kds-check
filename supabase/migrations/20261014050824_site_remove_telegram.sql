-- Remove Telegram operations without deleting existing companies, results or audit history.
begin;
do $$begin
 if to_regclass('cron.job') is not null then
  perform cron.unschedule(jobid) from cron.job where jobname='site-progress-notifications';
 end if;
end $$;
update site_progress_private.contacts set active=false where active;
update site_progress_private.invites set used_at=now() where used_at is null;
update site_progress_private.outbox set state='skipped',error_text='텔레그램 기능 종료'
 where state in ('queued','sending');

create or replace function site_progress_private.context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform site_progress_private.require_member();
 return jsonb_build_object('companies',coalesce((select jsonb_agg(to_jsonb(c)-'reminder_enabled'-'reminder_time'-'work_days')
 from public.site_progress_companies c),'[]'),
 'members',case when public.site_role()='admin' then coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'email',email))
 from public.site_members where role in ('viewer','editor','admin')),'[]') else '[]'::jsonb end);
end $$;

-- Remove the cached-client RPC too, so obsolete settings cannot reactivate reminders.
drop function public.site_progress_save_company(uuid,text,text,uuid,boolean,boolean,time,integer[]);
drop function site_progress_private.save_company(uuid,text,text,uuid,boolean,boolean,time,integer[]);
create function site_progress_private.save_company(company uuid,company_name text,site_code text,supervisor uuid,is_active boolean)
returns public.site_progress_companies language plpgsql security definer set search_path='' as $$
declare result public.site_progress_companies;
begin
 perform site_progress_private.require_member();
 if public.site_role()<>'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if company_name is null or length(trim(company_name)) not between 1 and 100 or site_code not in ('south','north')
 or site_code is null or is_active is null then raise exception 'INVALID_COMPANY'; end if;
 if supervisor is not null and not exists(select 1 from public.site_members where user_id=supervisor and role in ('viewer','editor','admin'))
 then raise exception 'SUPERVISOR_ACCESS_REQUIRED'; end if;
 if company is null then
  insert into public.site_progress_companies(name,site,supervisor_id,active)
  values(trim(company_name),site_code,supervisor,is_active) returning * into result;
 else
  update public.site_progress_companies set name=trim(company_name),site=site_code,supervisor_id=supervisor,active=is_active
  where id=company returning * into result;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
 end if;
 return result;
end $$;
create function public.site_progress_save_company(company uuid,company_name text,site_code text,supervisor uuid,is_active boolean)
returns public.site_progress_companies language sql security invoker set search_path='' as $$
 select site_progress_private.save_company(company,company_name,site_code,supervisor,is_active) $$;
revoke all on function site_progress_private.save_company(uuid,text,text,uuid,boolean),public.site_progress_save_company(uuid,text,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function site_progress_private.save_company(uuid,text,text,uuid,boolean),public.site_progress_save_company(uuid,text,text,uuid,boolean) to authenticated,service_role;

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
 return result;
end $$;

create or replace function site_progress_private.store_report(company uuid,day date,lines jsonb,work_none boolean,memo text,
 report uuid,expected integer,source_code text,raw_text text,actor uuid,plan_ref uuid,plan_expected integer,feedback jsonb)
returns public.site_progress_reports language plpgsql security invoker set search_path='' as $$
declare old public.site_progress_reports; result public.site_progress_reports; names text[]; p public.site_progress_plans;
begin
 perform site_progress_private.validate_result(day,lines,work_none,memo);
 names:=site_progress_private.processes(lines);
 if ''=any(names) or source_code not in ('web','kakao') or source_code is null or raw_text is null or length(raw_text)>12000
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

-- Historical Telegram sources remain readable and approvable, but new Telegram results are rejected.
create function site_progress_private.reject_retired_source() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.source='telegram' then
  if tg_op='INSERT' then raise exception 'INTEGRATION_REMOVED';
  elsif new.source is distinct from old.source then raise exception 'INTEGRATION_REMOVED'; end if;
 end if;
 return new;
end $$;
revoke all on function site_progress_private.reject_retired_source() from public,anon,authenticated,service_role;
create trigger progress_reject_retired_source before insert or update of source on public.site_progress_reports
 for each row execute function site_progress_private.reject_retired_source();

drop function public.site_progress_invite(uuid,text);
drop function public.site_progress_disconnect(uuid,text);
drop function public.site_progress_notifications();
drop function public.site_progress_bot_receive(bigint,bigint,text,text,date,jsonb,boolean,text,text,boolean);
drop function public.site_progress_bot_ack(bigint);
drop function public.site_progress_bot_claim();
drop function public.site_progress_bot_delivery(uuid,boolean,text);
drop function public.site_progress_bot_config(jsonb);
drop function site_progress_private.invite(uuid,text);
drop function site_progress_private.disconnect(uuid,text);
drop function site_progress_private.notifications();
drop function site_progress_private.bot_receive(bigint,bigint,text,text,date,jsonb,boolean,text,text,boolean);
drop function site_progress_private.claim_messages();
drop function site_progress_private.queue_reminders();
drop function if exists site_progress_private.dispatch();
drop function site_progress_private.bot_config(jsonb);

-- Dedicated Telegram credentials only; the Kakao skill key and configuration are untouched.
delete from vault.secrets where name in ('site_progress_bot_token','site_progress_bot_username','site_progress_webhook_secret','site_progress_cron_secret');
notify pgrst,'reload schema';
commit;
