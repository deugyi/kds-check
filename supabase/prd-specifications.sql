-- Editable PRD specifications, stored separately from the original import.
begin;
alter table public.site_prd_records add column specifications jsonb;
alter table public.site_prd_records add constraint site_prd_specifications_valid check(
 specifications is null or (
 jsonb_typeof(specifications)='object'
 and specifications ?& array['diameter','column_spec','insert_spec']
 and specifications-array['diameter','column_spec','insert_spec']='{}'::jsonb
 and jsonb_typeof(specifications->'diameter') in ('number','null')
 and case when jsonb_typeof(specifications->'diameter')='number' then (specifications->>'diameter')::numeric>0 else true end
 and jsonb_typeof(specifications->'column_spec')='string' and length(specifications->>'column_spec')<=120
 and jsonb_typeof(specifications->'insert_spec')='string' and length(specifications->>'insert_spec')<=120
 ));

create function seoripul_private.save_prd_details(drawing text,pile text,expected_version integer,
 drilled_date date,delivered_date date,installed_date date,memo text,specification jsonb)
returns public.site_prd_records language plpgsql security definer set search_path='' as $$
declare old_row public.site_prd_records; result public.site_prd_records;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 if expected_version is null or expected_version<0 or memo is null or length(memo)>2000
  or specification is null or jsonb_typeof(specification)<>'object'
  or not (specification ?& array['diameter','column_spec','insert_spec'])
  or specification-array['diameter','column_spec','insert_spec']<>'{}'::jsonb
  or jsonb_typeof(specification->'diameter') not in ('number','null')
  or jsonb_typeof(specification->'column_spec')<>'string' or length(specification->>'column_spec')>120
  or jsonb_typeof(specification->'insert_spec')<>'string' or length(specification->>'insert_spec')>120
 then raise exception 'INVALID_RECORD'; end if;
 if jsonb_typeof(specification->'diameter')='number' and (specification->>'diameter')::numeric<=0 then raise exception 'INVALID_RECORD'; end if;
 if not exists(select 1 from public.site_drawings d,jsonb_array_elements(d.document->'drawing'->'piles') p
  where d.id=drawing and p->>'key'=pile) then raise exception 'UNKNOWN_PILE'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':'||pile,0));
 select * into old_row from public.site_prd_records where drawing_id=drawing and pile_key=pile for update;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 insert into public.site_prd_records(drawing_id,pile_key,drilled,delivered,installed,note,specifications,version,updated_by)
 values(drawing,pile,drilled_date,delivered_date,installed_date,memo,specification,expected_version+1,auth.uid())
 on conflict(drawing_id,pile_key) do update set
 drilled=excluded.drilled,delivered=excluded.delivered,installed=excluded.installed,note=excluded.note,specifications=excluded.specifications,
 version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.record_audit(drawing_id,pile_key,changed_by,before_value,after_value)
 values(drawing,pile,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));
 return result;
end $$;
revoke all on function seoripul_private.save_prd_details(text,text,integer,date,date,date,text,jsonb) from public,anon,authenticated;
grant execute on function seoripul_private.save_prd_details(text,text,integer,date,date,date,text,jsonb) to authenticated;
create function public.site_save_prd_details(drawing text,pile text,expected_version integer,
 drilled_date date,delivered_date date,installed_date date,memo text,specification jsonb)
returns public.site_prd_records language sql security invoker set search_path='' as $$
 select seoripul_private.save_prd_details(drawing,pile,expected_version,drilled_date,delivered_date,installed_date,memo,specification)
$$;
revoke all on function public.site_save_prd_details(text,text,integer,date,date,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.site_save_prd_details(text,text,integer,date,date,date,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
