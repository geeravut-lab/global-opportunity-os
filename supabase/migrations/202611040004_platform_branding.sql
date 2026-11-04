-- Platform foundation; user JWT, MFA and current platform role required for every write.
create table private.platform_owner (singleton boolean primary key default true check(singleton),account_id uuid not null unique references app.accounts(id));
alter table private.platform_owner enable row level security;
create policy owner_authz on private.platform_owner for select to goos_authz using(true);
grant select on private.platform_owner to goos_authz;
create function private.goos_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and private.goos_has_platform_role();
$$;
create function private.goos_is_owner(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.platform_owner where account_id=p_id);
$$;

create table app.platform_settings (
 singleton boolean primary key default true check(singleton),name_th text not null default 'Global Opportunity OS',name_en text not null default 'Global Opportunity OS',
 version bigint not null default 1 check(version>0),logo_id uuid,favicon_id uuid,flags jsonb not null default '{}',updated_at timestamptz not null default now(),
 check(length(name_th) between 1 and 60 and length(name_en) between 1 and 60),check(name_th!~'[<>[:cntrl:]]' and name_en!~'[<>[:cntrl:]]'),
 check(jsonb_typeof(flags)='object' and flags <@ '{"live_sync":false,"branding":false}'::jsonb)
);
insert into app.platform_settings(singleton) values(true);
alter table app.platform_settings enable row level security;
create policy settings_public on app.platform_settings for select to goos_api using(true);
create policy settings_write on app.platform_settings for update to goos_api using(private.goos_platform_admin()) with check(private.goos_platform_admin());
grant select,update on app.platform_settings to goos_api;
create table private.brand_assets (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('logo','favicon')),body bytea not null,
 width integer not null check(width between 1 and 4096),height integer not null check(height between 1 and 4096),
 created_by uuid not null references app.accounts(id),created_at timestamptz not null default now(),
 check(substring(body from 1 for 8)=decode('89504e470d0a1a0a','hex')),
 check(octet_length(body) between 45 and 1048576),
 check(kind<>'favicon' or (width=height and width between 192 and 1024 and octet_length(body)<=524288))
);
alter table private.brand_assets enable row level security;
create policy brand_public_read on private.brand_assets for select to goos_api using(id in (select logo_id from app.platform_settings union select favicon_id from app.platform_settings));
create policy brand_admin_read on private.brand_assets for select to goos_api using(private.goos_platform_admin());
create policy brand_admin_write on private.brand_assets for insert to goos_api with check(private.goos_platform_admin() and created_by=private.goos_uid());
create policy brand_admin_delete on private.brand_assets for delete to goos_api using(private.goos_platform_admin());
grant select,insert,delete on private.brand_assets to goos_api;

create table app.notifications (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references app.accounts(id),
 kind text not null check(kind in ('admin.granted','admin.revoked','invitation.created','membership.revoked','security.password_changed')),
 read_at timestamptz,created_at timestamptz not null default now()
);
alter table app.notifications enable row level security;
create policy notice_own on app.notifications for select to goos_api using(account_id=private.goos_uid() and private.goos_actor_active());
create policy notice_read on app.notifications for update to goos_api using(account_id=private.goos_uid() and private.goos_actor_active()) with check(account_id=private.goos_uid());
create policy notice_writer on app.notifications for insert to goos_authz with check(true);
grant select,update(read_at) on app.notifications to goos_api;
grant insert on app.notifications to goos_authz;
create function private.goos_notify(p_account uuid,p_kind text) returns void language sql security definer set search_path='' as $$
 insert into app.notifications(account_id,kind) values(p_account,p_kind);
$$;

create policy platform_api_read on private.platform_role_grants for select to goos_api using(private.goos_platform_admin());
create policy platform_api_insert on private.platform_role_grants for insert to goos_api with check(private.goos_platform_admin() and role_code='platform_admin' and granted_by=private.goos_uid());
create policy platform_api_update on private.platform_role_grants for update to goos_api using(private.goos_platform_admin()) with check(private.goos_platform_admin());
grant select,insert on private.platform_role_grants to goos_api;
grant update(revoked_at) on private.platform_role_grants to goos_api;
create unique index platform_active_account on private.platform_role_grants(account_id,role_code) where revoked_at is null;
create policy audit_platform_read on private.audit_events for select to goos_api using(private.goos_platform_admin());
grant select on private.audit_events to goos_api;

