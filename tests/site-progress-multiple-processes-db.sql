-- Same-day process isolation, approval and reminder checks. No real Telegram messages are sent.
begin;
select set_config('test.multi.admin',(select user_id::text from public.site_members where role='admin' order by created_at limit 1),true);
select set_config('test.multi.viewer',(select user_id::text from public.site_members where role='viewer' order by created_at limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.multi.admin'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('test.multi.company',(public.site_progress_save_company(null,'공종별 검증 '||gen_random_uuid()::text,'south',current_setting('test.multi.admin')::uuid,true,true,'00:00',array[0,1,2,3,4,5,6])).id::text,true);
select set_config('test.multi.supplier',public.site_progress_invite(current_setting('test.multi.company')::uuid,'supplier'),true);
select set_config('test.multi.supervisor',public.site_progress_invite(current_setting('test.multi.company')::uuid,'supervisor'),true);
select set_config('test.multi.steel',(public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"철골보","quantity":20,"unit":"부재"}]',false,'',0,null)).id::text,true);
select set_config('test.multi.concrete',(public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"콘크리트 타설","quantity":35,"unit":"m³"}]',false,'',0,null)).id::text,true);
select set_config('test.multi.soil',(public.site_progress_submit(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"외부","zone":"전체","process":"토사 반출","quantity":120,"unit":"m³"}]',false,'',0)).id::text,true);
do $$begin
 if (select count(*) from public.site_progress_reports where company_id=current_setting('test.multi.company')::uuid)<>3 then raise exception 'FAIL_SAME_DAY_PROCESSES'; end if;
 begin perform public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하2층","zone":"A1","process":"철골보","quantity":999,"unit":"부재"}]',false,'',0,null);
 raise exception 'FAIL_DUPLICATE_PROCESS'; exception when raise_exception then if SQLERRM<>'PROCESS_ALREADY_REPORTED' then raise;end if;end;
 begin perform public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,'[]',true,'',0,null);
 raise exception 'FAIL_NO_WORK_CONFLICT'; exception when raise_exception then if SQLERRM<>'NO_WORK_CONFLICT' then raise;end if;end;
 begin perform public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"콘크리트 타설","quantity":36,"unit":"m³"}]',false,'',0,current_setting('test.multi.concrete')::uuid);
 raise exception 'FAIL_VERSION';exception when serialization_failure then null;end;
 begin perform public.site_progress_submit(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"外部","zone":"전체","process":"토사 반출","quantity":121,"unit":"m³"}]',false,'',1);
 raise exception 'FAIL_AMBIGUOUS_LEGACY_EDIT';exception when serialization_failure then null;end;
end $$;
select public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"콘크리트 타설","quantity":36,"unit":"m³"}]',false,'보완',1,current_setting('test.multi.concrete')::uuid);
do $$begin
 if (select items->0->>'quantity' from public.site_progress_reports where id=current_setting('test.multi.steel')::uuid)<>'20' then raise exception 'FAIL_OTHER_PROCESS_OVERWRITE'; end if;
 begin perform public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"외부","zone":"전체","process":"토사 반출","quantity":36,"unit":"m³"}]',false,'',2,current_setting('test.multi.concrete')::uuid);
 raise exception 'FAIL_PROCESS_EDIT_COLLISION';exception when raise_exception then if SQLERRM<>'PROCESS_ALREADY_REPORTED' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.multi.viewer'),'role','authenticated')::text,true);
do $$begin
 begin perform public.site_progress_submit_report(current_setting('test.multi.company')::uuid,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"데크 슬래브","quantity":50,"unit":"장"}]',false,'',0,null);
 raise exception 'FAIL_UNAUTHORIZED_SUBMIT';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.site_progress_bot_receive(-88000001,-88000011,'검증 업체',current_setting('test.multi.supplier'),null,'[]',false,'','',false);
