-- Machine role ไม่มี JWT impersonation, ไม่มีสิทธิ์เปลี่ยน application/case/share
DO $$begin if not exists(select 1 from pg_roles where rolname='goos_worker') then create role goos_worker nologin noinherit nobypassrls;end if;execute format('grant goos_worker to %I',current_user);end $$;
grant usage on schema private,app,public to goos_worker;
create policy s3_worker_outbox on private.outbox to goos_worker using(true) with check(true);
grant select,update on private.outbox to goos_worker;
alter table app.notifications add column source_event_id uuid unique,add column resource_path text check(resource_path is null or resource_path='/workflow');
alter table app.notifications drop constraint notifications_kind_check;
alter table app.notifications add constraint notifications_kind_check check(kind in('admin.granted','admin.revoked','admin.changed','invitation.created','membership.revoked','security.password_changed','application.updated','case.updated','followup.due','workflow.dead_letter'));
create policy s3_worker_notification on app.notifications for insert to goos_worker with check(source_event_id is not null and kind in('application.updated','case.updated','followup.due') and resource_path='/workflow');
grant insert on app.notifications to goos_worker;

create function private.goos_s3_delivery_allowed(p_account uuid,p_case uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.accounts ac where ac.id=p_account and ac.status='active') and exists(
 select 1 from app.cases c join app.applications a on a.id=c.application_id join app.subjects s on s.id=a.subject_id and s.status='active'
 where c.id=p_case and(s.account_id=p_account or(
 a.state<>'withdrawn' and exists(select 1 from app.resource_shares sh where sh.application_id=a.id and sh.response_id is null and sh.status='active' and sh.expires_at>now())
 and exists(select 1 from app.organizations o where o.id=a.organization_id and o.status='verified' and o.verification_expires_at>now()) and exists(
 select 1 from app.org_memberships m join app.org_member_roles mr on mr.membership_id=m.id where m.organization_id=a.organization_id and m.account_id=p_account and m.status='active'
 and(mr.role_code='supervisor' or exists(select 1 from app.case_assignments ca join app.opportunity_revisions r on r.id=a.revision_id where ca.case_id=c.id and ca.membership_id=m.id and ca.ends_at is null and mr.role_code=case when r.category='jobs' then 'recruiter' else 'caseworker' end))))));
