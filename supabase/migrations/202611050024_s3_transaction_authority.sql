-- FOR UPDATE ใช้ UPDATE RLS ด้วย จึงต้องอนุญาต barrier เฉพาะ current preview/application authority
create function private.goos_s3_listing_transaction(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and(exists(select 1 from private.s3_previews v where v.opportunity_id=p_id and v.actor_id=private.goos_uid() and v.expires_at>now() and private.goos_can_subject(v.subject_id,'application:submit'))
 or exists(select 1 from app.applications a where a.opportunity_id=p_id and(private.goos_can_subject(a.subject_id,'application:submit') or private.goos_s3_work(a.id) or private.goos_s3_supervisor(a.organization_id))));
$$;
create function private.goos_s3_assignment_target(p_member uuid,p_org uuid,p_role text) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_s3_supervisor(p_org) and exists(select 1 from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id join app.accounts a on a.id=m.account_id and a.status='active' where m.id=p_member and m.organization_id=p_org and m.status='active' and r.role_code=p_role);
$$;
grant create on schema private to goos_authz;
alter function private.goos_s3_listing_transaction(uuid) owner to goos_authz;
alter function private.goos_s3_assignment_target(uuid,uuid,text) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s3_listing_transaction(uuid),private.goos_s3_assignment_target(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.goos_s3_listing_transaction(uuid),private.goos_s3_assignment_target(uuid,uuid,text) to goos_api;
create policy s3_listing_barrier on app.opportunities for update to goos_api using(private.goos_s3_listing_transaction(id)) with check(private.goos_s3_listing_transaction(id));
-- Supervisor-only membership ไม่ได้รับ S1 member-admin SELECT จึงใช้ scoped predicate
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s3_assign(uuid,uuid,integer)'::regprocedure);
 r:=replace(d,$s$exists(select 1 from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id join app.accounts account on account.id=m.account_id and account.status='active' where m.id=p_member and m.organization_id=c.organization_id and m.status='active' and r.role_code=v_kind)$s$,$s$private.goos_s3_assignment_target(p_member,c.organization_id,v_kind)$s$);
 if r=d then raise exception 'assignment guard source mismatch';end if;execute r;
end $$;
-- Explicit submit authority มีสิทธิ์สร้าง receipt แม้ไม่ได้รับ progress:read; ไม่ขยาย package reads
alter policy s3_case_api on app.cases using(private.goos_s3_visible(application_id)) with check(private.goos_s3_visible(application_id));
-- Signals ของ assignment ต้องตรวจบทบาทและ share ปัจจุบัน ไม่ใช้แค่ active membership
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s3_signal()'::regprocedure);
 r:=replace(d,$s$ca.ends_at is null and m.status='active'$s$,$s$ca.ends_at is null and m.status='active' and exists(select 1 from app.org_member_roles mr join app.opportunity_revisions rev on rev.id=a.revision_id where mr.membership_id=m.id and mr.role_code=case when rev.category='jobs' then 'recruiter' else 'caseworker' end) and private.goos_s3_delivery_allowed(m.account_id,ca.case_id)$s$);
 if r=d then raise exception 'signal guard source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
