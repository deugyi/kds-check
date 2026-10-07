-- Date-free reinforcement work in progress. Existing RPC and records stay valid.
begin;
alter table public.site_trade_records add column reinforcement_in_progress boolean not null default false,
 add constraint slab_reinforcement_only check(trade='slab' or not reinforcement_in_progress);

create function seoripul_private.save_slab_progress(drawing text,item text,expected_version integer,
 member_label text,member_spec text,slab_type text,deck_date date,rebar_date date,cast_date date,memo text,rebar_in_progress boolean)
returns public.site_trade_records language plpgsql security definer set search_path='' as $$
declare old_row public.site_trade_records;result public.site_trade_records;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501';end if;
 if expected_version is null or expected_version<0 or member_label is null or length(member_label)>120
 or member_spec is null or length(member_spec)>120 or memo is null or length(memo)>2000
 or slab_type is null or slab_type not in ('','deck','conventional','temporary','opening') or rebar_in_progress is null then raise exception 'INVALID_RECORD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab:'||item,0));
 if exists(select 1 from public.site_slab_regions where drawing_id=drawing and item_key=item and hidden)
 or not(exists(select 1 from public.site_drawings d,jsonb_array_elements(coalesce(d.document->'drawing'->'slabs','[]'::jsonb)) v where d.id=drawing and v->>'key'=item)
 or exists(select 1 from public.site_slab_regions where drawing_id=drawing and item_key=item and not hidden)) then raise exception 'UNKNOWN_MEMBER';end if;
 select * into old_row from public.site_trade_records where drawing_id=drawing and trade='slab' and item_key=item;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001';end if;
 insert into public.site_trade_records(drawing_id,trade,item_key,label,spec,completed,note,slab_kind,decked,reinforced,reinforcement_in_progress,version,updated_by)
 values(drawing,'slab',item,member_label,member_spec,cast_date,memo,slab_type,deck_date,rebar_date,rebar_in_progress and cast_date is null,expected_version+1,auth.uid())
 on conflict(drawing_id,trade,item_key) do update set label=excluded.label,spec=excluded.spec,completed=excluded.completed,note=excluded.note,
 slab_kind=excluded.slab_kind,decked=excluded.decked,reinforced=excluded.reinforced,reinforcement_in_progress=excluded.reinforcement_in_progress,
 version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.trade_record_audit(drawing_id,trade,item_key,changed_by,before_value,after_value)
 values(drawing,'slab',item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));return result;
end $$;
revoke all on function seoripul_private.save_slab_progress(text,text,integer,text,text,text,date,date,date,text,boolean) from public,anon,authenticated;
grant execute on function seoripul_private.save_slab_progress(text,text,integer,text,text,text,date,date,date,text,boolean) to authenticated;
create function public.site_save_slab_progress(drawing text,item text,expected_version integer,member_label text,member_spec text,slab_type text,deck_date date,rebar_date date,cast_date date,memo text,rebar_in_progress boolean)
returns public.site_trade_records language sql security invoker set search_path='' as $$
 select seoripul_private.save_slab_progress(drawing,item,expected_version,member_label,member_spec,slab_type,deck_date,rebar_date,cast_date,memo,rebar_in_progress)
$$;
revoke all on function public.site_save_slab_progress(text,text,integer,text,text,text,date,date,date,text,boolean) from public,anon,authenticated;
grant execute on function public.site_save_slab_progress(text,text,integer,text,text,text,date,date,date,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
