create table private.policy_roster(policy_id uuid not null references private.policy_versions(id),account_id uuid not null references app.accounts(id),scope text not null check(scope in('impact','privacy','safety')),selected_by uuid not null references app.accounts(id),selected_at timestamptz not null default now(),revoked_at timestamptz,primary key(policy_id,account_id,scope));
alter table private.policy_roster enable row level security;
revoke all on private.policy_roster from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create or replace function private.goos_policy_roster_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.policy_current where policy_id is not null) and not exists(select 1 from unnest(array['impact','privacy','safety']) s where not exists(
 select 1 from private.policy_current pc join private.policy_roster pr on pr.policy_id=pc.policy_id and pr.scope=s and pr.revoked_at is null
 join private.s4_staff_scopes g on g.account_id=pr.account_id and g.scope=pr.scope join app.accounts a on a.id=g.account_id join auth.users u on u.id=a.id
 where g.revoked_at is null and g.expires_at>now() and a.status='active' and u.email_confirmed_at is not null
 and exists(select 1 from app.subjects x where x.account_id=a.id and x.status='active' and x.age_band='adult')
 and exists(select 1 from auth.mfa_factors f where f.user_id=a.id and f.status='verified')));
$$;
create function private.goos_policy_staff(p_account uuid,p_scope text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.policy_current pc join private.policy_roster pr on pr.policy_id=pc.policy_id where pr.account_id=p_account and pr.scope=p_scope and pr.revoked_at is null);
$$;
revoke all on function private.goos_policy_staff(uuid,text) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_policy_staff(uuid,text) to goos_api,goos_authz;
create function private.goos_policy_enforce_roster() returns boolean language sql stable security definer set search_path='' as $$select mode='enabled' from private.s4_release where singleton;$$;
revoke all on function private.goos_policy_enforce_roster() from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_policy_enforce_roster() to goos_api,goos_authz;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_policy_scope(uuid,text,boolean,timestamp with time zone)'::regprocedure);
 r:=replace(d,$s$perform private.goos_audit('policy.staff.scope.changed',p_account);$s$,$s$
 if p_grant then
  insert into private.policy_roster(policy_id,account_id,scope,selected_by) select policy_id,p_account,p_scope,private.goos_uid() from private.policy_current where policy_id is not null on conflict(policy_id,account_id,scope) do update set selected_by=excluded.selected_by,selected_at=now(),revoked_at=null;
 else update private.policy_roster set revoked_at=now() where policy_id=(select policy_id from private.policy_current where singleton) and account_id=p_account and scope=p_scope and revoked_at is null;end if;
 perform private.goos_audit('policy.staff.scope.changed',p_account);$s$);if r=d then raise exception 'Named policy roster source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_s4_scope(text)'::regprocedure);
 r:=replace(d,$s$select private.goos_staff_assured() and exists$s$,$s$select private.goos_staff_assured() and(case when private.goos_policy_enforce_roster() then private.goos_policy_staff(private.goos_uid(),p_scope) else true end) and exists$s$);if r=d then raise exception 'Named scope source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_blockers(uuid,uuid)'::regprocedure);
 r:=replace(d,$s$if r.assignment_expires_at is null$s$,$s$if not private.goos_policy_staff(r.officer_id,'privacy') then b:=array_append(b,'OFFICER_NOT_IN_POLICY_ROSTER');end if;
 if r.assignment_expires_at is null$s$);if r=d then raise exception 'Purge named officer source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_policy_read()'::regprocedure);
 r:=replace(d,$s$where g.revoked_at is null and g.expires_at>now()$s$,$s$where g.revoked_at is null and g.expires_at>now() and exists(select 1 from private.policy_current pc join private.policy_roster pr on pr.policy_id=pc.policy_id where pr.account_id=g.account_id and pr.scope=g.scope and pr.revoked_at is null)$s$);if r=d then raise exception 'Policy roster projection source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
-- เลือก recipient candidates ก่อน RLS; ป้องกัน inbox timeout เมื่อมีประวัติหลายผู้ใช้
create index notification_recipient_recent on app.notifications(account_id,created_at desc,id);
create function private.goos_notification_candidates(p_limit integer) returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(id),'{}'::uuid[]) from(select id from app.notifications where account_id=private.goos_uid() and private.goos_actor_active() order by created_at desc,id limit least(greatest(p_limit,1),100)) n;
$$;
revoke all on function private.goos_notification_candidates(integer) from public,anon,authenticated,goos_authz,goos_worker,goos_reporter;
grant execute on function private.goos_notification_candidates(integer) to goos_api;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_notifications()'::regprocedure);
 r:=replace(d,'from app.notifications order by','from app.notifications where id=any(private.goos_notification_candidates(100)) order by');if r=d then raise exception 'Notification candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s3_inbox()'::regprocedure);
 r:=replace(d,'where account_id=private.goos_uid() and private.goos_actor_active() order by','where id=any(private.goos_notification_candidates(50)) and account_id=(select private.goos_uid()) and (select private.goos_actor_active()) order by');if r=d then raise exception 'Inbox candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
