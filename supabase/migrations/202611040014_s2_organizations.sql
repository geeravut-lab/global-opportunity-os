-- S2.1/2: org lifecycle และหลักฐาน PNG ส่วนตัว; scanner verdict เขียนได้เฉพาะ operator worker
alter table app.organizations add column version integer not null default 1 check(version>0),
 add column verification_expires_at timestamptz, add column assigned_reviewer_id uuid references app.accounts(id), add column updated_at timestamptz not null default now();
alter table app.organizations drop constraint organizations_status_check;
alter table app.organizations add constraint organizations_status_check check(status in
 ('draft','submitted','in_review','changes_requested','verified','rejected','suspended','expired','appealed'));
create table private.org_evidence (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references app.organizations(id),
 uploaded_by uuid not null references app.accounts(id), status text not null default 'intent' check(status in('intent','quarantined','clean','rejected')),
 upload_expires_at timestamptz not null default now()+interval '15 minutes',
 original_body bytea check(octet_length(original_body)<=1048576), safe_body bytea check(octet_length(safe_body)<=1048576),
 content_hash text, inspection text, created_at timestamptz not null default now(), processed_at timestamptz,
 check(status<>'clean' or safe_body is not null and inspection='png-decoded-reencoded-v1')
);
create table private.org_review_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, actor_id uuid not null,
 from_status text not null, to_status text not null, reason text not null check(length(trim(reason)) between 1 and 500),
 expires_at timestamptz, occurred_at timestamptz not null default now()
);
create trigger org_review_immutable before update or delete or truncate on private.org_review_events
 for each statement execute function private.goos_audit_immutable();

