-- Recoverable slab geometry edits. The source drawing and construction records are retained.
begin;
create table public.site_slab_regions(
 drawing_id text not null references public.site_drawings(id),item_key text not null,
 geometry jsonb not null,hidden boolean not null default false,version integer not null check(version>0),
 updated_at timestamptz not null default now(),updated_by uuid not null references auth.users(id),
 primary key(drawing_id,item_key)
);
create index site_slab_regions_updated_by_idx on public.site_slab_regions(updated_by);
alter table public.site_slab_regions enable row level security;
revoke all on public.site_slab_regions from anon,authenticated;
grant select on public.site_slab_regions to authenticated;
create policy slab_regions_read on public.site_slab_regions for select to authenticated
 using ((select public.site_role()) in ('viewer','editor','admin'));
create table seoripul_private.slab_region_audit(
 id bigint generated always as identity primary key,drawing_id text not null,item_key text not null,
 changed_by uuid not null,changed_at timestamptz not null default now(),before_value jsonb,after_value jsonb not null
);
alter table seoripul_private.slab_region_audit enable row level security;
revoke all on seoripul_private.slab_region_audit from anon,authenticated;

create function seoripul_private.segments_touch(a jsonb,b jsonb,c jsonb,d jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare ax float8:=(a->>0)::float8;ay float8:=(a->>1)::float8;bx float8:=(b->>0)::float8;by_ float8:=(b->>1)::float8;
 cx float8:=(c->>0)::float8;cy float8:=(c->>1)::float8;dx float8:=(d->>0)::float8;dy float8:=(d->>1)::float8;
 x float8;y float8;z float8;w float8;
begin
 x:=(bx-ax)*(cy-ay)-(by_-ay)*(cx-ax);y:=(bx-ax)*(dy-ay)-(by_-ay)*(dx-ax);
 z:=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx);w:=(dx-cx)*(by_-cy)-(dy-cy)*(bx-cx);
 return (x*y<0 and z*w<0)
 or (abs(x)<1e-6 and cx between least(ax,bx)-1e-6 and greatest(ax,bx)+1e-6 and cy between least(ay,by_)-1e-6 and greatest(ay,by_)+1e-6)
 or (abs(y)<1e-6 and dx between least(ax,bx)-1e-6 and greatest(ax,bx)+1e-6 and dy between least(ay,by_)-1e-6 and greatest(ay,by_)+1e-6)
 or (abs(z)<1e-6 and ax between least(cx,dx)-1e-6 and greatest(cx,dx)+1e-6 and ay between least(cy,dy)-1e-6 and greatest(cy,dy)+1e-6)
 or (abs(w)<1e-6 and bx between least(cx,dx)-1e-6 and greatest(cx,dx)+1e-6 and by_ between least(cy,dy)-1e-6 and greatest(cy,dy)+1e-6);
