begin;
-- Geometry and construction records are retained. This table only controls
-- drawing visibility and whether a member contributes to progress totals.
create table public.site_member_visibility (
 drawing_id text not null references public.site_drawings(id),
 item_key text not null check(length(item_key) between 1 and 150),
 hidden boolean not null,
 version integer not null check(version>0),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 primary key(drawing_id,item_key)
);
alter table public.site_member_visibility enable row level security;
revoke all on public.site_member_visibility from public,anon,authenticated;
grant select on public.site_member_visibility to authenticated;
create policy site_visibility_read on public.site_member_visibility for select to authenticated
 using((select public.site_role()) in ('viewer','editor','admin'));
create table seoripul_private.member_visibility_audit (
 id bigint generated always as identity primary key,
 drawing_id text not null,item_key text not null,
 changed_at timestamptz not null default now(),changed_by uuid not null,
 before_value jsonb,after_value jsonb not null
);
alter table seoripul_private.member_visibility_audit enable row level security;
revoke all on seoripul_private.member_visibility_audit from public,anon,authenticated;
create function seoripul_private.set_member_visibility(drawing text,item text,
 expected_version integer,hide_member boolean)
returns public.site_member_visibility language plpgsql security definer set search_path='' as $$
declare old_row public.site_member_visibility; result public.site_member_visibility;
begin
 if auth.uid() is null or public.site_role() is distinct from 'admin' then
  raise exception 'ADMIN_REQUIRED' using errcode='42501';
 end if;
 if expected_version is null or expected_version<0 or hide_member is null then
  raise exception 'INVALID_RECORD';
 end if;
 if not exists(select 1 from public.site_drawings d,
 jsonb_array_elements(coalesce(d.document->'drawing'->'members','[]'::jsonb)) v
 where d.id=drawing and v->>'key'=item) then raise exception 'UNKNOWN_MEMBER'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':visibility:'||item,0));
 select * into old_row from public.site_member_visibility where drawing_id=drawing and item_key=item;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 insert into public.site_member_visibility(drawing_id,item_key,hidden,version,updated_by)
 values(drawing,item,hide_member,expected_version+1,auth.uid())
 on conflict(drawing_id,item_key) do update set hidden=excluded.hidden,
 version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.member_visibility_audit(drawing_id,item_key,changed_by,before_value,after_value)
 values(drawing,item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));
 return result;
end $$;
revoke all on function seoripul_private.set_member_visibility(text,text,integer,boolean) from public,anon,authenticated;
grant execute on function seoripul_private.set_member_visibility(text,text,integer,boolean) to authenticated;
create function public.site_set_member_visibility(drawing text,item text,
 expected_version integer,hide_member boolean)
returns public.site_member_visibility language sql security invoker set search_path='' as $$
 select seoripul_private.set_member_visibility(drawing,item,expected_version,hide_member)
$$;
revoke all on function public.site_set_member_visibility(text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.site_set_member_visibility(text,text,integer,boolean) to authenticated;
commit;
