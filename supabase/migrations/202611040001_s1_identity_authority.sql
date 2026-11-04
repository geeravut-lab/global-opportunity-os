-- S1 สำหรับ local/staging ที่แยกไว้เท่านั้น ห้ามรันกับ production โดยไม่ได้ทบทวน
create schema if not exists app;
create schema if not exists private;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='goos_api') then create role goos_api nologin noinherit nobypassrls; end if;
  if not exists(select 1 from pg_roles where rolname='goos_authz') then create role goos_authz nologin noinherit nobypassrls; end if;
end $$;
-- ให้เฉพาะผู้รัน migration เปลี่ยนเจ้าของฟังก์ชันได้ ไม่ให้สิทธิ์แก่ authenticated/anon
do $$ begin execute format('grant goos_api, goos_authz to %I',current_user); end $$;
revoke all on schema app, private from public, anon, authenticated;
grant usage on schema app, private, public to goos_api, goos_authz;

create table app.accounts (
 id uuid primary key references auth.users(id), display_name text not null default 'สมาชิก',
 locale text not null check(locale in ('th','en')), status text not null default 'active' check(status in ('active','suspended','deletion_pending')),
 created_at timestamptz not null default now()
);
create table app.subjects (
 id uuid primary key default gen_random_uuid(), account_id uuid not null unique references app.accounts(id),
 display_alias text not null check(length(trim(display_alias)) between 1 and 60),
 age_band text not null check(age_band='adult'), country_code text not null check(country_code ~ '^[A-Z]{2}$'),
 coarse_region text not null default '' check(length(coarse_region)<=80),
 safe_contact text not null default 'none' check(safe_contact in ('none','email')),
 status text not null default 'active' check(status in ('active','suspended')), version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table app.organizations (
 id uuid primary key default gen_random_uuid(), display_name text not null check(length(trim(display_name)) between 1 and 100),
 country_code text not null check(country_code ~ '^[A-Z]{2}$'), status text not null default 'draft' check(status in ('draft','verified','suspended','expired')),
 created_by uuid not null references app.accounts(id), created_at timestamptz not null default now()
);
create table app.role_definitions (
 code text primary key, realm text not null check(realm in ('org','platform')), unique(code,realm)
);
insert into app.role_definitions values ('owner','org'),('admin','org'),('catalog_editor','org'),('caseworker','org'),('supervisor','org'),('recruiter','org'),('platform_admin','platform');
create table app.org_memberships (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references app.organizations(id), account_id uuid not null references app.accounts(id),
 status text not null default 'active' check(status in ('active','revoked')), version integer not null default 1 check(version>0),
 unique(organization_id,account_id), created_at timestamptz not null default now()
);
create table app.org_member_roles (
 membership_id uuid not null references app.org_memberships(id), role_code text not null, realm text not null default 'org' check(realm='org'),
 primary key(membership_id,role_code), foreign key(role_code,realm) references app.role_definitions(code,realm)
);
create table app.org_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references app.organizations(id),
 recipient_account_id uuid not null references app.accounts(id), invited_by uuid not null references app.accounts(id),
 role_code text not null check(role_code in ('admin','catalog_editor','caseworker','supervisor','recruiter')),
 status text not null default 'pending' check(status in ('pending','accepted','cancelled')),
 expires_at timestamptz not null check(expires_at>created_at), created_at timestamptz not null default now()
);
create table app.notice_versions (
 id uuid primary key, locale text not null check(locale in ('th','en')), version_label text not null, body text not null,
 content_hash text not null, environment text not null check(environment='development'), unique(locale,version_label)
);
insert into app.notice_versions values
 ('00000000-0000-4000-8000-000000000001','th','dev-2026-11-04','สำหรับการทดสอบข้อมูลสมมติเท่านั้น โปรไฟล์เป็นของคุณ การมอบสิทธิ์ต้องระบุบัญชีผู้รับ ขอบเขต และวันหมดอายุ คุณถอนสิทธิ์ในอนาคตได้ ไม่มีการส่งต่อเคสหรือส่งข้อมูลให้พันธมิตรใน S1 ข้อความนี้ไม่ใช่นโยบาย production ที่ผ่านการรับรอง','pending','development'),
 ('00000000-0000-4000-8000-000000000002','en','dev-2026-11-04','Synthetic development testing only. You own your profile. Delegation names the recipient account, scopes and expiry, and can be revoked for future access. S1 sends no cases or partner disclosures. This is not an approved production privacy notice.','pending','development');
