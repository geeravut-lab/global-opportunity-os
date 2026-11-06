-- Bind previews/packages to the current named referral notice; operators select notices after policy review.
alter table app.notice_versions add constraint s4_notice_locale unique(id,locale);
create table private.s4_current_notices(locale text primary key check(locale in('th','en')),notice_id uuid not null unique,foreign key(notice_id,locale) references app.notice_versions(id,locale));
insert into private.s4_current_notices values('th','00000000-0000-4000-8000-000000000401'),('en','00000000-0000-4000-8000-000000000402');
alter table private.s4_current_notices enable row level security;
revoke all on private.s4_current_notices from public,anon,authenticated,goos_api,goos_worker,goos_reporter;
create policy s4_notice_authz on private.s4_current_notices for select to goos_authz using(true);
grant select on private.s4_current_notices to goos_authz;
create function private.goos_s4_notice_id(p_locale text) returns uuid language sql stable security definer set search_path='' as $$select notice_id from private.s4_current_notices where locale=p_locale;$$;
create function private.goos_s4_current_notice(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.s4_current_notices where notice_id=p_id);$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_notice_id(text) owner to goos_authz;
alter function private.goos_s4_current_notice(uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_notice_id(text),private.goos_s4_current_notice(uuid) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_notice_id(text),private.goos_s4_current_notice(uuid) to goos_api;
alter table private.s4_packages add column notice_purpose text not null default 'referral' check(notice_purpose='referral');
alter table private.s4_packages add foreign key(notice_id,notice_purpose) references app.notice_versions(id,purpose);
alter table private.s4_previews add column notice_purpose text not null default 'referral' check(notice_purpose='referral');
alter table private.s4_previews add foreign key(notice_id,notice_purpose) references app.notice_versions(id,purpose);
create or replace function public.goos_s4_notice(p_locale text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_s4_enabled() then raise exception 's4_not_enabled' using errcode='42501';end if;
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 return(select jsonb_build_object('id',id,'body',body,'hash',content_hash,'version',version_label,'environment',environment) from app.notice_versions where id=private.goos_s4_notice_id(p_locale) and purpose='referral');
end $$;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_preview(uuid,text[],jsonb,uuid)'::regprocedure);
 r:=replace(d,$s$if not private.goos_s3_fields(p_fields) or not exists$s$,$s$if not private.goos_s3_fields(p_fields) or not private.goos_s4_current_notice(p_notice) or not exists$s$);if r=d then raise exception 'S4 notice preview source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_submit(uuid,text,uuid,boolean,text)'::regprocedure);
 r:=replace(d,$s$if p.expires_at<=now()$s$,$s$if not private.goos_s4_current_notice(p.notice_id) or p.expires_at<=now()$s$);if r=d then raise exception 'S4 notice submit source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
