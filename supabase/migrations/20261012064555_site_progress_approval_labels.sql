-- Clarify displayed supervisor approval states in Telegram messages.
-- Only message text changes; permissions, report states and notification rules are retained.
begin;

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
 insert into site_progress_private.outbox(company_id,work_date,contact_id,kind,report_version,message)
 select result.company_id,result.work_date,t.id,decision,result.version,
 '[사이트원] '||result.work_date::text||' 공사 실적이 '||case when decision='approved' then '감독자 승인을 받아 승인됨·정식 등록 상태로 변경되었습니다.' else '보완 요청되었습니다. 사유: '||memo||E'\n수정 후 /수정 양식으로 다시 전송해 주세요.' end
 from site_progress_private.contacts t where t.company_id=result.company_id and t.kind='supplier' and t.active
 on conflict do nothing;
 return result;
end $$;

create or replace function site_progress_private.bot_receive(event_id bigint,chat bigint,display text,invite_token text,
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
    reply:=day::text||' 실적을 접수했습니다. 현재 상태는 감독자 승인 대기입니다. 감독자가 승인하면 승인됨으로 표시되고 정식 등록됩니다.';
   end if;
  end if;
 end if;
 insert into site_progress_private.bot_events(update_id,chat_id,reply) values(event_id,chat,reply);
 return jsonb_build_object('reply',reply,'sent',false);
end $$;

create or replace function site_progress_private.queue_reminders() returns void language plpgsql security definer set search_path='' as $$
declare local_now timestamp:=(now() at time zone 'Asia/Seoul');
begin
 insert into site_progress_private.outbox(company_id,work_date,contact_id,kind,report_version,message)
 select c.id,local_now::date,t.id,case when r.state='pending' then 'pending' when r.state='returned' then 'returned' else 'missing' end,
 coalesce(r.version,0),'[사이트원] '||c.name||E'\n'||local_now::date::text||case
 when r.state='pending' then ' 공사 실적이 감독자 승인 대기 상태입니다. 사이트원 공정별 진행현황에서 확인·승인해 주세요.'
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

commit;