update app.notice_versions set content_hash=encode(sha256(convert_to(body,'UTF8')),'hex');
create table app.delegations (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null references app.subjects(id),
 delegate_account_id uuid not null references app.accounts(id), granted_by uuid not null references app.accounts(id),
 status text not null default 'active' check(status in ('active','revoked')), starts_at timestamptz not null default now(),
 expires_at timestamptz not null check(expires_at>starts_at), revoked_at timestamptz, version integer not null default 1 check(version>0),
 check(delegate_account_id<>granted_by)
);
create unique index delegation_active_pair on app.delegations(subject_id,delegate_account_id) where status='active';
create table app.delegation_scopes (
 delegation_id uuid not null references app.delegations(id), scope text not null check(scope in ('profile:read','profile:write')),
 primary key(delegation_id,scope)
);
create table private.consent_events (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null references app.subjects(id), actor_id uuid not null references app.accounts(id),
 recipient_account_id uuid references app.accounts(id), delegation_id uuid references app.delegations(id),
 purpose text not null check(purpose in ('profile_processing','profile_delegation')), notice_version_id uuid not null references app.notice_versions(id),
 action text not null check(action in ('granted','withdrawn')), scopes text[] not null default '{}', occurred_at timestamptz not null default now()
);
create table private.revoked_sessions (
 session_id uuid primary key, account_id uuid not null references app.accounts(id), revoked_at timestamptz not null default now()
);
create table private.audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references app.accounts(id), action text not null,
 object_id uuid, organization_id uuid references app.organizations(id), occurred_at timestamptz not null default now()
);
create index on app.org_memberships(account_id,status);
create index on app.org_memberships(organization_id,status);
create index on app.org_invitations(recipient_account_id,status);
create index on app.delegations(delegate_account_id,status,expires_at);
create index on private.consent_events(subject_id,occurred_at);

-- แยกบทบาทอ่าน metadata สิทธิ์จากบทบาท API เพื่อเลี่ยง RLS recursion โดยไม่ใช้ BYPASSRLS
create function private.goos_session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid())
 and not exists(select 1 from private.revoked_sessions r where r.session_id::text=auth.jwt()->>'session_id' and r.account_id=auth.uid());
$$;
create function private.goos_verified_identity() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous);
$$;
create function private.goos_actor_active() returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_session_valid() and private.goos_verified_identity() and exists(select 1 from app.accounts a where a.id=auth.uid() and a.status='active');
$$;
create function private.goos_staff_assured() returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and auth.jwt()->>'aal'='aal2' and exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified');
$$;
create function private.goos_has_org_role(p_org uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id
 where m.organization_id=p_org and m.account_id=auth.uid() and m.status='active' and r.role_code=any(p_roles));
$$;
create function private.goos_inviter_valid(p_org uuid,p_actor uuid,p_role text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.accounts a join app.org_memberships m on m.account_id=a.id join app.org_member_roles r on r.membership_id=m.id
 where a.id=p_actor and a.status='active' and m.organization_id=p_org and m.status='active' and (r.role_code='owner' or r.role_code='admin' and p_role<>'admin'));
$$;
create function private.goos_recipient_active(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from app.accounts a where a.id=p_id and a.status='active'); $$;
create function private.goos_owns_subject(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from app.subjects s where s.id=p_id and s.account_id=auth.uid() and s.status='active' and s.age_band='adult');
$$;
create function private.goos_can_subject(p_id uuid,p_scope text) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from app.subjects s where s.id=p_id and s.status='active' and s.age_band='adult' and
 (s.account_id=auth.uid() or exists(select 1 from app.delegations d join app.delegation_scopes sc on sc.delegation_id=d.id
 where d.subject_id=s.id and d.delegate_account_id=auth.uid() and d.status='active' and d.starts_at<=now() and d.expires_at>now() and sc.scope=p_scope)));
$$;
create function private.goos_audit(p_action text,p_object uuid,p_org uuid default null) returns void language sql security definer set search_path='' as $$
 insert into private.audit_events(actor_id,action,object_id,organization_id) values(auth.uid(),p_action,p_object,p_org);
