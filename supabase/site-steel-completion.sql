-- Apply after site-trades-approved.sql and site-slab-records.sql.
-- Steel installation may be confirmed before its actual date is known.
alter table public.site_trade_records
 add column installation_complete boolean not null default false,
 add constraint site_trade_records_steel_completion_check
 check (trade='steel' or not installation_complete);

create or replace function seoripul_private.save_trade_status(
 drawing text,trade_name text,item text,expected_version integer,
 member_label text,member_spec text,delivered_date date,completed_date date,
 memo text,installation_done boolean)
returns public.site_trade_records
language plpgsql security definer set search_path='' as $$
declare old_row public.site_trade_records; result public.site_trade_records; installed boolean;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then
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
 -- Older cached clients omit the flag. Preserve date-free confirmations on their writes.
 installed := trade_name='steel' and (completed_date is not null or coalesce(installation_done,old_row.installation_complete,false));
 insert into public.site_trade_records(drawing_id,trade,item_key,label,spec,delivered,completed,note,version,updated_by,installation_complete)
 values(drawing,trade_name,item,member_label,member_spec,delivered_date,completed_date,memo,expected_version+1,auth.uid(),installed)
 on conflict(drawing_id,trade,item_key) do update set
 label=excluded.label,spec=excluded.spec,delivered=excluded.delivered,completed=excluded.completed,note=excluded.note,
 installation_complete=excluded.installation_complete,version=excluded.version,updated_at=now(),updated_by=auth.uid()
 returning * into result;
 insert into seoripul_private.trade_record_audit(drawing_id,trade,item_key,changed_by,before_value,after_value)
 values(drawing,trade_name,item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));
 return result;
end $$;
revoke all on function seoripul_private.save_trade_status(text,text,text,integer,text,text,date,date,text,boolean) from public,anon;
grant execute on function seoripul_private.save_trade_status(text,text,text,integer,text,text,date,date,text,boolean) to authenticated;

-- Keep the existing API working without letting it erase explicit completion flags.
create or replace function seoripul_private.save_trade(
 drawing text,trade_name text,item text,expected_version integer,
 member_label text,member_spec text,delivered_date date,completed_date date,memo text)
returns public.site_trade_records
language sql security invoker set search_path='' as $$
 select seoripul_private.save_trade_status(drawing,trade_name,item,expected_version,member_label,member_spec,delivered_date,completed_date,memo,null)
$$;

create or replace function public.site_save_steel_record(
 drawing text,item text,expected_version integer,member_label text,member_spec text,
 delivered_date date,completed_date date,memo text,installation_done boolean)
returns public.site_trade_records
language plpgsql security invoker set search_path='' as $$
begin
 if installation_done is null then raise exception 'INVALID_RECORD'; end if;
 return seoripul_private.save_trade_status(drawing,'steel',item,expected_version,member_label,member_spec,delivered_date,completed_date,memo,installation_done);
end $$;
revoke all on function public.site_save_steel_record(text,text,integer,text,text,date,date,text,boolean) from public,anon;
grant execute on function public.site_save_steel_record(text,text,integer,text,text,date,date,text,boolean) to authenticated;
notify pgrst,'reload schema';
