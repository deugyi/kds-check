-- Transactional integration checks using existing approved accounts; all fixtures are rolled back.
begin;
select set_config('test.progress.admin',(select user_id::text from public.site_members where role='admin' order by created_at limit 1),true);
select set_config('test.progress.viewer',(select user_id::text from public.site_members where role='viewer' order by created_at limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.progress.admin'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('test.progress.company',(public.site_progress_save_company(null,'검증용 '||gen_random_uuid()::text,'south',current_setting('test.progress.admin')::uuid,true,true,'00:00',array[0,1,2,3,4,5,6])).id::text,true);
select set_config('test.progress.supplier_invite',public.site_progress_invite(current_setting('test.progress.company')::uuid,'supplier'),true);
select set_config('test.progress.supervisor_invite',public.site_progress_invite(current_setting('test.progress.company')::uuid,'supervisor'),true);
select set_config('test.progress.report',(public.site_progress_submit(current_setting('test.progress.company')::uuid,(now() at time zone 'Asia/Seoul')::date-1,
 '[{"floor":"지하1층","zone":"B2","process":"철골보","quantity":20,"unit":"부재"}]',false,'검증',0)).id::text,true);
do $$begin
 if (select state from public.site_progress_reports where id=current_setting('test.progress.report')::uuid)<>'pending' then raise exception 'FAIL_PENDING'; end if;
 begin perform public.site_progress_submit(current_setting('test.progress.company')::uuid,(now() at time zone 'Asia/Seoul')::date-1,'[]',true,'잘못된 버전',0);raise exception 'FAIL_CONFLICT';exception when serialization_failure then null;end;
 begin update public.site_progress_reports set state='approved' where id=current_setting('test.progress.report')::uuid;raise exception 'FAIL_DIRECT_WRITE';exception when insufficient_privilege then null;end;
 begin perform public.site_progress_bot_config();raise exception 'FAIL_SECRET_ACCESS';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.progress.viewer'),'role','authenticated')::text,true);
do $$begin
 if (select count(*) from public.site_progress_reports where id=current_setting('test.progress.report')::uuid)<>0 then raise exception 'FAIL_PRIVATE_PENDING'; end if;
 begin perform public.site_progress_review(current_setting('test.progress.report')::uuid,1,'approved','');raise exception 'FAIL_OTHER_SUPERVISOR';exception when insufficient_privilege then null;end;
 begin perform public.site_progress_submit(current_setting('test.progress.company')::uuid,(now() at time zone 'Asia/Seoul')::date,'[]',true,'',0);raise exception 'FAIL_OTHER_SUBMIT';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.progress.admin'),'role','authenticated')::text,true);
select public.site_progress_review(current_setting('test.progress.report')::uuid,1,'approved','');
do $$begin
 begin perform public.site_progress_submit(current_setting('test.progress.company')::uuid,(now() at time zone 'Asia/Seoul')::date-1,'[]',true,'',2);raise exception 'FAIL_APPROVED_EDIT';exception when raise_exception then if SQLERRM<>'APPROVED_RESULT_LOCKED' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.progress.viewer'),'role','authenticated')::text,true);
do $$begin
 if (select count(*) from public.site_progress_reports where id=current_setting('test.progress.report')::uuid and state='approved')<>1 then raise exception 'FAIL_APPROVED_VISIBLE'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.progress.admin'),'role','authenticated')::text,true);
select public.site_progress_review(current_setting('test.progress.report')::uuid,2,'returned','수량 확인');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.progress.viewer'),'role','authenticated')::text,true);
do $$begin
 if (select count(*) from public.site_progress_reports where id=current_setting('test.progress.report')::uuid)<>0 then raise exception 'FAIL_RETURNED_HIDDEN'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.site_progress_bot_receive(990001,90001,'검증 담당자',current_setting('test.progress.supplier_invite'),null,'[]',false,'','',false);
select public.site_progress_bot_receive(990002,90002,'검증 감독자',current_setting('test.progress.supervisor_invite'),null,'[]',false,'','',false);
do $$declare messages jsonb;begin
 messages:=public.site_progress_bot_claim();
 if not exists(select 1 from jsonb_array_elements(messages) e where e->>'kind'='missing' and e->>'chat_id'='90001') then raise exception 'FAIL_MISSING_REMINDER'; end if;
end $$;
select public.site_progress_bot_receive(990003,90001,'검증 담당자',null,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"철골보","quantity":20,"unit":"부재"}]',false,'','검증 원문',false);
select public.site_progress_bot_receive(990003,90001,'검증 담당자',null,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"철골보","quantity":999,"unit":"부재"}]',false,'','중복 재시도',false);
do $$declare messages jsonb;begin
 if not exists(select 1 from public.site_progress_reports where company_id=current_setting('test.progress.company')::uuid and work_date=(now() at time zone 'Asia/Seoul')::date and version=1 and items->0->>'quantity'='20' and state='pending') then raise exception 'FAIL_BOT_DEDUPLICATION'; end if;
 messages:=public.site_progress_bot_claim();
 if not exists(select 1 from jsonb_array_elements(messages) e where e->>'kind'='pending' and e->>'chat_id'='90002') then raise exception 'FAIL_SUPERVISOR_REMINDER'; end if;
 if exists(select 1 from site_progress_private.outbox where company_id=current_setting('test.progress.company')::uuid and kind='missing' and state<>'skipped') then raise exception 'FAIL_SUPPLIER_STOP'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.progress.admin'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('test.progress.today',(select id::text from public.site_progress_reports where company_id=current_setting('test.progress.company')::uuid and work_date=(now() at time zone 'Asia/Seoul')::date),true);
select public.site_progress_review(current_setting('test.progress.today')::uuid,1,'approved','');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$declare messages jsonb;begin
 messages:=public.site_progress_bot_claim();
 if not exists(select 1 from jsonb_array_elements(messages) e where e->>'kind'='approved' and e->>'chat_id'='90001') then raise exception 'FAIL_APPROVAL_NOTICE'; end if;
 if exists(select 1 from site_progress_private.outbox where company_id=current_setting('test.progress.company')::uuid and kind in ('missing','pending') and state in ('queued','sending')) then raise exception 'FAIL_APPROVED_REMINDER_STOP'; end if;
 if (select count(*) from site_progress_private.audit where report_id=current_setting('test.progress.today')::uuid)<>2 then raise exception 'FAIL_APPROVAL_AUDIT'; end if;
end $$;
rollback;
select 'PASS: pending/approved RLS, supervisor-only review, conflict protection, immutable approval, bot pairing/deduplication, reminder routing/stopping, audit; all fixtures rolled back' as result;
