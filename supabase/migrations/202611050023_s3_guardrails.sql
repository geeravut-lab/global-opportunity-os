-- S3 consent withdrawal/replay, lifecycle consistency and scope-bound clocks
alter policy s3_subject_api on app.subjects using(private.goos_can_subject(id,'application:prepare') or private.goos_can_subject(id,'progress:read'));
alter table private.s3_withdrawals drop constraint s3_withdrawals_pkey;
alter table private.s3_withdrawals add column action text not null default 'withdrawn' check(action in('withdrawn','share_revoked'));
alter table private.s3_withdrawals add primary key(application_id,action);
create or replace function public.goos_revoke_delegation(p_id uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare d app.delegations;n uuid;v_purpose text;begin
 select * into d from app.delegations where id=p_id for update;
 if not found or not private.goos_owns_subject(d.subject_id) then raise exception 'not_found' using errcode='P0002';end if;
 if d.version is distinct from p_expected_version then raise exception 'state_conflict' using errcode='40001';end if;
 if d.status='revoked' then return;end if;
 select notice_version_id,purpose into n,v_purpose from private.consent_events where delegation_id=p_id and action='granted' order by occurred_at limit 1;
 update app.delegations set status='revoked',revoked_at=now(),version=version+1 where id=p_id;
 insert into private.consent_events(subject_id,actor_id,recipient_account_id,delegation_id,purpose,notice_version_id,action,scopes) values(d.subject_id,private.goos_uid(),d.delegate_account_id,d.id,v_purpose,n,'withdrawn',(select array_agg(scope) from app.delegation_scopes where delegation_id=d.id));
 perform private.goos_audit('delegation.revoked',d.id);
end $$;
-- Helper สร้าง cryptographic payload ยืนยัน notice hash และ source versions ที่ submission
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s3_transition(uuid,text,integer,text,text[])'::regprocedure);
 r:=replace(d,$s$p_action in('withdraw','accept_offer')$s$,$s$p_action in('withdraw','accept_offer','revoke_share')$s$);
 r:=replace(r,$s$if p_action='withdraw' then$s$,$s$if p_action='revoke_share' then
  if not private.goos_can_subject(a.subject_id,'application:submit') then raise exception 'not_found' using errcode='P0002';end if;
  update app.resource_shares set status='revoked',revoked_at=now() where application_id=a.id and status='active';
  insert into private.s3_withdrawals(application_id,subject_id,actor_id,action) values(a.id,a.subject_id,private.goos_uid(),'share_revoked') on conflict do nothing;
  update app.applications set version=version+1,updated_at=now() where id=a.id;v_state:=a.state;
 elsif p_action='withdraw' then$s$);
 if r=d then raise exception 'S3 transition guard source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s3_note(uuid,text,text,uuid,integer)'::regprocedure);
 r:=replace(d,$s$where a.id=c.application_id and r.category='jobs')$s$,$s$where a.id=c.application_id and r.category='jobs' and p_visibility<>'beneficiary_shared')$s$);
 r:=replace(r,$s$update app.cases set version=version+1,updated_at=now() where id=c.id;$s$,$s$if p_visibility='beneficiary_shared' then update app.cases set version=version+1,updated_at=now() where id=c.id;end if;$s$);
 if r=d then raise exception 'S3 note guard source mismatch';end if;execute r;
