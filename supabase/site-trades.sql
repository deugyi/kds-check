begin;
create table public.site_trade_records (
 drawing_id text not null references public.site_drawings(id),
 trade text not null check(trade in ('steel','slab')),
 item_key text not null check(length(item_key) between 1 and 150),
 label text not null default '' check(length(label)<=120),
 spec text not null default '' check(length(spec)<=120),
 delivered date, completed date,
 note text not null default '' check(length(note)<=2000),
 version integer not null check(version>0),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 primary key(drawing_id,trade,item_key),
 check(completed is null or delivered is null or completed>=delivered),
 check(trade<>'slab' or delivered is null),
 check(delivered is null or delivered between date '0001-01-01' and date '9999-12-31'),
 check(completed is null or completed between date '0001-01-01' and date '9999-12-31')
);
alter table public.site_trade_records enable row level security;
revoke all on public.site_trade_records from public,anon,authenticated;
grant select on public.site_trade_records to authenticated;
create policy site_trade_read on public.site_trade_records for select to authenticated
 using((select public.site_role()) in ('viewer','editor','admin'));
create table seoripul_private.trade_record_audit (
 id bigint generated always as identity primary key,
 drawing_id text not null,trade text not null,item_key text not null,
 changed_at timestamptz not null default now(),changed_by uuid not null,
 before_value jsonb,after_value jsonb not null
);
alter table seoripul_private.trade_record_audit enable row level security;
revoke all on seoripul_private.trade_record_audit from public,anon,authenticated;
-- Strict version comparison and audit require privileged writes. Keep that
-- implementation outside the exposed schema and check the verified site role.
create function seoripul_private.save_trade(drawing text,trade_name text,item text,
 expected_version integer,member_label text,member_spec text,delivered_date date,completed_date date,memo text)
returns public.site_trade_records language plpgsql security definer set search_path='' as $$
declare old_row public.site_trade_records; result public.site_trade_records;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('editor','admin') then
  raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501';
 end if;
 if trade_name is null or trade_name not in ('steel','slab') or expected_version is null or expected_version<0
 or member_label is null or length(member_label)>120 or member_spec is null or length(member_spec)>120
 or memo is null or length(memo)>2000 then raise exception 'INVALID_RECORD'; end if;
 if not exists(select 1 from public.site_drawings d,
 jsonb_array_elements(coalesce(d.document->'drawing'->(case when trade_name='steel' then 'members' else 'slabs' end),'[]'::jsonb)) v
 where d.id=drawing and v->>'key'=item) then raise exception 'UNKNOWN_MEMBER'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':'||trade_name||':'||item,0));
 select * into old_row from public.site_trade_records where drawing_id=drawing and trade=trade_name and item_key=item;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 insert into public.site_trade_records(drawing_id,trade,item_key,label,spec,delivered,completed,note,version,updated_by)
 values(drawing,trade_name,item,member_label,member_spec,delivered_date,completed_date,memo,expected_version+1,auth.uid())
 on conflict(drawing_id,trade,item_key) do update set
 label=excluded.label,spec=excluded.spec,delivered=excluded.delivered,completed=excluded.completed,note=excluded.note,
 version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.trade_record_audit(drawing_id,trade,item_key,changed_by,before_value,after_value)
 values(drawing,trade_name,item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));
 return result;
end $$;
revoke all on function seoripul_private.save_trade(text,text,text,integer,text,text,date,date,text) from public,anon,authenticated;
grant usage on schema seoripul_private to authenticated;
grant execute on function seoripul_private.save_trade(text,text,text,integer,text,text,date,date,text) to authenticated;
create function public.site_save_trade(drawing text,trade_name text,item text,
 expected_version integer,member_label text,member_spec text,delivered_date date,completed_date date,memo text)
returns public.site_trade_records language sql security invoker set search_path='' as $$
 select seoripul_private.save_trade(drawing,trade_name,item,expected_version,member_label,member_spec,delivered_date,completed_date,memo)
$$;
revoke all on function public.site_save_trade(text,text,text,integer,text,text,date,date,text) from public,anon,authenticated;
grant execute on function public.site_save_trade(text,text,text,integer,text,text,date,date,text) to authenticated;
commit;