select public.site_progress_bot_receive(-88000002,-88000012,'검증 감독자',current_setting('test.multi.supervisor'),null,'[]',false,'','',false);
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.multi.admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.site_progress_review(current_setting('test.multi.steel')::uuid,1,'approved','');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$declare messages jsonb;begin
 messages:=public.site_progress_bot_claim();
 if not exists(select 1 from jsonb_array_elements(messages) e where e->>'report_id'=current_setting('test.multi.concrete') and e->>'kind'='pending') then raise exception 'FAIL_PENDING_AFTER_OTHER_APPROVED'; end if;
 if not exists(select 1 from jsonb_array_elements(messages) e where e->>'report_id'=current_setting('test.multi.soil') and e->>'kind'='pending') then raise exception 'FAIL_SECOND_PENDING_REMINDER'; end if;
 if not exists(select 1 from jsonb_array_elements(messages) e where e->>'report_id'=current_setting('test.multi.steel') and e->>'kind'='approved') then raise exception 'FAIL_REPORT_APPROVAL_NOTICE'; end if;
end $$;
select public.site_progress_bot_receive(-88000003,-88000011,'검증 업체',null,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"데크 슬래브","quantity":50,"unit":"장"}]',false,'','새 공종',false);
select public.site_progress_bot_receive(-88000003,-88000011,'검증 업체',null,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"데크 슬래브","quantity":999,"unit":"장"}]',false,'','동일 이벤트 재시도',false);
select public.site_progress_bot_receive(-88000004,-88000011,'검증 업체',null,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"데크 슬래브","quantity":55,"unit":"장"}]',false,'','공종 보완',true);
select public.site_progress_bot_receive(-88000005,-88000011,'검증 업체',null,(now() at time zone 'Asia/Seoul')::date,
 '[{"floor":"지하1층","zone":"B2","process":"철골보","quantity":999,"unit":"부재"}]',false,'','승인 건 수정 거절',true);
do $$begin
 if (select count(*) from public.site_progress_reports where company_id=current_setting('test.multi.company')::uuid)<>4 then raise exception 'FAIL_TELEGRAM_NEW_PROCESS'; end if;
 if not exists(select 1 from public.site_progress_reports where company_id=current_setting('test.multi.company')::uuid and items->0->>'process'='데크 슬래브' and items->0->>'quantity'='55' and version=2) then raise exception 'FAIL_PROCESS_REVISION'; end if;
 if not exists(select 1 from public.site_progress_reports where id=current_setting('test.multi.steel')::uuid and items->0->>'quantity'='20' and state='approved' and version=2) then raise exception 'FAIL_APPROVED_PROCESS_ISOLATION'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.multi.admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.site_progress_review(current_setting('test.multi.concrete')::uuid,2,'returned','수량 확인');
select public.site_progress_review(current_setting('test.multi.soil')::uuid,1,'approved','');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$declare messages jsonb;begin
 messages:=public.site_progress_bot_claim();
 if not exists(select 1 from jsonb_array_elements(messages) e where e->>'report_id'=current_setting('test.multi.concrete') and e->>'kind'='returned') then raise exception 'FAIL_RETURN_ROUTING'; end if;
 if exists(select 1 from site_progress_private.outbox where company_id=current_setting('test.multi.company')::uuid and report_id in (current_setting('test.multi.steel')::uuid,current_setting('test.multi.soil')::uuid) and kind='pending' and state in ('queued','sending')) then raise exception 'FAIL_APPROVED_REQUEST_STOP'; end if;
 if not exists(select 1 from site_progress_private.outbox o join public.site_progress_reports r on r.id=o.report_id where o.company_id=current_setting('test.multi.company')::uuid and r.items->0->>'process'='데크 슬래브' and o.kind='pending' and o.report_version=2 and o.state='sending') then raise exception 'FAIL_UNRELATED_REQUEST_RETAINED'; end if;
 if (select count(*) from site_progress_private.outbox where company_id=current_setting('test.multi.company')::uuid and kind='approved')<>2 then raise exception 'FAIL_EQUAL_VERSION_NOTICE_COLLISION'; end if;
end $$;
rollback;
select 'PASS: same-day different processes, explicit edit IDs, duplicate/no-work guards, independent approval/revisions, per-report reminder isolation and equal-version notices; fixtures rolled back' as result;
