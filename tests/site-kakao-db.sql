-- Live Supabase transactional checks. No message sends, schedules or committed fixtures.
begin;
select set_config('test.kakao.admin',(select user_id::text from public.site_members where role='admin' order by created_at limit 1),true);
select set_config('test.kakao.viewer',(select user_id::text from public.site_members where role='viewer' order by created_at limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.kakao.admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare c public.site_progress_companies;config jsonb;begin
 c:=public.site_progress_save_company(null,'카카오 검증 '||gen_random_uuid()::text,'south',current_setting('test.kakao.admin')::uuid,true);
 perform set_config('test.kakao.company',c.id::text,true);perform set_config('test.kakao.name',c.name,true);
 perform set_config('test.kakao.bot','fixture-'||gen_random_uuid()::text,true);
 config:=public.site_progress_kakao_setup(current_setting('test.kakao.bot'),'https://pf.kakao.com/_fixture',true,false);
 if length(config->>'header_value')<>64 then raise exception 'FAIL_KEY_SIZE';end if;
 perform set_config('test.kakao.invite',public.site_progress_kakao_invite(c.id),true);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.kakao.viewer'),'role','authenticated')::text,true);
do $$begin
 begin perform public.site_progress_kakao_credentials();raise exception 'FAIL_VIEWER_SECRET';exception when insufficient_privilege then null;end;
 begin perform public.site_progress_kakao_config();raise exception 'FAIL_VIEWER_CONFIG';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$declare result jsonb;doc jsonb;p public.site_progress_plans;local_day date:=(now() at time zone 'Asia/Seoul')::date;
 ev text:=encode(extensions.digest(current_setting('test.kakao.bot')||'-plan','sha256'),'hex');fingerprint text:=encode(extensions.digest('fixture plan','sha256'),'hex');begin
 result:=public.site_progress_kakao_receive(current_setting('test.kakao.bot'),'fixture-user',
 encode(extensions.digest(current_setting('test.kakao.bot')||'-link','sha256'),'hex'),encode(extensions.digest('fixture link','sha256'),'hex'),
 jsonb_build_object('type','link','token',current_setting('test.kakao.invite')),'검증 연결 원문');
 if result->>'reply' not like '%연결되었습니다%' then raise exception 'FAIL_PAIRING';end if;
 doc:=jsonb_build_object('work_date',local_day::text,'company_name',current_setting('test.kakao.name'),'reported_headcount',2,
 'staffing','[{"role":"관리자","count":2}]'::jsonb,'equipment','[{"name":"굴착기","count":1,"unit":"대"}]'::jsonb,
 'materials','[]'::jsonb,'newcomers','없음','expected',0,'revision',false,
 'tasks','[{"no":1,"zone":"B2","floor":"지하1층","location":null,"description":"수평재 용접","raw":"B2 B1F 수평재 용접"},{"no":2,"zone":"C3","floor":"지하1층","location":null,"description":"복공판 설치","raw":"C3 B1F 복공판 설치"}]'::jsonb);
 result:=public.site_progress_kakao_receive(current_setting('test.kakao.bot'),'fixture-user',ev,fingerprint,jsonb_build_object('type','plan','document',doc),'검증 아침 원문');
 if result->>'reply' not like '%아침계획%' then raise exception 'FAIL_MORNING';end if;
 result:=public.site_progress_kakao_receive(current_setting('test.kakao.bot'),'fixture-user',ev,fingerprint,jsonb_build_object('type','plan','document',doc),'검증 아침 원문');
 if not (result->>'duplicate')::boolean then raise exception 'FAIL_DUPLICATE';end if;
 select * into p from public.site_progress_plans where company_id=current_setting('test.kakao.company')::uuid;
 if p.version<>1 or exists(select 1 from public.site_progress_reports where company_id=p.company_id) then raise exception 'FAIL_PLANS_NOT_ACTUALS';end if;
 perform set_config('test.kakao.plan',p.id::text,true);
 result:=public.site_progress_kakao_receive(current_setting('test.kakao.bot'),'fixture-user',
 encode(extensions.digest(current_setting('test.kakao.bot')||'-feedback','sha256'),'hex'),encode(extensions.digest('fixture feedback','sha256'),'hex'),
 jsonb_build_object('type','feedback','feedback',jsonb_build_object('work_date',local_day::text,'expected_plan',1,'expected_report',0,'revision',false,
 'note','검증','rows','[{"task_no":1,"process":"수평재 용접","quantity":5,"unit":"개소"}]'::jsonb,'extras','[]'::jsonb,
 'feedback','[{"task_no":1,"state":"done","reason":""},{"task_no":2,"state":"not_done","reason":"작업면 미확보"}]'::jsonb)),'검증 작업결과 원문');
 if result->>'reply' not like '%감독자 승인 대기%' then raise exception 'FAIL_PENDING';end if;
 perform set_config('test.kakao.report',(select id::text from public.site_progress_reports where plan_id=p.id),true);
 if not exists(select 1 from public.site_progress_reports where plan_id=p.id and state='pending' and source='kakao' and items->0->>'quantity'='5') then raise exception 'FAIL_QUANTITY';end if;
 if not exists(select 1 from site_progress_private.kakao_events where report_id=current_setting('test.kakao.report')::uuid and company_id=p.company_id) then raise exception 'FAIL_SENDER_AUDIT';end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.kakao.viewer'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.site_progress_plans where id=current_setting('test.kakao.plan')::uuid) then raise exception 'FAIL_PRIVATE_PLAN';end if;
 begin perform public.site_progress_review(current_setting('test.kakao.report')::uuid,1,'approved','');raise exception 'FAIL_UNASSIGNED_APPROVAL';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.kakao.admin'),'role','authenticated')::text,true);
do $$declare r public.site_progress_reports;begin
 select * into r from public.site_progress_reports where id=current_setting('test.kakao.report')::uuid;
 begin perform public.site_progress_submit_report(r.company_id,r.work_date,r.items,false,'',r.version,r.id);raise exception 'FAIL_FEEDBACK_OVERWRITE';
 exception when raise_exception then if SQLERRM<>'PLAN_FEEDBACK_EDIT_REQUIRED' then raise;end if;end;
 r:=public.site_progress_review(r.id,r.version,'approved','');
 if r.state<>'approved' then raise exception 'FAIL_APPROVAL';end if;
 begin perform public.site_progress_submit_feedback(r.plan_id,1,r.id,r.version,r.items,r.task_feedback,'');raise exception 'FAIL_APPROVED_OVERWRITE';
 exception when raise_exception then if SQLERRM<>'APPROVED_RESULT_LOCKED' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.kakao.viewer'),'role','authenticated')::text,true);
do $$begin
 if not exists(select 1 from public.site_progress_plans where id=current_setting('test.kakao.plan')::uuid) then raise exception 'FAIL_APPROVED_PLAN_READ';end if;
end $$;
rollback;
select 'PASS: Kakao pairing, private plans, stable retries, separate actuals, complete feedback, sender audit, assigned supervisor and immutable approval; all fixtures rolled back, no messages sent.' as result;
