-- Apply after site-steel-completion.sql. Keep spec as the original member.
begin;
alter table public.site_trade_records
 add column reinforcement_spec text not null default '',
 add constraint site_trade_records_reinforcement_spec_check
 check (length(reinforcement_spec)<=120 and (trade='steel' or reinforcement_spec=''));

-- One locked, versioned write captures both components in the same audit entry.
create function seoripul_private.save_trade_components(
 drawing text,trade_name text,item text,expected_version integer,
 member_label text,member_spec text,delivered_date date,completed_date date,
 memo text,installation_done boolean,reinforcing_spec text)
returns public.site_trade_records
language plpgsql security definer set search_path='' as $$
declare old_row public.site_trade_records; result public.site_trade_records; installed boolean; reinforcing text;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then
  raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501';
 end if;
 if trade_name is null or trade_name not in ('steel','slab') or expected_version is null or expected_version<0
 or member_label is null or length(member_label)>120 or member_spec is null or length(member_spec)>120
 or memo is null or length(memo)>2000 or length(reinforcing_spec)>120
 or (trade_name<>'steel' and coalesce(reinforcing_spec,'')<>'') then raise exception 'INVALID_RECORD'; end if;
 if not exists(select 1 from public.site_drawings d,
 jsonb_array_elements(coalesce(d.document->'drawing'->(case when trade_name='steel' then 'members' else 'slabs' end),'[]'::jsonb)) v
 where d.id=drawing and v->>'key'=item) then raise exception 'UNKNOWN_MEMBER'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':'||trade_name||':'||item,0));
 select * into old_row from public.site_trade_records where drawing_id=drawing and trade=trade_name and item_key=item;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 installed := trade_name='steel' and (completed_date is not null or coalesce(installation_done,old_row.installation_complete,false));
 -- Null is reserved for legacy callers; the new API uses an explicit empty string to clear.
 reinforcing := case when trade_name='steel' then coalesce(reinforcing_spec,old_row.reinforcement_spec,'') else '' end;
 insert into public.site_trade_records(drawing_id,trade,item_key,label,spec,delivered,completed,note,version,updated_by,installation_complete,reinforcement_spec)
 values(drawing,trade_name,item,member_label,member_spec,delivered_date,completed_date,memo,expected_version+1,auth.uid(),installed,reinforcing)
 on conflict(drawing_id,trade,item_key) do update set
 label=excluded.label,spec=excluded.spec,delivered=excluded.delivered,completed=excluded.completed,note=excluded.note,
 installation_complete=excluded.installation_complete,reinforcement_spec=excluded.reinforcement_spec,
 version=excluded.version,updated_at=now(),updated_by=auth.uid()
 returning * into result;
 insert into seoripul_private.trade_record_audit(drawing_id,trade,item_key,changed_by,before_value,after_value)
 values(drawing,trade_name,item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));
 return result;
end $$;
revoke all on function seoripul_private.save_trade_components(text,text,text,integer,text,text,date,date,text,boolean,text) from public,anon;
grant execute on function seoripul_private.save_trade_components(text,text,text,integer,text,text,date,date,text,boolean,text) to authenticated;

-- Older cached clients can edit the original member without erasing its reinforcement.
create or replace function seoripul_private.save_trade_status(
 drawing text,trade_name text,item text,expected_version integer,
 member_label text,member_spec text,delivered_date date,completed_date date,
 memo text,installation_done boolean)
returns public.site_trade_records
language sql security invoker set search_path='' as $$
 select seoripul_private.save_trade_components(drawing,trade_name,item,expected_version,member_label,member_spec,delivered_date,completed_date,memo,installation_done,null)
$$;

create function public.site_save_steel_components(
 drawing text,item text,expected_version integer,member_label text,member_spec text,
 delivered_date date,completed_date date,memo text,installation_done boolean,reinforcing_spec text)
returns public.site_trade_records
language plpgsql security invoker set search_path='' as $$
begin
 if installation_done is null or reinforcing_spec is null then raise exception 'INVALID_RECORD'; end if;
 return seoripul_private.save_trade_components(drawing,'steel',item,expected_version,member_label,member_spec,delivered_date,completed_date,memo,installation_done,reinforcing_spec);
end $$;
revoke all on function public.site_save_steel_components(text,text,integer,text,text,date,date,text,boolean,text) from public,anon;
grant execute on function public.site_save_steel_components(text,text,integer,text,text,date,date,text,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