create function private.goos_s2_reviewer(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_platform_admin() and exists(select 1 from app.organizations o where o.id=p_org and o.created_by<>private.goos_uid())
 and not exists(select 1 from app.org_memberships where organization_id=p_org and account_id=private.goos_uid());
$$;
grant select on app.organizations to goos_authz;
create policy org_authz_read on app.organizations for select to goos_authz using(true);
create function private.goos_s2_editor(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and private.goos_has_org_role(p_org,array['owner','admin','catalog_editor']);
$$;
create function private.goos_s2_manager(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and private.goos_has_org_role(p_org,array['owner','admin']);
$$;
grant create on schema private to goos_authz;
alter function private.goos_s2_reviewer(uuid) owner to goos_authz;
alter function private.goos_s2_editor(uuid) owner to goos_authz;
alter function private.goos_s2_manager(uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s2_reviewer(uuid),private.goos_s2_editor(uuid),private.goos_s2_manager(uuid) from public,anon,authenticated;
grant execute on function private.goos_s2_reviewer(uuid),private.goos_s2_editor(uuid),private.goos_s2_manager(uuid) to goos_api;
create policy org_reviewer_read on app.organizations for select to goos_api using(private.goos_s2_reviewer(id));
create policy org_s2_update on app.organizations for update to goos_api
 using(private.goos_s2_manager(id) or private.goos_s2_reviewer(id))
 with check(private.goos_s2_manager(id) or private.goos_s2_reviewer(id));
grant update on app.organizations to goos_api;
alter table private.org_evidence enable row level security;
alter table private.org_review_events enable row level security;
create policy evidence_read on private.org_evidence for select to goos_api
 using(private.goos_s2_manager(organization_id) or private.goos_s2_reviewer(organization_id));
create policy evidence_insert on private.org_evidence for insert to goos_api
 with check(private.goos_s2_manager(organization_id) and uploaded_by=private.goos_uid() and status='intent');
create policy evidence_upload on private.org_evidence for update to goos_api
 using(private.goos_s2_manager(organization_id) and uploaded_by=private.goos_uid() and status='intent' and upload_expires_at>now())
 with check(status='quarantined' and safe_body is null and inspection is null);
grant select,insert on private.org_evidence to goos_api;
grant update(original_body,status) on private.org_evidence to goos_api;
create policy org_events_read on private.org_review_events for select to goos_api
 using(private.goos_s2_manager(organization_id) or private.goos_s2_reviewer(organization_id));
create policy org_events_insert on private.org_review_events for insert to goos_api
 with check(actor_id=private.goos_uid() and (private.goos_s2_manager(organization_id) or private.goos_s2_reviewer(organization_id)));
grant select,insert on private.org_review_events to goos_api;
revoke all on private.org_evidence,private.org_review_events from public,anon,authenticated;

create function public.goos_s2_orgs(p_review boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_review and not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'display_name',o.display_name,'country_code',o.country_code,
 'status',case when o.status='verified' and o.verification_expires_at<=now() then 'expired' else o.status end,
 'stored_status',o.status,'version',o.version,'verification_expires_at',o.verification_expires_at,
 'can_manage',private.goos_s2_manager(o.id),'can_review',private.goos_s2_reviewer(o.id)) order by o.created_at),'[]')
 from app.organizations o where case when p_review then private.goos_s2_reviewer(o.id) else private.goos_s2_editor(o.id) end);
end $$;
create function public.goos_s2_evidence(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not(private.goos_s2_manager(p_org) or private.goos_s2_reviewer(p_org)) then raise exception 'not_found' using errcode='P0002';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'created_at',created_at,'inspection',inspection) order by created_at),'[]') from private.org_evidence where organization_id=p_org);
end $$;
create function public.goos_s2_upload_intent(p_org uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 if not private.goos_s2_manager(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 if (select count(*) from private.org_evidence where organization_id=p_org and created_at>now()-interval '1 day')>=20 then raise exception 'upload_limit' using errcode='22023';end if;
 insert into private.org_evidence(organization_id,uploaded_by) values(p_org,private.goos_uid()) returning id into v_id;
 perform private.goos_audit('org.evidence_intent',v_id,p_org);return v_id;
end $$;
create function public.goos_s2_upload(p_id uuid,p_png text) returns void language plpgsql security definer set search_path='' as $$
declare v_e private.org_evidence;v_body bytea;begin
 select * into v_e from private.org_evidence where id=p_id for update;
 if not found or not private.goos_s2_manager(v_e.organization_id) or v_e.uploaded_by<>private.goos_uid() then raise exception 'not_found' using errcode='P0002';end if;
 if v_e.status<>'intent' or v_e.upload_expires_at<=now() then raise exception 'state_conflict' using errcode='40001';end if;
 if p_png is null or length(p_png)>1398104 then raise exception 'invalid_image' using errcode='22023';end if;
 v_body:=decode(p_png,'base64');
 if octet_length(v_body)<45 or octet_length(v_body)>1048576 or substring(v_body from 1 for 8)<>decode('89504e470d0a1a0a','hex') then raise exception 'invalid_image' using errcode='22023';end if;
 update private.org_evidence set original_body=v_body,status='quarantined' where id=p_id;
 perform private.goos_audit('org.evidence_uploaded',p_id,v_e.organization_id);
end $$;
create function public.goos_s2_download(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.org_evidence;begin
 select * into e from private.org_evidence where id=p_id;
 if not found or not(private.goos_s2_manager(e.organization_id) or private.goos_s2_reviewer(e.organization_id)) or e.status<>'clean' then raise exception 'not_found' using errcode='P0002';end if;
 perform private.goos_audit('org.evidence_read',p_id,e.organization_id);
 return jsonb_build_object('png',encode(e.safe_body,'base64'),'hash',e.content_hash);
end $$;
create function public.goos_s2_transition_org(p_org uuid,p_action text,p_reason text,p_expires timestamptz,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare o app.organizations;v_target text;begin
 select * into o from app.organizations where id=p_org for update;
 if not found then raise exception 'not_found' using errcode='P0002';end if;
 if p_action in ('submit','appeal') then
  if not private.goos_s2_manager(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 else
  if not private.goos_s2_reviewer(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 end if;
 if o.status='in_review' and p_action not in('submit','appeal') and o.assigned_reviewer_id is distinct from private.goos_uid() then raise exception 'not_found' using errcode='P0002';end if;
 if o.status='appealed' and p_action='start_review' and private.goos_uid()=(select actor_id from private.org_review_events where organization_id=p_org and to_status in('rejected','suspended') order by occurred_at desc limit 1) then raise exception 'independent_appeal_required' using errcode='P0002';end if;
 if o.version is distinct from p_expected_version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid_reason' using errcode='22023';end if;
 v_target:=case
 when p_action='submit' and (o.status in('draft','changes_requested','expired') or o.status='verified' and o.verification_expires_at<=now()) then 'submitted'
 when p_action='appeal' and o.status in('rejected','suspended') then 'appealed'
 when p_action='start_review' and o.status in('submitted','appealed') then 'in_review'
 when p_action='request_changes' and o.status='in_review' then 'changes_requested'
 when p_action='reject' and o.status='in_review' then 'rejected'
 when p_action='verify' and o.status='in_review' then 'verified'
 when p_action='suspend' and o.status='verified' then 'suspended' end;
 if v_target is null then raise exception 'state_conflict' using errcode='40001';end if;
 if v_target in('submitted','verified') and not exists(select 1 from private.org_evidence where organization_id=p_org and status='clean') then raise exception 'clean_evidence_required' using errcode='22023';end if;
 if v_target='verified' and (p_expires is null or p_expires<=now() or p_expires>now()+interval '1 year') then raise exception 'invalid_expiry' using errcode='22023';end if;
 update app.organizations set status=v_target,assigned_reviewer_id=case when v_target='in_review' then private.goos_uid() else null end,verification_expires_at=case when v_target='verified' then p_expires else null end,version=version+1,updated_at=now() where id=p_org;
 insert into private.org_review_events(organization_id,actor_id,from_status,to_status,reason,expires_at) values(p_org,private.goos_uid(),o.status,v_target,trim(p_reason),case when v_target='verified' then p_expires end);
 perform private.goos_audit('org.'||v_target,p_org,p_org);
end $$;

-- Worker ไม่มี API RPC ที่ให้ client ส่งผล clean; signals ไม่มี bytes/ชื่อไฟล์/เหตุผล
create function private.goos_s2_org_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare v_org uuid;u uuid;r jsonb;begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_org:=case when tg_table_name='organizations' then (r->>'id')::uuid else (r->>'organization_id')::uuid end;
 for u in select a.id from app.accounts a where a.status='active' and
 (exists(select 1 from app.org_memberships m join app.org_member_roles roles on roles.membership_id=m.id where m.organization_id=v_org and m.account_id=a.id and m.status='active' and roles.role_code in('owner','admin','catalog_editor'))
 or exists(select 1 from private.platform_role_grants g where g.account_id=a.id and g.revoked_at is null and(g.expires_at is null or g.expires_at>now()))
 and not exists(select 1 from app.org_memberships where account_id=a.id and organization_id=v_org)) order by a.id
 loop perform private.goos_live_bump(u);end loop;return null;
end $$;
revoke all on function private.goos_s2_org_signal() from public,anon,authenticated,goos_api,goos_authz;
create trigger s2_org_signal after update on app.organizations for each row execute function private.goos_s2_org_signal();
create trigger s2_evidence_signal after insert or update on private.org_evidence for each row execute function private.goos_s2_org_signal();

do $$declare f record;begin
 grant create on schema public to goos_api;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'goos_s2_%' loop
  execute format('alter function %s owner to goos_api',f.sig);
  execute format('revoke all on function %s from public,anon,authenticated',f.sig);
  execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
 revoke create on schema public from goos_api;
end $$;