$$;

-- ไม่มี table grants โดยตรงแก่ anon/authenticated; ช่องทาง user JWT เป็น RPC ที่ตรวจ actor ภายใน
alter table app.accounts enable row level security;
create policy account_api_read on app.accounts for select to goos_api using(id=auth.uid() and status='active' and private.goos_session_valid());
create policy account_api_insert on app.accounts for insert to goos_api with check(id=auth.uid() and private.goos_verified_identity() and private.goos_session_valid());
create policy account_authz on app.accounts for select to goos_authz using(true);
alter table app.subjects enable row level security;
create policy subject_api_read on app.subjects for select to goos_api using(private.goos_can_subject(id,'profile:read'));
create policy subject_api_insert on app.subjects for insert to goos_api with check(account_id=auth.uid() and age_band='adult' and private.goos_actor_active());
create policy subject_api_update on app.subjects for update to goos_api using(private.goos_can_subject(id,'profile:write')) with check(private.goos_can_subject(id,'profile:write') and age_band='adult');
create policy subject_authz on app.subjects for select to goos_authz using(true);
alter table app.org_memberships enable row level security;
create policy membership_api_read on app.org_memberships for select to goos_api using(private.goos_actor_active() and (account_id=auth.uid() or private.goos_staff_assured() and private.goos_has_org_role(organization_id,array['owner','admin'])));
create policy membership_api_insert on app.org_memberships for insert to goos_api with check(private.goos_staff_assured() and (account_id=auth.uid() or private.goos_has_org_role(organization_id,array['owner','admin'])));
create policy membership_api_update on app.org_memberships for update to goos_api using(private.goos_staff_assured() and private.goos_has_org_role(organization_id,array['owner','admin'])) with check(private.goos_staff_assured() and private.goos_has_org_role(organization_id,array['owner','admin']));
create policy membership_authz on app.org_memberships for select to goos_authz using(true);
alter table app.org_member_roles enable row level security;
create policy roles_api_read on app.org_member_roles for select to goos_api using(exists(select 1 from app.org_memberships m where m.id=membership_id));
create policy roles_api_insert on app.org_member_roles for insert to goos_api with check(private.goos_staff_assured() and exists(select 1 from app.org_memberships m where m.id=membership_id and (m.account_id=auth.uid() or private.goos_has_org_role(m.organization_id,array['owner','admin']))));
create policy roles_authz on app.org_member_roles for select to goos_authz using(true);
alter table app.organizations enable row level security;
create policy org_api_read on app.organizations for select to goos_api using(private.goos_actor_active() and (
 private.goos_staff_assured() and private.goos_has_org_role(id,array['owner','admin','catalog_editor','caseworker','supervisor','recruiter'])
 or exists(select 1 from app.org_invitations i where i.organization_id=id and i.recipient_account_id=auth.uid() and i.status='pending' and i.expires_at>now())));
