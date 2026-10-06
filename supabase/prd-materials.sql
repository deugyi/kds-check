-- Run after seoripul.sql. Imported source facts share the existing PRD read policy.
begin;
alter table public.site_prd_records add column if not exists material_details jsonb;
alter table public.site_prd_records add constraint site_prd_material_object
 check(material_details is null or jsonb_typeof(material_details)='object');
-- Direct writes remain revoked. site_save_prd updates only its existing date/memo columns,
-- preserving imported facts and returning them with the composite record type.
notify pgrst, 'reload schema';
commit;