end $$;
create function seoripul_private.ring_contains(p jsonb,ring jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare inside boolean:=false;i integer;j integer:=jsonb_array_length(ring)-1;a jsonb;b jsonb;
 px float8:=(p->>0)::float8;py float8:=(p->>1)::float8;ax float8;ay float8;bx float8;by_ float8;
begin
 for i in 0..jsonb_array_length(ring)-1 loop
  a:=ring->j;b:=ring->i;ax:=(a->>0)::float8;ay:=(a->>1)::float8;bx:=(b->>0)::float8;by_:=(b->>1)::float8;
  if ((ay>py)<>(by_>py)) then if px<(bx-ax)*(py-ay)/(by_-ay)+ax then inside:=not inside;end if;end if;j:=i;
 end loop;return inside;
end $$;
create function seoripul_private.validate_slab_geometry(g jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare rings jsonb;ring jsonb;other jsonb;p jsonb;a jsonb;b jsonb;i integer;j integer;k integer;l integer;n integer;total integer:=0;area float8;net float8:=0;ax float8;ay float8;
begin
 if g is null or jsonb_typeof(g)<>'object' or jsonb_typeof(g->'points') is distinct from 'array'
 or jsonb_typeof(g->'holes') is distinct from 'array' or jsonb_array_length(g->'holes')>20 then raise exception 'INVALID_GEOMETRY';end if;
 rings:=jsonb_build_array(g->'points')||(g->'holes');
 for ring in select value from jsonb_array_elements(rings) loop
  if jsonb_typeof(ring)<>'array' or jsonb_array_length(ring) not between 3 and 200 then raise exception 'INVALID_GEOMETRY';end if;
  n:=jsonb_array_length(ring);total:=total+n;if total>600 then raise exception 'INVALID_GEOMETRY';end if;
  for p in select value from jsonb_array_elements(ring) loop
   if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' then raise exception 'INVALID_GEOMETRY';end if;
   if abs((p->>0)::numeric)>1e9 or abs((p->>1)::numeric)>1e9 then raise exception 'INVALID_GEOMETRY';end if;
  end loop;
 end loop;
 for k in 0..jsonb_array_length(rings)-1 loop
  ring:=rings->k;n:=jsonb_array_length(ring);area:=0;ax:=(ring->0->>0)::float8;ay:=(ring->0->>1)::float8;
  for i in 0..n-1 loop
   a:=ring->i;b:=ring->((i+1)%n);
   if power((a->>0)::float8-(b->>0)::float8,2)+power((a->>1)::float8-(b->>1)::float8,2)<1e-6 then raise exception 'INVALID_GEOMETRY';end if;
   area:=area+((a->>0)::float8-ax)*((b->>1)::float8-ay)-((b->>0)::float8-ax)*((a->>1)::float8-ay);
   for j in i+1..n-1 loop
    if j<>i+1 and not(i=0 and j=n-1) and seoripul_private.segments_touch(a,b,ring->j,ring->((j+1)%n)) then raise exception 'INVALID_GEOMETRY';end if;
   end loop;
  end loop;
  if abs(area)/2<1000 then raise exception 'INVALID_GEOMETRY';end if;
  net:=net+case when k=0 then abs(area)/2 else -abs(area)/2 end;
  if k>0 then
   if not seoripul_private.ring_contains(ring->0,rings->0) then raise exception 'INVALID_GEOMETRY';end if;
   for l in 0..k-1 loop
    other:=rings->l;
    if l>0 and (seoripul_private.ring_contains(ring->0,other) or seoripul_private.ring_contains(other->0,ring)) then raise exception 'INVALID_GEOMETRY';end if;
    for i in 0..n-1 loop for j in 0..jsonb_array_length(other)-1 loop
     if seoripul_private.segments_touch(ring->i,ring->((i+1)%n),other->j,other->((j+1)%jsonb_array_length(other))) then raise exception 'INVALID_GEOMETRY';end if;
    end loop;end loop;
   end loop;
  end if;
 end loop;if net<1000 then raise exception 'INVALID_GEOMETRY';end if;
end $$;

create function seoripul_private.save_slab_region(drawing text,item text,expected_version integer,boundary jsonb,hide_region boolean)
returns public.site_slab_regions language plpgsql security definer set search_path='' as $$
declare old_row public.site_slab_regions;result public.site_slab_regions;doc jsonb;box float8[];
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501';end if;
 if expected_version is null or expected_version<0 or hide_region is null or item is null or length(item)>120 then raise exception 'INVALID_GEOMETRY';end if;
 select document->'drawing' into doc from public.site_drawings where id=drawing;
 if doc is null or jsonb_typeof(doc->'zones') is distinct from 'array' or jsonb_typeof(doc->'members') is distinct from 'array' then raise exception 'UNKNOWN_DRAWING';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab:'||item,0));
 select * into old_row from public.site_slab_regions where drawing_id=drawing and item_key=item;
 if not exists(select 1 from jsonb_array_elements(coalesce(doc->'slabs','[]'::jsonb)) v where v->>'key'=item)
 and old_row.version is null and item!~'^USER-SLAB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'UNKNOWN_MEMBER';end if;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'REGION_CONFLICT' using errcode='40001';end if;
 perform seoripul_private.validate_slab_geometry(boundary);
 select array[min((p->>0)::float8),min((p->>1)::float8),max((p->>0)::float8),max((p->>1)::float8)] into box
 from jsonb_array_elements(doc->'zones') z,jsonb_array_elements(z->'points') p;
 if box[1] is null or exists(select 1 from jsonb_array_elements(jsonb_build_array(boundary->'points')||(boundary->'holes')) r,
 jsonb_array_elements(r) p where (p->>0)::float8 not between box[1]-1 and box[3]+1 or (p->>1)::float8 not between box[2]-1 and box[4]+1) then raise exception 'OUTSIDE_DRAWING';end if;
 insert into public.site_slab_regions(drawing_id,item_key,geometry,hidden,version,updated_by)
 values(drawing,item,jsonb_build_object('points',boundary->'points','holes',boundary->'holes'),hide_region,expected_version+1,auth.uid())
 on conflict(drawing_id,item_key) do update set geometry=excluded.geometry,hidden=excluded.hidden,version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.slab_region_audit(drawing_id,item_key,changed_by,before_value,after_value)
 values(drawing,item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));return result;
end $$;
create function public.site_save_slab_region(drawing text,item text,expected_version integer,boundary jsonb,hide_region boolean)
returns public.site_slab_regions language sql security invoker set search_path='' as $$
 select seoripul_private.save_slab_region(drawing,item,expected_version,boundary,hide_region);
$$;
revoke execute on function seoripul_private.segments_touch(jsonb,jsonb,jsonb,jsonb),seoripul_private.ring_contains(jsonb,jsonb),seoripul_private.validate_slab_geometry(jsonb) from public,anon,authenticated;
revoke execute on function seoripul_private.save_slab_region(text,text,integer,jsonb,boolean),public.site_save_slab_region(text,text,integer,jsonb,boolean) from public,anon;
grant execute on function seoripul_private.save_slab_region(text,text,integer,jsonb,boolean),public.site_save_slab_region(text,text,integer,jsonb,boolean) to authenticated;

create or replace function seoripul_private.save_slab_record(drawing text,item text,expected_version integer,
 member_label text,member_spec text,slab_type text,deck_date date,rebar_date date,cast_date date,memo text)
returns public.site_trade_records language plpgsql security definer set search_path='' as $$
declare old_row public.site_trade_records; result public.site_trade_records;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 if expected_version is null or expected_version<0 or member_label is null or length(member_label)>120
  or member_spec is null or length(member_spec)>120 or memo is null or length(memo)>2000
  or slab_type is null or slab_type not in ('','deck','conventional','temporary','opening') then raise exception 'INVALID_RECORD'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab:'||item,0));
 if exists(select 1 from public.site_slab_regions where drawing_id=drawing and item_key=item and hidden)
 or not (exists(select 1 from public.site_drawings d,jsonb_array_elements(coalesce(d.document->'drawing'->'slabs','[]'::jsonb)) v where d.id=drawing and v->>'key'=item)
 or exists(select 1 from public.site_slab_regions where drawing_id=drawing and item_key=item and not hidden)) then raise exception 'UNKNOWN_MEMBER';end if;
 select * into old_row from public.site_trade_records where drawing_id=drawing and trade='slab' and item_key=item;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 insert into public.site_trade_records(drawing_id,trade,item_key,label,spec,completed,note,slab_kind,decked,reinforced,version,updated_by)
 values(drawing,'slab',item,member_label,member_spec,cast_date,memo,slab_type,deck_date,rebar_date,expected_version+1,auth.uid())
 on conflict(drawing_id,trade,item_key) do update set label=excluded.label,spec=excluded.spec,completed=excluded.completed,note=excluded.note,
 slab_kind=excluded.slab_kind,decked=excluded.decked,reinforced=excluded.reinforced,version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.trade_record_audit(drawing_id,trade,item_key,changed_by,before_value,after_value)
 values(drawing,'slab',item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));return result;
end $$;
notify pgrst, 'reload schema';
commit;