end $$;
alter policy s3_note_api on private.case_notes with check(author_id=private.goos_uid() and exists(select 1 from app.cases c join app.applications a on a.id=c.application_id join app.opportunity_revisions r on r.id=a.revision_id where c.id=case_id and private.goos_s3_work(a.id) and(r.category<>'jobs' or visibility='beneficiary_shared')));
create function public.goos_s3_orgs() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.display_name,'roles',(select jsonb_agg(role_code) from app.org_member_roles where membership_id=m.id),'can_route',private.goos_s3_routing(o.id),'can_assign',private.goos_s3_supervisor(o.id),'can_manage',private.goos_staff_assured() and private.goos_has_org_role(o.id,array['owner','admin']))),'[]') from app.organizations o join app.org_memberships m on m.organization_id=o.id where m.account_id=private.goos_uid() and m.status='active' and private.goos_actor_active();
$$;
create function public.goos_s3_team(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_s3_routing(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'account_id',m.account_id,'roles',(select jsonb_agg(role_code) from app.org_member_roles where membership_id=m.id))),'[]') from app.org_memberships m where organization_id=p_org and status='active');
end $$;
-- roster ต้องอ่านผ่าน authz metadata helper เพราะ supervisor ไม่รับ S1 member-admin scope
create function private.goos_s3_roster(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select case when private.goos_s3_routing(p_org) then(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'account_id',m.account_id,'roles',(select jsonb_agg(role_code) from app.org_member_roles where membership_id=m.id))),'[]') from app.org_memberships m where organization_id=p_org and status='active') else null end;
$$;
create or replace function public.goos_s3_team(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;begin r:=private.goos_s3_roster(p_org);if r is null then raise exception 'not_found' using errcode='P0002';end if;return r;end $$;

create function private.goos_s3_clock() returns jsonb language sql stable security definer set search_path='' as $$
 with visible as(
 select a.id,a.version,c.version case_version,private.goos_s3_work(a.id) can_work from app.applications a join app.cases c on c.application_id=a.id
 where private.goos_s3_progress(a.id) or private.goos_s3_work(a.id) or private.goos_s3_routing(a.organization_id)
 ) select jsonb_build_object('digest',md5(coalesce((select string_agg(id::text||':'||version::text||':'||case_version::text||':'||can_work::text,',' order by id) from visible),'')),
 'next_at',(select min(expires_at) from app.resource_shares where status='active' and expires_at>now() and application_id in(select id from visible)));
$$;
grant create on schema private to goos_authz;
alter function private.goos_s3_roster(uuid) owner to goos_authz;
alter function private.goos_s3_clock() owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s3_roster(uuid),private.goos_s3_clock() from public,anon,authenticated;
grant execute on function private.goos_s3_roster(uuid),private.goos_s3_clock() to goos_api;
create or replace function public.goos_live_fingerprint() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision bigint;v_settings app.platform_settings;v_active integer;v_context jsonb;v_invites integer;v_catalog jsonb;v_s3 jsonb;begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 select revision into v_revision from private.live_revisions where account_id=private.goos_uid();select * into strict v_settings from app.platform_settings where singleton;
 select count(*) into v_active from app.delegations where(delegate_account_id=private.goos_uid() or granted_by=private.goos_uid()) and status='active' and starts_at<=now() and expires_at>now();
 v_context:=public.goos_context();v_invites:=jsonb_array_length(public.goos_my_invitations());v_catalog:=private.goos_s2_catalog_clock();v_s3:=private.goos_s3_clock();
 return jsonb_build_object('fingerprint',coalesce(v_revision,0)::text||':'||v_settings.version::text||':'||v_active::text||':'||(v_context->>'has_platform_role')||':'||(v_context->>'staff_assured')||':'||v_invites::text||':'||(v_catalog->>'digest')||':'||(v_s3->>'digest'),
 'enabled',coalesce(v_settings.flags->>'live_sync','true')='true','next_catalog_at',least((v_catalog->>'next_at')::timestamptz,(v_s3->>'next_at')::timestamptz));
end $$;
-- capacity เป็น safe public availability; ไม่เผยข้อมูลผู้สมัคร
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s2_catalog_clock()'::regprocedure);
 r:=replace(d,$s$p.version::text||':'||o.display_name$s$,$s$p.version::text||':'||p.filled_count::text||':'||o.display_name$s$);
 if r=d then raise exception 'catalog clock source mismatch';end if;execute r;
end $$;
create function private.goos_s3_preference_signal() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.goos_live_bump(new.account_id);return null;end $$;
revoke all on function private.goos_s3_preference_signal() from public,anon,authenticated,goos_api,goos_authz,goos_worker;
create trigger s3_preferences_live after insert or update on app.notification_preferences for each row execute function private.goos_s3_preference_signal();
-- withdrawal replay เป็น operator-only และไม่ใช้ user-supplied arbitrary SQL
create function private.goos_s3_replay_withdrawals(p_ledger jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb;a app.applications;v_count integer:=0;begin
 if p_ledger is null or jsonb_typeof(p_ledger)<>'array' or jsonb_array_length(p_ledger)>10000 then raise exception 'invalid_ledger';end if;
 for r in select * from jsonb_array_elements(p_ledger) loop
  select * into a from app.applications where id=(r->>'application_id')::uuid and subject_id=(r->>'subject_id')::uuid for update;
  if not found or r->>'action' not in('share_revoked','withdrawn') then raise exception 'ledger_identity_mismatch';end if;
  update app.resource_shares set status='revoked',revoked_at=coalesce(revoked_at,(r->>'created_at')::timestamptz) where application_id=a.id and status='active';
  if r->>'action'='withdrawn' and a.state<>'withdrawn' then
   if a.capacity_reserved and a.job_stage not in('started','completed') and exists(select 1 from app.cases where application_id=a.id and state not in('in_progress','resolved','closed')) then update app.opportunities set filled_count=greatest(0,filled_count-1) where id=a.opportunity_id;update app.applications set capacity_reserved=false where id=a.id;end if;
   update app.applications set state='withdrawn',version=version+1 where id=a.id;
   update app.cases set state=case when state in('closed','resolved') then state else 'cancelled' end,resolution_code='user_withdrew',version=version+1 where application_id=a.id;
  end if;
  update private.outbox set status='cancelled' where case_id in(select id from app.cases where application_id=a.id) and status in('pending','inflight');v_count:=v_count+1;
 end loop;return v_count;
end $$;
revoke all on function private.goos_s3_replay_withdrawals(jsonb) from public,anon,authenticated,goos_api,goos_authz,goos_worker;
DO $$declare f record;begin
 grant create on schema public to goos_api;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('goos_s3_orgs','goos_s3_team') loop
 execute format('alter function %s owner to goos_api',f.sig);execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to authenticated',f.sig);
 end loop;revoke create on schema public from goos_api;
end $$;
notify pgrst,'reload schema';
