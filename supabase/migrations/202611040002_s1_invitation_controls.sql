-- ส่วนเพิ่ม S1: invitation cancellation และรากสิทธิ์ platform ที่ผู้ใช้กำหนดเองไม่ได้
create table private.platform_role_grants (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references app.accounts(id),
 role_code text not null, realm text not null default 'platform' check(realm='platform'),
 granted_by uuid not null references app.accounts(id), expires_at timestamptz, revoked_at timestamptz,
 foreign key(role_code,realm) references app.role_definitions(code,realm)
);
alter table private.platform_role_grants enable row level security;
create policy platform_authz_read on private.platform_role_grants for select to goos_authz using(true);
grant select on private.platform_role_grants to goos_authz;
revoke all on private.platform_role_grants from public,anon,authenticated,goos_api;
create function private.goos_has_platform_role() returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from private.platform_role_grants g where g.account_id=auth.uid() and g.revoked_at is null and (g.expires_at is null or g.expires_at>now()));
$$;
create or replace function public.goos_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000'; end if;
 return jsonb_build_object('account_id',auth.uid(),'locale',(select locale from app.accounts where id=auth.uid()),
 'subject_id',(select id from app.subjects where account_id=auth.uid()),'aal',auth.jwt()->>'aal','staff_assured',private.goos_staff_assured(),
 'has_platform_role',private.goos_has_platform_role(),'has_membership',exists(select 1 from app.org_memberships where account_id=auth.uid() and status='active'));
end $$;
create or replace function public.goos_organizations() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'display_name',o.display_name,'status',o.status,'country_code',o.country_code,
 'can_manage',private.goos_staff_assured() and private.goos_has_org_role(o.id,array['owner','admin']))),'[]'::jsonb) from app.organizations o
 where private.goos_has_org_role(o.id,array['owner','admin','catalog_editor','caseworker','supervisor','recruiter']);
$$;
create policy invite_cancel_api on app.org_invitations for update to goos_api using(private.goos_actor_active() and
 (recipient_account_id=auth.uid() or private.goos_staff_assured() and private.goos_has_org_role(organization_id,array['owner','admin'])))
 with check(status='cancelled' and private.goos_actor_active() and (recipient_account_id=auth.uid() or private.goos_staff_assured() and private.goos_has_org_role(organization_id,array['owner','admin'])));
create function public.goos_cancel_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_i app.org_invitations;begin
 select * into v_i from app.org_invitations where id=p_id for update;
 if not found or not private.goos_actor_active() or not(v_i.recipient_account_id=auth.uid() or private.goos_staff_assured() and private.goos_has_org_role(v_i.organization_id,array['owner','admin'])) then raise exception 'not_found' using errcode='P0002';end if;
 if v_i.status<>'pending' then raise exception 'state_conflict' using errcode='40001';end if;
 update app.org_invitations set status='cancelled' where id=p_id;
 perform private.goos_audit('invitation.cancelled',p_id,v_i.organization_id);
end $$;
create function public.goos_org_invitations(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_staff_assured() or not private.goos_has_org_role(p_org,array['owner','admin']) then raise exception 'not_found' using errcode='P0002';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'recipient_account_id',recipient_account_id,'role',role_code,'status',status,'expires_at',expires_at)),'[]'::jsonb) from app.org_invitations where organization_id=p_org and status='pending' and expires_at>now());
end $$;
grant create on schema public to goos_api;
grant create on schema private to goos_authz;
alter function private.goos_has_platform_role() owner to goos_authz;
revoke all on function private.goos_has_platform_role() from public,anon,authenticated;
grant execute on function private.goos_has_platform_role() to goos_api;
alter function public.goos_cancel_invitation(uuid) owner to goos_api;
alter function public.goos_org_invitations(uuid) owner to goos_api;
revoke all on function public.goos_cancel_invitation(uuid),public.goos_org_invitations(uuid) from public,anon,authenticated;
grant execute on function public.goos_cancel_invitation(uuid),public.goos_org_invitations(uuid) to authenticated;
revoke create on schema public from goos_api;
revoke create on schema private from goos_authz;
