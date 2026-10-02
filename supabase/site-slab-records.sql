-- Add slab metadata without changing drawing geometry or existing record values.
begin;
alter table public.site_trade_records add column slab_kind text not null default '',
 add column decked date, add column reinforced date;
alter table public.site_trade_records add constraint slab_kind_valid check(slab_kind in ('','deck','conventional','temporary')),
 add constraint slab_fields_only check(trade='slab' or (slab_kind='' and decked is null and reinforced is null)),
 add constraint slab_dates_order check((decked is null or reinforced is null or reinforced>=decked)
 and (decked is null or completed is null or completed>=decked)
 and (reinforced is null or completed is null or completed>=reinforced)),
 add constraint slab_dates_range check((decked is null or decked between date '0001-01-01' and date '9999-12-31')
 and (reinforced is null or reinforced between date '0001-01-01' and date '9999-12-31'));

create function seoripul_private.save_slab_record(drawing text,item text,expected_version integer,
 member_label text,member_spec text,slab_type text,deck_date date,rebar_date date,cast_date date,memo text)
returns public.site_trade_records language plpgsql security definer set search_path='' as $$
declare old_row public.site_trade_records; result public.site_trade_records;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 if expected_version is null or expected_version<0 or member_label is null or length(member_label)>120
  or member_spec is null or length(member_spec)>120 or memo is null or length(memo)>2000
  or slab_type is null or slab_type not in ('','deck','conventional','temporary') then raise exception 'INVALID_RECORD'; end if;
 if not exists(select 1 from public.site_drawings d,jsonb_array_elements(coalesce(d.document->'drawing'->'slabs','[]'::jsonb)) v where d.id=drawing and v->>'key'=item) then raise exception 'UNKNOWN_MEMBER'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab:'||item,0));
 select * into old_row from public.site_trade_records where drawing_id=drawing and trade='slab' and item_key=item;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 insert into public.site_trade_records(drawing_id,trade,item_key,label,spec,completed,note,slab_kind,decked,reinforced,version,updated_by)
 values(drawing,'slab',item,member_label,member_spec,cast_date,memo,slab_type,deck_date,rebar_date,expected_version+1,auth.uid())
 on conflict(drawing_id,trade,item_key) do update set label=excluded.label,spec=excluded.spec,completed=excluded.completed,note=excluded.note,
 slab_kind=excluded.slab_kind,decked=excluded.decked,reinforced=excluded.reinforced,version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.trade_record_audit(drawing_id,trade,item_key,changed_by,before_value,after_value)
 values(drawing,'slab',item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));return result;
end $$;
revoke all on function seoripul_private.save_slab_record(text,text,integer,text,text,text,date,date,date,text) from public,anon,authenticated;
grant execute on function seoripul_private.save_slab_record(text,text,integer,text,text,text,date,date,date,text) to authenticated;
create function public.site_save_slab_record(drawing text,item text,expected_version integer,member_label text,member_spec text,slab_type text,deck_date date,rebar_date date,cast_date date,memo text)
returns public.site_trade_records language sql security invoker set search_path='' as $$
 select seoripul_private.save_slab_record(drawing,item,expected_version,member_label,member_spec,slab_type,deck_date,rebar_date,cast_date,memo)
$$;
revoke all on function public.site_save_slab_record(text,text,integer,text,text,text,date,date,date,text) from public,anon,authenticated;
grant execute on function public.site_save_slab_record(text,text,integer,text,text,text,date,date,date,text) to authenticated;
notify pgrst, 'reload schema';

commit;