create policy org_api_insert on app.organizations for insert to goos_api with check(created_by=auth.uid() and status='draft' and private.goos_staff_assured());
alter table app.org_invitations enable row level security;
create policy invites_api_read on app.org_invitations for select to goos_api using(private.goos_actor_active() and (recipient_account_id=auth.uid() or private.goos_staff_assured() and private.goos_has_org_role(organization_id,array['owner','admin'])));
create policy invites_api_insert on app.org_invitations for insert to goos_api with check(invited_by=auth.uid() and private.goos_staff_assured() and private.goos_has_org_role(organization_id,array['owner','admin']));
create policy invites_api_update on app.org_invitations for update to goos_api using(private.goos_staff_assured() and recipient_account_id=auth.uid()) with check(private.goos_staff_assured() and recipient_account_id=auth.uid());
alter table app.role_definitions enable row level security;
create policy role_def_api_read on app.role_definitions for select to goos_api using(realm='org' and private.goos_actor_active());
alter table app.notice_versions enable row level security;
create policy notice_api_read on app.notice_versions for select to goos_api using(private.goos_actor_active());
alter table app.delegations enable row level security;
create policy delegation_api_read on app.delegations for select to goos_api using(private.goos_actor_active() and (delegate_account_id=auth.uid() or private.goos_owns_subject(subject_id)));
create policy delegation_api_insert on app.delegations for insert to goos_api with check(granted_by=auth.uid() and private.goos_owns_subject(subject_id));
create policy delegation_api_update on app.delegations for update to goos_api using(private.goos_owns_subject(subject_id)) with check(private.goos_owns_subject(subject_id));
create policy delegation_authz on app.delegations for select to goos_authz using(true);
alter table app.delegation_scopes enable row level security;
create policy scopes_api_read on app.delegation_scopes for select to goos_api using(exists(select 1 from app.delegations d where d.id=delegation_id));
create policy scopes_api_insert on app.delegation_scopes for insert to goos_api with check(exists(select 1 from app.delegations d where d.id=delegation_id and private.goos_owns_subject(d.subject_id)));
create policy scopes_authz on app.delegation_scopes for select to goos_authz using(true);
alter table private.consent_events enable row level security;
create policy consent_api_read on private.consent_events for select to goos_api using(private.goos_owns_subject(subject_id));
create policy consent_api_insert on private.consent_events for insert to goos_api with check(actor_id=auth.uid() and private.goos_owns_subject(subject_id));
alter table private.revoked_sessions enable row level security;
create policy session_authz_read on private.revoked_sessions for select to goos_authz using(true);
create policy session_api_insert on private.revoked_sessions for insert to goos_api with check(account_id=auth.uid());
create policy session_api_read on private.revoked_sessions for select to goos_api using(account_id=auth.uid());
alter table private.audit_events enable row level security;
create policy audit_authz_insert on private.audit_events for insert to goos_authz with check(actor_id=auth.uid() and private.goos_actor_active());

-- RPC ทุกตัวใช้ auth.uid() จาก token ที่ PostgREST ตรวจแล้ว ไม่รับ actor/owner จาก request body
create function public.goos_bootstrap_account(p_locale text default 'th') returns uuid language plpgsql security definer set search_path='' as $$
declare v_count integer; begin
 if not private.goos_verified_identity() or not private.goos_session_valid() then raise exception 'not_authenticated' using errcode='28000'; end if;
 if p_locale not in ('th','en') then raise exception 'invalid_input' using errcode='22023'; end if;
 insert into app.accounts(id,locale) values(auth.uid(),p_locale) on conflict(id) do nothing;
 get diagnostics v_count=row_count;
 if not private.goos_actor_active() then raise exception 'account_inactive' using errcode='28000'; end if;
 if v_count=1 then perform private.goos_audit('account.created',auth.uid()); end if;
 return auth.uid(); end $$;
create function public.goos_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000'; end if;
 return jsonb_build_object('account_id',auth.uid(),'locale',(select locale from app.accounts where id=auth.uid()),
 'subject_id',(select id from app.subjects where account_id=auth.uid()),'aal',auth.jwt()->>'aal','staff_assured',private.goos_staff_assured(),
 'has_membership',exists(select 1 from app.org_memberships where account_id=auth.uid() and status='active'));