$$;
create function private.goos_s3_email_target(p_account uuid,p_channel text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('locale',a.locale,'email',case when p_channel='email' and p.email and s.safe_contact='email' and u.email_confirmed_at is not null then u.email end,
 'enabled',case when p_channel='email' then coalesce(p.email,false) and s.safe_contact='email' and u.email_confirmed_at is not null else coalesce(p.in_app,true) end)
 from app.accounts a join auth.users u on u.id=a.id left join app.subjects s on s.account_id=a.id and s.status='active' left join app.notification_preferences p on p.account_id=a.id where a.id=p_account and a.status='active';
$$;
revoke all on function private.goos_s3_delivery_allowed(uuid,uuid),private.goos_s3_email_target(uuid,text) from public,anon,authenticated,goos_api;
grant execute on function private.goos_s3_delivery_allowed(uuid,uuid),private.goos_s3_email_target(uuid,text) to goos_worker;

create function private.goos_s3_emit(p_case uuid,p_kind text,p_event text) returns void language plpgsql security definer set search_path='' as $$
declare c app.cases;a app.applications;u uuid;channel_name text;begin
 if p_kind is null or p_kind not in('application.updated','case.updated','followup.due') or length(p_event)>160 then raise exception 'invalid_event' using errcode='22023';end if;
 select * into strict c from app.cases where id=p_case;select * into strict a from app.applications where id=c.application_id;
 for u in select distinct id from(
  select s.account_id id from app.subjects s where s.id=a.subject_id
  union select m.account_id from app.case_assignments ca join app.org_memberships m on m.id=ca.membership_id where ca.case_id=c.id and ca.ends_at is null and m.status='active'
  union select m.account_id from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id where m.organization_id=a.organization_id and m.status='active' and r.role_code='supervisor'
 ) targets where id is not null order by id loop
  if private.goos_s3_delivery_allowed(u,c.id) then
   foreach channel_name in array array['in_app','email'] loop
    insert into private.outbox(account_id,case_id,organization_id,kind,channel,dedupe_key) values(u,c.id,c.organization_id,p_kind,channel_name,p_kind||':'||p_event||':'||u::text||':'||channel_name) on conflict(dedupe_key) do nothing;
   end loop;
  end if;
 end loop;
end $$;
revoke all on function private.goos_s3_emit(uuid,text,text) from public,anon,authenticated;
grant execute on function private.goos_s3_emit(uuid,text,text) to goos_api,goos_worker;

create function public.goos_s3_preferences() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 return coalesce((select jsonb_build_object('in_app',in_app,'email',email,'timezone',timezone,'version',version) from app.notification_preferences where account_id=private.goos_uid()),jsonb_build_object('in_app',true,'email',false,'timezone','UTC','version',0));
end $$;
create function public.goos_s3_save_preferences(p_in_app boolean,p_email boolean,p_timezone text,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare v integer;begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 perform pg_advisory_xact_lock(hashtextextended(private.goos_uid()::text||':s3.preferences',0));
 select version into v from app.notification_preferences where account_id=private.goos_uid() for update;
 if coalesce(v,0) is distinct from p_version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_in_app is null or p_email is null or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'invalid_input' using errcode='22023';end if;
 if p_email and not exists(select 1 from app.subjects where account_id=private.goos_uid() and safe_contact='email' and private.goos_owns_subject(id)) then raise exception 'safe_email_required' using errcode='22023';end if;
 insert into app.notification_preferences(account_id,in_app,email,timezone) values(private.goos_uid(),p_in_app,p_email,p_timezone)
 on conflict(account_id) do update set in_app=excluded.in_app,email=excluded.email,timezone=excluded.timezone,version=app.notification_preferences.version+1;
 perform private.goos_audit('notification.preferences',private.goos_uid());
end $$;
create function public.goos_s3_inbox() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'read_at',read_at,'created_at',created_at,'resource_path',resource_path) order by created_at desc),'[]') from(select * from app.notifications where account_id=private.goos_uid() and private.goos_actor_active() order by created_at desc limit 50) n;
$$;
create function public.goos_s3_delivery_status(p_org uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not(case when p_org is null then private.goos_platform_admin() else private.goos_s3_routing(p_org) end) then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'channel',channel,'status',status,'attempts',attempts,'error_code',last_error_code,'available_at',available_at,'created_at',created_at) order by created_at desc),'[]') from(select * from private.outbox where p_org is null or organization_id=p_org order by created_at desc limit 50) jobs);
end $$;
create function private.goos_s3_dead_alert(p_job uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 for u in select distinct g.account_id from private.platform_role_grants g join app.accounts a on a.id=g.account_id and a.status='active' where g.revoked_at is null and(g.expires_at is null or g.expires_at>now()) loop
 insert into app.notifications(account_id,kind,source_event_id) values(u,'workflow.dead_letter',gen_random_uuid());
 end loop;
end $$;
revoke all on function private.goos_s3_dead_alert(uuid) from public,anon,authenticated,goos_api;
grant execute on function private.goos_s3_dead_alert(uuid) to goos_worker;
create function private.goos_s3_claim(p_channel text,p_limit integer default 20,p_ids uuid[] default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.outbox;t jsonb;v_lease uuid;v_result jsonb:='[]';begin
 if p_channel is null or p_channel not in('in_app','email') or p_limit is null or p_limit not between 1 and 20 or cardinality(p_ids)>100 then raise exception 'invalid_input' using errcode='22023';end if;
 for j in select * from private.outbox where channel=p_channel and(p_ids is null or id=any(p_ids)) and(status='pending' and available_at<=now() or status='inflight' and lease_until<=now()) order by available_at,id for update skip locked limit p_limit loop
  if j.attempts>=5 then update private.outbox set status='dead',last_error_code='lease_expired' where id=j.id;perform private.goos_s3_dead_alert(j.id);continue;end if;
  t:=private.goos_s3_email_target(j.account_id,p_channel);
  if not private.goos_s3_delivery_allowed(j.account_id,j.case_id) or coalesce((t->>'enabled')::boolean,false)=false then update private.outbox set status='cancelled' where id=j.id;continue;end if;
  if(select count(*) from private.outbox where account_id=j.account_id and channel=p_channel and status='delivered' and delivered_at>now()-interval '1 day')>=20 then update private.outbox set available_at=now()+interval '1 hour',status='pending' where id=j.id;continue;end if;
  v_lease:=gen_random_uuid();update private.outbox set status='inflight',attempts=attempts+1,lease_id=v_lease,lease_until=now()+interval '2 minutes' where id=j.id;
  v_result:=v_result||jsonb_build_array(jsonb_build_object('id',j.id,'lease_id',v_lease,'kind',j.kind,'channel',j.channel,'locale',t->>'locale','email',t->>'email','path','/workflow'));
 end loop;return v_result;
end $$;
create function private.goos_s3_revalidate(p_id uuid,p_lease uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.outbox j where j.id=p_id and j.status='inflight' and j.lease_id=p_lease and j.lease_until>now() and private.goos_s3_delivery_allowed(j.account_id,j.case_id) and coalesce((private.goos_s3_email_target(j.account_id,j.channel)->>'enabled')::boolean,false));
$$;
create function private.goos_s3_ack(p_id uuid,p_lease uuid,p_ok boolean,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare j private.outbox;begin
 select * into j from private.outbox where id=p_id for update;
 if not found or j.lease_id is distinct from p_lease or p_lease is null or p_ok is null then raise exception 'lease_conflict' using errcode='40001';end if;
 if j.status='delivered' and p_ok then return;end if;
 if j.status<>'inflight' or j.lease_until<=now() then raise exception 'lease_conflict' using errcode='40001';end if;
 if not private.goos_s3_revalidate(j.id,p_lease) then update private.outbox set status='cancelled' where id=j.id;return;end if;
 if p_ok then
  if j.channel='in_app' then insert into app.notifications(account_id,kind,source_event_id,resource_path) values(j.account_id,j.kind,j.id,'/workflow') on conflict(source_event_id) do nothing;end if;
  update private.outbox set status='delivered',delivered_at=now(),last_error_code=null where id=j.id;
 else
  if p_error is null or p_error not in('transport_unavailable','smtp_rejected','worker_failed') then raise exception 'invalid_error' using errcode='22023';end if;
  update private.outbox set status=case when attempts>=5 then 'dead' else 'pending' end,available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts-1)::integer)+abs(hashtext(id::text)%7)),last_error_code=p_error where id=j.id;
  if j.attempts>=5 then perform private.goos_s3_dead_alert(j.id);end if;
 end if;