create function public.goos_public_settings() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name_th',name_th,'name_en',name_en,'version',version,'logo_id',logo_id,'favicon_id',favicon_id,'flags',flags) from app.platform_settings where singleton;
$$;
create function public.goos_brand_image(p_kind text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.id,'body',encode(a.body,'base64'),'hash',encode(sha256(a.body),'hex')) from private.brand_assets a join app.platform_settings s on a.id=case p_kind when 'logo' then s.logo_id when 'favicon' then s.favicon_id end where s.singleton;
$$;
create function public.goos_save_settings(p_name_th text,p_name_en text,p_flags jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 update app.platform_settings set name_th=trim(p_name_th),name_en=trim(p_name_en),flags=p_flags,version=version+1,updated_at=now() where singleton and version=p_expected_version;
 get diagnostics v_count=row_count;if v_count<>1 then raise exception 'version_conflict' using errcode='40001';end if;
 perform private.goos_audit('settings.updated',null);return public.goos_public_settings();
end $$;
create function public.goos_save_brand(p_kind text,p_png text,p_width integer,p_height integer,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_settings app.platform_settings;v_id uuid;v_old uuid;v_bytes bytea;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 if p_kind not in ('logo','favicon') then raise exception 'invalid_input' using errcode='22023';end if;
 select * into strict v_settings from app.platform_settings where singleton for update;
 if v_settings.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001';end if;
 if v_settings.flags->>'branding'='false' then raise exception 'feature_disabled' using errcode='42501';end if;
 v_old:=case p_kind when 'logo' then v_settings.logo_id else v_settings.favicon_id end;
 if p_png is not null then
  if length(p_png)>1398200 then raise exception 'image_too_large' using errcode='22023';end if;
  v_bytes:=decode(p_png,'base64');
  if substring(v_bytes from 13 for 4)<>decode('49484452','hex') or substring(v_bytes from octet_length(v_bytes)-7 for 8)<>decode('49454e44ae426082','hex') then raise exception 'invalid_png' using errcode='22023';end if;
  if get_byte(v_bytes,16)::bigint*16777216+get_byte(v_bytes,17)*65536+get_byte(v_bytes,18)*256+get_byte(v_bytes,19)<>p_width or get_byte(v_bytes,20)::bigint*16777216+get_byte(v_bytes,21)*65536+get_byte(v_bytes,22)*256+get_byte(v_bytes,23)<>p_height then raise exception 'invalid_dimensions' using errcode='22023';end if;
  insert into private.brand_assets(kind,body,width,height,created_by) values(p_kind,v_bytes,p_width,p_height,private.goos_uid()) returning id into v_id;
 end if;
 update app.platform_settings set logo_id=case when p_kind='logo' then v_id else logo_id end,favicon_id=case when p_kind='favicon' then v_id else favicon_id end,version=version+1,updated_at=now() where singleton;
 if v_old is not null then delete from private.brand_assets where id=v_old;end if;
 perform private.goos_audit('branding.'||p_kind,v_id);return public.goos_public_settings();
end $$;
create function public.goos_admins() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',g.account_id,'owner',private.goos_is_owner(g.account_id),'granted_at',g.expires_at,'self',g.account_id=private.goos_uid())),'[]'::jsonb) from private.platform_role_grants g where g.revoked_at is null and (g.expires_at is null or g.expires_at>now()));
end $$;
create function public.goos_manage_admin(p_target uuid,p_grant boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() or p_target=private.goos_uid() or p_grant is null then raise exception 'not_found' using errcode='P0002';end if;
 perform 1 from private.platform_role_grants order by id for update;
 if not p_grant and private.goos_is_owner(p_target) then raise exception 'protected_owner' using errcode='23514';end if;
 if not private.goos_recipient_active(p_target) then raise exception 'not_found' using errcode='P0002';end if;
 if p_grant then
  insert into private.platform_role_grants(account_id,role_code,granted_by) values(p_target,'platform_admin',private.goos_uid());
 else
  update private.platform_role_grants set revoked_at=now() where account_id=p_target and revoked_at is null;
  if not found then raise exception 'state_conflict' using errcode='40001';end if;
 end if;
 perform private.goos_notify(p_target,case when p_grant then 'admin.granted' else 'admin.revoked' end);
 perform private.goos_audit(case when p_grant then 'admin.granted' else 'admin.revoked' end,p_target);
end $$;
create function public.goos_audit_events() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from(select id,actor_id,action,object_id,organization_id,occurred_at from private.audit_events order by occurred_at desc limit 100)e);
end $$;
create function public.goos_notifications() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb) from(select id,kind,read_at,created_at from app.notifications order by created_at desc limit 100)n;
$$;
create function public.goos_read_notice(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 update app.notifications set read_at=now() where id=p_id and account_id=private.goos_uid();
 if not found then raise exception 'not_found' using errcode='P0002';end if;
end $$;
create function public.goos_security_notice() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 perform private.goos_notify(private.goos_uid(),'security.password_changed');
 perform private.goos_audit('security.password_notice',private.goos_uid());
end $$;

-- Explicit ownership and EXECUTE allowlist; no browser table CRUD.
grant create on schema public to goos_api;
grant create on schema private to goos_authz;
alter function private.goos_platform_admin() owner to goos_authz;
alter function private.goos_is_owner(uuid) owner to goos_authz;
alter function private.goos_notify(uuid,text) owner to goos_authz;
revoke all on function private.goos_platform_admin(),private.goos_is_owner(uuid),private.goos_notify(uuid,text) from public,anon,authenticated;
grant execute on function private.goos_platform_admin(),private.goos_is_owner(uuid),private.goos_notify(uuid,text) to goos_api;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['goos_public_settings','goos_brand_image','goos_save_settings','goos_save_brand','goos_admins','goos_manage_admin','goos_audit_events','goos_notifications','goos_read_notice','goos_security_notice']) loop
 execute format('alter function %s owner to goos_api',f.signature);
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 if f.proname in ('goos_public_settings','goos_brand_image') then execute format('grant execute on function %s to anon',f.signature);end if;
 end loop;end $$;
revoke create on schema public from goos_api;
revoke create on schema private from goos_authz;