end $$;
create function public.goos_notices(p_locale text) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version_label,'body',body,'hash',content_hash,'environment',environment)),'[]'::jsonb) from app.notice_versions where locale=p_locale;
$$;
create function public.goos_create_profile(p_display_alias text,p_country_code text,p_age_band text,p_notice_id uuid,p_confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000'; end if;
 if p_age_band is distinct from 'adult' or p_confirmed is distinct from true then raise exception 'adult_confirmation_required' using errcode='22023'; end if;
 if not exists(select 1 from app.notice_versions where id=p_notice_id and environment='development') then raise exception 'notice_required' using errcode='22023'; end if;
 insert into app.subjects(id,account_id,display_alias,country_code,age_band) values(v_id,auth.uid(),trim(p_display_alias),p_country_code,'adult');
 insert into private.consent_events(subject_id,actor_id,purpose,notice_version_id,action) values(v_id,auth.uid(),'profile_processing',p_notice_id,'granted');
 perform private.goos_audit('profile.created',v_id);return v_id;
end $$;
create function public.goos_profile(p_subject_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;begin
 if not private.goos_can_subject(p_subject_id,'profile:read') then raise exception 'not_found' using errcode='P0002'; end if;
 select jsonb_build_object('id',id,'display_alias',display_alias,'country_code',country_code,'coarse_region',coarse_region,
 'safe_contact',case when account_id=auth.uid() then safe_contact else null end,'version',version,'own',account_id=auth.uid(),
 'can_write',private.goos_can_subject(id,'profile:write')) into v_result from app.subjects where id=p_subject_id;
 return v_result;end $$;
create function public.goos_update_profile(p_subject_id uuid,p_display_alias text,p_coarse_region text,p_safe_contact text,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old app.subjects;begin
 if not private.goos_can_subject(p_subject_id,'profile:write') then raise exception 'not_found' using errcode='P0002'; end if;
 select * into strict v_old from app.subjects where id=p_subject_id for update;
 if v_old.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001'; end if;
 if v_old.account_id<>auth.uid() and p_safe_contact is not null then raise exception 'not_found' using errcode='P0002'; end if;
 update app.subjects set display_alias=trim(p_display_alias),coarse_region=p_coarse_region,safe_contact=coalesce(p_safe_contact,v_old.safe_contact),version=version+1,updated_at=now() where id=p_subject_id;
 perform private.goos_audit('profile.updated',p_subject_id);return public.goos_profile(p_subject_id);end $$;
create function public.goos_create_delegation(p_subject_id uuid,p_delegate_id uuid,p_scopes text[],p_expires_at timestamptz,p_notice_id uuid,p_confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();begin
 if not private.goos_owns_subject(p_subject_id) then raise exception 'not_found' using errcode='P0002'; end if;
 if p_confirmed is distinct from true or p_delegate_id=auth.uid() or not private.goos_recipient_active(p_delegate_id) then raise exception 'invalid_input' using errcode='22023'; end if;
 if p_scopes is null or cardinality(p_scopes)<1 or cardinality(p_scopes)>2 or not(p_scopes<@array['profile:read','profile:write']) or not('profile:read'=any(p_scopes)) then raise exception 'invalid_scope' using errcode='22023'; end if;
 if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '90 days' then raise exception 'invalid_expiry' using errcode='22023'; end if;
 if not exists(select 1 from app.notice_versions where id=p_notice_id and environment='development') then raise exception 'notice_required' using errcode='22023'; end if;
 -- สิทธิ์เดิมที่หมดอายุเปลี่ยนเป็น revoked ก่อนสร้างครั้งใหม่ โดยไม่ต่ออายุแอบแฝง
 update app.delegations set status='revoked',revoked_at=now(),version=version+1 where subject_id=p_subject_id and delegate_account_id=p_delegate_id and status='active' and expires_at<=now();
 insert into app.delegations(id,subject_id,delegate_account_id,granted_by,expires_at) values(v_id,p_subject_id,p_delegate_id,auth.uid(),p_expires_at);
 insert into app.delegation_scopes select v_id,scope from (select distinct unnest(p_scopes) scope) s;
 insert into private.consent_events(subject_id,actor_id,recipient_account_id,delegation_id,purpose,notice_version_id,action,scopes) values(p_subject_id,auth.uid(),p_delegate_id,v_id,'profile_delegation',p_notice_id,'granted',p_scopes);
 perform private.goos_audit('delegation.granted',v_id);return v_id;end $$;
create function public.goos_delegations() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'subject_id',d.subject_id,'delegate_account_id',d.delegate_account_id,'own',d.granted_by=auth.uid(),
 'status',case when d.expires_at<=now() then 'expired' else d.status end,'expires_at',d.expires_at,'version',d.version,
 'scopes',(select jsonb_agg(scope) from app.delegation_scopes s where s.delegation_id=d.id))),'[]'::jsonb) from app.delegations d;
$$;
create function public.goos_revoke_delegation(p_id uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare v_d app.delegations;v_notice uuid;begin
 select * into v_d from app.delegations where id=p_id for update;
 if not found or not private.goos_owns_subject(v_d.subject_id) then raise exception 'not_found' using errcode='P0002'; end if;
 if v_d.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001'; end if;
 if v_d.status='revoked' then return;end if;
 select notice_version_id into v_notice from private.consent_events where delegation_id=p_id and action='granted' order by occurred_at limit 1;
 update app.delegations set status='revoked',revoked_at=now(),version=version+1 where id=p_id;
 insert into private.consent_events(subject_id,actor_id,recipient_account_id,delegation_id,purpose,notice_version_id,action) values(v_d.subject_id,auth.uid(),v_d.delegate_account_id,p_id,'profile_delegation',v_notice,'withdrawn');
 perform private.goos_audit('delegation.revoked',p_id);end $$;
create function public.goos_consents() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'purpose',purpose,'recipient_account_id',recipient_account_id,'notice_id',notice_version_id,'action',action,'scopes',scopes,'occurred_at',occurred_at)),'[]'::jsonb) from private.consent_events;
$$;
create function public.goos_create_organization(p_name text,p_country_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid:=gen_random_uuid();v_member uuid:=gen_random_uuid();begin
 if not private.goos_staff_assured() then raise exception 'mfa_required' using errcode='42501'; end if;
 insert into app.organizations(id,display_name,country_code,created_by) values(v_org,trim(p_name),p_country_code,auth.uid());
 insert into app.org_memberships(id,organization_id,account_id) values(v_member,v_org,auth.uid());
 insert into app.org_member_roles(membership_id,role_code) values(v_member,'owner');
 perform private.goos_audit('organization.created',v_org,v_org);return v_org;end $$;
create function public.goos_organizations() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'display_name',o.display_name,'status',o.status,'country_code',o.country_code)),'[]'::jsonb) from app.organizations o
 where private.goos_has_org_role(o.id,array['owner','admin','catalog_editor','caseworker','supervisor','recruiter']);