end $$;
grant create on schema private to goos_worker;
DO $$declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=any(array['goos_s3_claim','goos_s3_revalidate','goos_s3_ack']) loop
 execute format('alter function %s owner to goos_worker',f.sig);execute format('revoke all on function %s from public,anon,authenticated,goos_api,goos_authz',f.sig);
 end loop;
end $$;
revoke create on schema private from goos_worker;

-- Typed registry: follow-up reminder เท่านั้น ไม่รัน user SQL/JS และไม่เปลี่ยนผลการรับบริการ
create function public.goos_s3_rules(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin if not private.goos_s3_routing(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(to_jsonb(r)-'created_by'),'[]') from app.automation_rules r where organization_id=p_org);end $$;
create function public.goos_s3_save_rule(p_org uuid,p_id uuid,p_enabled boolean,p_minutes integer,p_timezone text,p_version integer) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_version integer;begin
 if not private.goos_s3_supervisor(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':s3.rules',0));
 if p_id is not null then select version into v_version from app.automation_rules where id=p_id and organization_id=p_org for update;if not found then raise exception 'not_found' using errcode='P0002';end if;end if;
 if coalesce(v_version,0) is distinct from p_version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_enabled is null or p_minutes is null or p_minutes not between 0 and 10080 or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'invalid_input' using errcode='22023';end if;
 if p_id is null then
  if(select count(*) from app.automation_rules where organization_id=p_org)>=5 then raise exception 'rule_limit' using errcode='22023';end if;
  insert into app.automation_rules(organization_id,enabled,minutes_before,timezone,created_by) values(p_org,p_enabled,p_minutes,p_timezone,private.goos_uid()) returning id into v_id;
 else update app.automation_rules set enabled=p_enabled,minutes_before=p_minutes,timezone=p_timezone,version=version+1,updated_at=now() where id=p_id returning id into v_id;end if;
 perform private.goos_audit('automation.rule',v_id,p_org);return v_id;
end $$;
create function public.goos_s3_dry_run(p_rule uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r app.automation_rules;begin
 select * into r from app.automation_rules where id=p_rule;
 if not found or not private.goos_s3_supervisor(r.organization_id) then raise exception 'not_found' using errcode='P0002';end if;
 return jsonb_build_object('kind',r.kind,'timezone',r.timezone,'candidate_count',(select count(*) from app.cases c where c.organization_id=r.organization_id and c.state not in('closed','cancelled','resolved') and c.due_at<=now()+make_interval(mins=>r.minutes_before)),'writes',0);
end $$;
create function private.goos_s3_tick(p_org uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare c record;v_count integer:=0;begin
 for c in select c.id,c.version,c.due_at,r.id rule_id,r.version rule_version from app.automation_rules r join app.cases c on c.organization_id=r.organization_id where r.enabled and(p_org is null or r.organization_id=p_org) and c.state not in('closed','cancelled','resolved') and c.due_at<=now()+make_interval(mins=>r.minutes_before) order by c.due_at,c.id limit 100 loop
  perform private.goos_s3_emit(c.id,'followup.due',c.id::text||':'||c.version::text||':'||c.rule_id::text||':'||c.rule_version::text);v_count:=v_count+1;
 end loop;return v_count;
end $$;
revoke all on function private.goos_s3_tick(uuid) from public,anon,authenticated,goos_api,goos_authz;
grant execute on function private.goos_s3_tick(uuid) to goos_worker;
-- tick เป็น operator routine ที่มี scope ชัด; worker ไม่มี table DML สำหรับ case state
DO $$declare f record;begin
 grant create on schema public to goos_api;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'goos_s3_%' loop
 execute format('alter function %s owner to goos_api',f.sig);execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
 revoke create on schema public from goos_api;
end $$;
grant execute on function public.goos_s3_availability(uuid) to anon;
