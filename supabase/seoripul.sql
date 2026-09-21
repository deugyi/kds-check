-- Run once in the existing project SQL Editor. No existing objects are replaced.
begin;
create schema if not exists seoripul_private;
revoke all on schema seoripul_private from public, anon, authenticated;
create table seoripul_private.settings (id boolean primary key default true check(id), owner_email text not null);
-- Set the owner separately in the dashboard, never from a browser request.
create table public.site_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 role text not null default 'pending' check(role in ('pending','viewer','editor','admin','blocked')),
 created_at timestamptz not null default now()
);
create table public.site_drawings (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 document jsonb not null check(document->>'id'=id)
);
create table public.site_prd_records (
 drawing_id text not null references public.site_drawings(id),
 pile_key text not null,
 drilled date, delivered date, installed date, note text not null default '' check(length(note)<=2000),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id),
 primary key(drawing_id,pile_key),
 check(drilled is null or drilled between date '0001-01-01' and date '9999-12-31'),
 check(delivered is null or delivered between date '0001-01-01' and date '9999-12-31'),
 check(installed is null or installed between date '0001-01-01' and date '9999-12-31'),
 check(installed is null or drilled is null or installed>=drilled),
 check(installed is null or delivered is null or installed>=delivered)
);
create table seoripul_private.record_audit (
 id bigint generated always as identity primary key,
 drawing_id text not null, pile_key text not null, changed_at timestamptz not null default now(),
 changed_by uuid not null, before_value jsonb, after_value jsonb not null
);
alter table seoripul_private.settings enable row level security;
alter table seoripul_private.record_audit enable row level security;
alter table public.site_members enable row level security;
alter table public.site_drawings enable row level security;
alter table public.site_prd_records enable row level security;
revoke all on public.site_members,public.site_drawings,public.site_prd_records from anon,authenticated;
grant select on public.site_members,public.site_drawings,public.site_prd_records to authenticated;

create function seoripul_private.google_email() returns text language sql stable security definer set search_path='' as $$
 select lower(u.email) from auth.users u
 where u.id=auth.uid() and u.email_confirmed_at is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google'
   and lower(i.identity_data->>'email')=lower(u.email)
   and i.identity_data->>'email_verified'='true')
$$;
create function public.site_role() returns text language sql stable security definer set search_path='' as $$
 select m.role from public.site_members m where m.user_id=auth.uid()
 and m.email=seoripul_private.google_email()
$$;
create policy site_member_self_or_admin on public.site_members for select to authenticated
 using(user_id=auth.uid() or public.site_role()='admin');
create policy site_drawing_members on public.site_drawings for select to authenticated
 using(public.site_role() in ('viewer','editor','admin'));
create policy site_record_members on public.site_prd_records for select to authenticated
 using(public.site_role() in ('viewer','editor','admin'));

create function public.site_register() returns public.site_members language plpgsql security definer set search_path='' as $$
declare mail text:=seoripul_private.google_email(); result public.site_members;
begin
 if mail is null then raise exception 'GOOGLE_VERIFICATION_REQUIRED' using errcode='42501'; end if;
 insert into public.site_members(user_id,email,role)
 values(auth.uid(),mail,case when mail=(select owner_email from seoripul_private.settings where id) then 'admin' else 'pending' end)
 on conflict(user_id) do nothing;
 select * into result from public.site_members where user_id=auth.uid();
 if result.email<>mail then raise exception 'ACCOUNT_EMAIL_CHANGED' using errcode='42501'; end if;
 return result;
end $$;

create function public.site_set_role(target_user uuid,new_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.site_role() is distinct from 'admin' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if new_role not in ('pending','viewer','editor','blocked') or new_role is null then raise exception 'INVALID_ROLE'; end if;
 if target_user=auth.uid() or exists(select 1 from public.site_members where user_id=target_user and role='admin') then raise exception 'OWNER_ROLE_PROTECTED'; end if;
 update public.site_members set role=new_role where user_id=target_user;
 if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
end $$;

create function public.site_save_prd(drawing text,pile text,expected_version integer,
 drilled_date date,delivered_date date,installed_date date,memo text)
returns public.site_prd_records language plpgsql security definer set search_path='' as $$
declare old_row public.site_prd_records; result public.site_prd_records;
begin
 if coalesce(public.site_role(),'') not in ('editor','admin') then raise exception 'EDIT_ACCESS_REQUIRED' using errcode='42501'; end if;
 if expected_version is null or expected_version<0 or memo is null or length(memo)>2000 then raise exception 'INVALID_RECORD'; end if;
 if not exists(select 1 from public.site_drawings d,
 jsonb_array_elements(d.document->'drawing'->'piles') p
 where d.id=drawing and p->>'key'=pile) then raise exception 'UNKNOWN_PILE'; end if;
 -- Serializes concurrent edits (including first inserts) for the same pile.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(drawing||':'||pile,0));
 select * into old_row from public.site_prd_records where drawing_id=drawing and pile_key=pile;
 if coalesce(old_row.version,0)<>expected_version then raise exception 'RECORD_CONFLICT' using errcode='40001'; end if;
 insert into public.site_prd_records(drawing_id,pile_key,drilled,delivered,installed,note,version,updated_by)
 values(drawing,pile,drilled_date,delivered_date,installed_date,memo,expected_version+1,auth.uid())
 on conflict(drawing_id,pile_key) do update set
 drilled=excluded.drilled,delivered=excluded.delivered,installed=excluded.installed,note=excluded.note,
 version=excluded.version,updated_at=now(),updated_by=auth.uid()
 returning * into result;
 insert into seoripul_private.record_audit(drawing_id,pile_key,changed_by,before_value,after_value)
 values(drawing,pile,auth.uid(),case when old_row.version is null then null else to_jsonb(old_row) end,to_jsonb(result));
 return result;
end $$;
revoke all on function seoripul_private.google_email() from public,anon,authenticated;
revoke all on function public.site_role(),public.site_register(),public.site_set_role(uuid,text),public.site_save_prd(text,text,integer,date,date,date,text) from public,anon,authenticated;
grant execute on function public.site_role(),public.site_register(),public.site_set_role(uuid,text),public.site_save_prd(text,text,integer,date,date,date,text) to authenticated;
commit;
