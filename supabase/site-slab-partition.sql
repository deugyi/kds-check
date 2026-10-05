-- Atomic slab partition updates. Original drawing and construction records remain unchanged.
begin;
create function seoripul_private.validate_slab_polygon(g jsonb,max_points integer,max_holes integer,max_total integer,min_area float8,min_edge_sq float8)
returns void language plpgsql immutable set search_path='' as $$
declare rings jsonb;ring jsonb;other jsonb;p jsonb;a jsonb;b jsonb;i integer;j integer;k integer;l integer;n integer;total integer:=0;area float8;net float8:=0;ax float8;ay float8;
begin
 if g is null or jsonb_typeof(g)<>'object' or jsonb_typeof(g->'points') is distinct from 'array'
 or jsonb_typeof(g->'holes') is distinct from 'array' or jsonb_array_length(g->'holes')>max_holes then raise exception 'INVALID_GEOMETRY';end if;
 rings:=jsonb_build_array(g->'points')||(g->'holes');
 for ring in select value from jsonb_array_elements(rings) loop
  if jsonb_typeof(ring)<>'array' or jsonb_array_length(ring) not between 3 and max_points then raise exception 'INVALID_GEOMETRY';end if;
  n:=jsonb_array_length(ring);total:=total+n;if total>max_total then raise exception 'INVALID_GEOMETRY';end if;
  for p in select value from jsonb_array_elements(ring) loop
   if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' then raise exception 'INVALID_GEOMETRY';end if;
   if abs((p->>0)::numeric)>1e9 or abs((p->>1)::numeric)>1e9 then raise exception 'INVALID_GEOMETRY';end if;
  end loop;
 end loop;
 for k in 0..jsonb_array_length(rings)-1 loop
  ring:=rings->k;n:=jsonb_array_length(ring);area:=0;ax:=(ring->0->>0)::float8;ay:=(ring->0->>1)::float8;
  for i in 0..n-1 loop
   a:=ring->i;b:=ring->((i+1)%n);
   if power((a->>0)::float8-(b->>0)::float8,2)+power((a->>1)::float8-(b->>1)::float8,2)<min_edge_sq then raise exception 'INVALID_GEOMETRY';end if;
   area:=area+((a->>0)::float8-ax)*((b->>1)::float8-ay)-((b->>0)::float8-ax)*((a->>1)::float8-ay);
   for j in i+1..n-1 loop
    if j<>i+1 and not(i=0 and j=n-1) and seoripul_private.segments_touch(a,b,ring->j,ring->((j+1)%n)) then raise exception 'INVALID_GEOMETRY';end if;
   end loop;
  end loop;
  if abs(area)/2<min_area then raise exception 'INVALID_GEOMETRY';end if;
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
 end loop;if net<min_area then raise exception 'INVALID_GEOMETRY';end if;
end $$;


create function seoripul_private.slab_shape(g jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare part jsonb;total integer:=0;canonical jsonb;
begin
 if g is null or jsonb_typeof(g)<>'object' then raise exception 'INVALID_GEOMETRY';end if;
 if g ? 'parts' then
  if jsonb_typeof(g->'parts') is distinct from 'array' or jsonb_array_length(g->'parts') not between 1 and 200 then raise exception 'INVALID_GEOMETRY';end if;
  for part in select value from jsonb_array_elements(g->'parts') loop
   perform seoripul_private.validate_slab_polygon(part,1000,200,2000,0.001,1e-12);
   select total+sum(jsonb_array_length(r))::integer into total from jsonb_array_elements(jsonb_build_array(part->'points')||(part->'holes')) r;
   if total>2000 then raise exception 'INVALID_GEOMETRY';end if;
  end loop;
  canonical:=jsonb_build_object('points',g->'parts'->0->'points','holes',g->'parts'->0->'holes','parts',g->'parts');
 else
  perform seoripul_private.validate_slab_geometry(g);
  canonical:=jsonb_build_object('points',g->'points','holes',g->'holes');
 end if;return canonical;
end $$;
create function seoripul_private.slab_shape_in_bounds(g jsonb,box float8[]) returns boolean
language sql immutable set search_path='' as $$
 select box[1] is not null and not exists(
  select 1 from jsonb_array_elements(coalesce(g->'parts',jsonb_build_array(g))) part,
  jsonb_array_elements(jsonb_build_array(part->'points')||(part->'holes')) ring,
  jsonb_array_elements(ring) p
  where (p->>0)::float8 not between box[1]-1 and box[3]+1 or (p->>1)::float8 not between box[2]-1 and box[4]+1);
$$;
-- The shared floor lock serializes single-item hide/restore with partition batches.
create or replace function seoripul_private.save_slab_region(drawing text,item text,expected_version integer,boundary jsonb,hide_region boolean)
returns public.site_slab_regions language plpgsql security definer set search_path='' as $$
declare old_row public.site_slab_regions;result public.site_slab_regions;doc jsonb;box float8[];normalized jsonb;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501';end if;
 if expected_version is null or expected_version<0 or hide_region is null or item is null or length(item)>120 then raise exception 'INVALID_GEOMETRY';end if;
 select document->'drawing' into doc from public.site_drawings where id=drawing;
 if doc is null or jsonb_typeof(doc->'zones') is distinct from 'array' or jsonb_typeof(doc->'members') is distinct from 'array' then raise exception 'UNKNOWN_DRAWING';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab-regions',0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab:'||item,0));
 select * into old_row from public.site_slab_regions where drawing_id=drawing and item_key=item;
 if not exists(select 1 from jsonb_array_elements(coalesce(doc->'slabs','[]'::jsonb)) v where v->>'key'=item)
 and old_row.version is null and item!~'^USER-SLAB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'UNKNOWN_MEMBER';end if;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'REGION_CONFLICT' using errcode='40001';end if;
 if boundary is not null and exists(select 1 from jsonb_array_elements(coalesce(doc->'slabs','[]'::jsonb)) v where v->>'key'=item and boundary=jsonb_build_object('points',v->'points','holes',coalesce(v->'holes','[]'::jsonb))) then normalized:=boundary;
 else normalized:=seoripul_private.slab_shape(boundary);end if;
 select array[min((p->>0)::float8),min((p->>1)::float8),max((p->>0)::float8),max((p->>1)::float8)] into box from jsonb_array_elements(doc->'zones') z,jsonb_array_elements(z->'points') p;
 if not seoripul_private.slab_shape_in_bounds(normalized,box) then raise exception 'OUTSIDE_DRAWING';end if;
 insert into public.site_slab_regions(drawing_id,item_key,geometry,hidden,version,updated_by)
 values(drawing,item,normalized,hide_region,expected_version+1,auth.uid())
 on conflict(drawing_id,item_key) do update set geometry=excluded.geometry,hidden=excluded.hidden,version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into seoripul_private.slab_region_audit(drawing_id,item_key,changed_by,before_value,after_value)
 values(drawing,item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));return result;