$$;
create function public.goos_members(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_staff_assured() or not private.goos_has_org_role(p_org,array['owner','admin']) then raise exception 'not_found' using errcode='P0002';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'account_id',m.account_id,'status',m.status,'version',m.version,
 'roles',(select jsonb_agg(role_code) from app.org_member_roles r where r.membership_id=m.id))),'[]'::jsonb) from app.org_memberships m where m.organization_id=p_org);
end $$;
create function public.goos_invite_member(p_org uuid,p_recipient uuid,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();begin
 if not private.goos_staff_assured() or not private.goos_has_org_role(p_org,array['owner','admin']) then raise exception 'not_found' using errcode='P0002';end if;
 if p_role not in ('admin','catalog_editor','caseworker','supervisor','recruiter') or p_role='admin' and not private.goos_has_org_role(p_org,array['owner']) then raise exception 'invalid_role' using errcode='22023';end if;
 if p_recipient=auth.uid() or not private.goos_recipient_active(p_recipient) then raise exception 'invalid_recipient' using errcode='22023';end if;
 insert into app.org_invitations(id,organization_id,recipient_account_id,invited_by,role_code,expires_at) values(v_id,p_org,p_recipient,auth.uid(),p_role,now()+interval '7 days');
 perform private.goos_audit('membership.invited',v_id,p_org);return v_id;end $$;
create function public.goos_my_invitations() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'organization_id',i.organization_id,'organization_name',o.display_name,'role',i.role_code,'expires_at',i.expires_at,'status',i.status)),'[]'::jsonb)
 from app.org_invitations i join app.organizations o on o.id=i.organization_id where i.recipient_account_id=auth.uid() and i.status='pending' and i.expires_at>now();