end $$;
create function seoripul_private.save_slab_regions(drawing text,changes jsonb,expected_state jsonb)
returns setof public.site_slab_regions language plpgsql security definer set search_path='' as $$
declare doc jsonb;base_shapes jsonb;state jsonb;change jsonb;item text;version_in integer;hide_region boolean;
 boundary jsonb;normalized jsonb;box float8[];old_row public.site_slab_regions;result public.site_slab_regions;
begin
 if auth.uid() is null or coalesce(public.site_role(),'') not in ('viewer','editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) not between 1 and 3000 or jsonb_typeof(expected_state) is distinct from 'object' then raise exception 'INVALID_GEOMETRY';end if;
 select document->'drawing' into doc from public.site_drawings where id=drawing;
 if doc is null or jsonb_typeof(doc->'zones') is distinct from 'array' or jsonb_typeof(doc->'members') is distinct from 'array' then raise exception 'UNKNOWN_DRAWING';end if;
 if (select count(distinct value->>'item_key') from jsonb_array_elements(changes))<>jsonb_array_length(changes) then raise exception 'INVALID_GEOMETRY';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab-regions',0));
 select coalesce(jsonb_object_agg(item_key,version),'{}'::jsonb) into state from public.site_slab_regions where drawing_id=drawing;
 if state<>expected_state then raise exception 'REGION_STATE_CONFLICT' using errcode='40001';end if;
 select coalesce(jsonb_object_agg(v->>'key',jsonb_build_object('points',v->'points','holes',coalesce(v->'holes','[]'::jsonb))),'{}'::jsonb) into base_shapes from jsonb_array_elements(coalesce(doc->'slabs','[]'::jsonb)) v;
 select array[min((p->>0)::float8),min((p->>1)::float8),max((p->>0)::float8),max((p->>1)::float8)] into box from jsonb_array_elements(doc->'zones') z,jsonb_array_elements(z->'points') p;
 for change in select value from jsonb_array_elements(changes) loop
  if jsonb_typeof(change)<>'object' or jsonb_typeof(change->'item_key') is distinct from 'string' or length(change->>'item_key')>120
  or jsonb_typeof(change->'hidden') is distinct from 'boolean' or jsonb_typeof(change->'expected_version') is distinct from 'number'
  or (change->>'expected_version')!~'^[0-9]{1,9}$' then raise exception 'INVALID_GEOMETRY';end if;
  item:=change->>'item_key';version_in:=(change->>'expected_version')::integer;hide_region:=(change->>'hidden')::boolean;boundary:=change->'geometry';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':slab:'||item,0));
  select * into old_row from public.site_slab_regions where drawing_id=drawing and item_key=item;
  if not (base_shapes ? item) and old_row.version is null and item!~'^USER-SLAB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'UNKNOWN_MEMBER';end if;
  if coalesce(old_row.version,0)<>version_in then raise exception 'REGION_CONFLICT' using errcode='40001';end if;
  if boundary is not null and boundary=base_shapes->item then normalized:=boundary;else normalized:=seoripul_private.slab_shape(boundary);end if;
  if not seoripul_private.slab_shape_in_bounds(normalized,box) then raise exception 'OUTSIDE_DRAWING';end if;
  insert into public.site_slab_regions(drawing_id,item_key,geometry,hidden,version,updated_by)
  values(drawing,item,normalized,hide_region,version_in+1,auth.uid())
  on conflict(drawing_id,item_key) do update set geometry=excluded.geometry,hidden=excluded.hidden,version=excluded.version,updated_at=now(),updated_by=auth.uid() returning * into result;
  insert into seoripul_private.slab_region_audit(drawing_id,item_key,changed_by,before_value,after_value)
  values(drawing,item,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));return next result;
 end loop;
end $$;
create function public.site_save_slab_regions(drawing text,changes jsonb,expected_state jsonb)
returns setof public.site_slab_regions language sql security invoker set search_path='' as $$
 select * from seoripul_private.save_slab_regions(drawing,changes,expected_state);
$$;
revoke execute on function seoripul_private.validate_slab_polygon(jsonb,integer,integer,integer,float8,float8),seoripul_private.slab_shape(jsonb),seoripul_private.slab_shape_in_bounds(jsonb,float8[]) from public,anon,authenticated;
revoke execute on function seoripul_private.save_slab_regions(text,jsonb,jsonb),public.site_save_slab_regions(text,jsonb,jsonb) from public,anon;
grant execute on function seoripul_private.save_slab_regions(text,jsonb,jsonb),public.site_save_slab_regions(text,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