$$;
create function public.goos_accept_invitation(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_i app.org_invitations;v_member uuid;begin
 if not private.goos_staff_assured() then raise exception 'mfa_required' using errcode='42501';end if;
 select * into v_i from app.org_invitations where id=p_id for update;
 if not found or v_i.recipient_account_id<>auth.uid() or v_i.status<>'pending' or v_i.expires_at<=now() then raise exception 'not_found' using errcode='P0002';end if;
 if not private.goos_inviter_valid(v_i.organization_id,v_i.invited_by,v_i.role_code) then raise exception 'not_found' using errcode='P0002';end if;
 if exists(select 1 from app.org_memberships where organization_id=v_i.organization_id and account_id=auth.uid()) then raise exception 'membership_exists' using errcode='23505';end if;
 v_member:=gen_random_uuid();
 insert into app.org_memberships(id,organization_id,account_id) values(v_member,v_i.organization_id,auth.uid());
 insert into app.org_member_roles(membership_id,role_code) values(v_member,v_i.role_code);
 update app.org_invitations set status='accepted' where id=p_id;
 perform private.goos_audit('membership.accepted',v_member,v_i.organization_id);return v_member;end $$;
create function public.goos_revoke_member(p_org uuid,p_member uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare v_m app.org_memberships;v_owner boolean;v_owners integer;begin
 if not private.goos_staff_assured() or not private.goos_has_org_role(p_org,array['owner','admin']) then raise exception 'not_found' using errcode='P0002';end if;
 -- ล็อกสมาชิกทั้งองค์กรตามลำดับคงที่ ป้องกันถอนเจ้าของสองคนพร้อมกันแล้วเหลือศูนย์
 perform 1 from app.org_memberships where organization_id=p_org order by id for update;
 select * into v_m from app.org_memberships where id=p_member and organization_id=p_org;
 if not found then raise exception 'not_found' using errcode='P0002';end if;
 if v_m.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001';end if;
 v_owner:=exists(select 1 from app.org_member_roles where membership_id=p_member and role_code='owner');
 if exists(select 1 from app.org_member_roles where membership_id=p_member and role_code in ('owner','admin')) and not private.goos_has_org_role(p_org,array['owner']) then raise exception 'not_found' using errcode='P0002';end if;
 select count(*) into v_owners from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id where m.organization_id=p_org and m.status='active' and r.role_code='owner';
 if v_owner and v_m.status='active' and v_owners<=1 then raise exception 'last_owner' using errcode='23514';end if;
 update app.org_memberships set status='revoked',version=version+1 where id=p_member;
 perform private.goos_audit('membership.revoked',p_member,p_org);end $$;
create function public.goos_revoke_current_session() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then return;end if;
 perform private.goos_audit('session.revoked',auth.uid());
 insert into private.revoked_sessions(session_id,account_id) values((auth.jwt()->>'session_id')::uuid,auth.uid()) on conflict do nothing;
end $$;

-- grants ให้เฉพาะบทบาทภายในที่เป็นเจ้าของ RPC ไม่ให้ browser ตาราง CRUD
revoke all on all tables in schema app,private from public,anon,authenticated;
grant select,insert on app.accounts to goos_api;
grant select,insert on app.subjects to goos_api;
grant update(display_alias,coarse_region,safe_contact,version,updated_at) on app.subjects to goos_api;
grant select,insert on app.organizations,app.org_memberships,app.org_member_roles,app.org_invitations,app.delegations,app.delegation_scopes to goos_api;
grant update(status,version) on app.org_memberships to goos_api;
grant update(status) on app.org_invitations to goos_api;
grant update(status,revoked_at,version) on app.delegations to goos_api;
grant select on app.role_definitions,app.notice_versions to goos_api;
grant select,insert on private.consent_events,private.revoked_sessions to goos_api;
grant select(id,status) on app.accounts to goos_authz;
grant select(id,account_id,status,age_band) on app.subjects to goos_authz;
grant select on app.org_memberships,app.org_member_roles,app.delegations,app.delegation_scopes,private.revoked_sessions to goos_authz;
grant insert on private.audit_events to goos_authz;
-- เปลี่ยนเจ้าของเฉพาะฟังก์ชัน goos_* ที่ migration นี้สร้าง ห้ามเปลี่ยนฟังก์ชันระบบ
-- CREATE schema grant มีเฉพาะระหว่าง ALTER OWNER แล้วถอนทันที
 grant create on schema public to goos_api;
 grant create on schema private to goos_authz;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname=any(array['goos_accept_invitation','goos_actor_active','goos_audit','goos_bootstrap_account','goos_can_subject','goos_consents','goos_context','goos_create_delegation','goos_create_organization','goos_create_profile','goos_delegations','goos_has_org_role','goos_invite_member','goos_inviter_valid','goos_members','goos_my_invitations','goos_notices','goos_organizations','goos_owns_subject','goos_profile','goos_recipient_active','goos_revoke_current_session','goos_revoke_delegation','goos_revoke_member','goos_session_valid','goos_staff_assured','goos_update_profile','goos_verified_identity']) and n.nspname in ('public','private') loop
  if f.nspname='private' then
   execute format('alter function %s owner to goos_authz',f.signature);
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   execute format('grant execute on function %s to goos_api',f.signature);
  else
   execute format('alter function %s owner to goos_api',f.signature);
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   execute format('grant execute on function %s to authenticated',f.signature);
  end if;
 end loop;
end $$;
revoke create on schema public from goos_api;
revoke create on schema private from goos_authz;
