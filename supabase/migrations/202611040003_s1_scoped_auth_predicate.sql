grant create on schema private to goos_authz;
-- Supabase เป็นเจ้าของ schema auth; app roles ไม่รับ inheritance/สิทธิ์กว้างจาก authenticated
-- อ่าน JWT claims ที่ PostgREST ตรวจลายเซ็นก่อนเรียก RPC ไม่ใช่ค่าจาก body
create function private.goos_uid() returns uuid language sql stable set search_path='' as $$
 select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid;
$$;
create function private.goos_claims() returns jsonb language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
$$;
alter function private.goos_uid() owner to goos_authz;
alter function private.goos_claims() owner to goos_authz;
revoke all on function private.goos_uid(),private.goos_claims() from public,anon,authenticated;
grant execute on function private.goos_uid(),private.goos_claims() to goos_api;

-- ข้อยกเว้นแคบ: predicate ของ auth metadata เป็นของ migration operator ที่อ่าน auth ได้
-- ไม่มี argument รับ user ID, คืนเพียง booleans ของ actor/session ปัจจุบัน ไม่มี PII หรือ mutation
-- ไม่มี API route / exposed schema หรือ EXECUTE grant แก่ anon/authenticated
create function private.goos_auth_identity() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'verified',exists(select 1 from auth.users u where u.id=private.goos_uid() and u.email_confirmed_at is not null and not u.is_anonymous),
 'session_live',exists(select 1 from auth.sessions s where s.id::text=private.goos_claims()->>'session_id' and s.user_id=private.goos_uid()),
 'mfa_live',exists(select 1 from auth.mfa_factors f where f.user_id=private.goos_uid() and f.status='verified'));
$$;
revoke all on function private.goos_auth_identity() from public,anon,authenticated,goos_api;
grant execute on function private.goos_auth_identity() to goos_authz;

create or replace function private.goos_session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_uid() is not null and (private.goos_auth_identity()->>'session_live')::boolean
 and not exists(select 1 from private.revoked_sessions r where r.session_id::text=private.goos_claims()->>'session_id' and r.account_id=private.goos_uid());
$$;
create or replace function private.goos_verified_identity() returns boolean language sql stable security definer set search_path='' as $$
 select (private.goos_auth_identity()->>'verified')::boolean;
$$;
create or replace function private.goos_staff_assured() returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and private.goos_claims()->>'aal'='aal2' and (private.goos_auth_identity()->>'mfa_live')::boolean;
$$;
-- เปลี่ยนเฉพาะฟังก์ชันและ policies ของ S1 ให้ใช้ claims helper ภายใน
-- ตัวกำหนดถูกอ่านจาก system catalog ที่ผู้รัน migration ควบคุม ไม่รับข้อความ SQL จากผู้ใช้
 do $$ declare f record;definition text;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.proname=any(array['goos_accept_invitation','goos_actor_active','goos_audit','goos_bootstrap_account','goos_can_subject','goos_cancel_invitation','goos_consents','goos_context','goos_create_delegation','goos_create_organization','goos_create_profile','goos_delegations','goos_has_org_role','goos_has_platform_role','goos_invite_member','goos_inviter_valid','goos_members','goos_my_invitations','goos_notices','goos_org_invitations','goos_organizations','goos_owns_subject','goos_profile','goos_recipient_active','goos_revoke_current_session','goos_revoke_delegation','goos_revoke_member','goos_session_valid','goos_staff_assured','goos_update_profile','goos_verified_identity']) and n.nspname in ('public','private') and p.proname not in ('goos_auth_identity','goos_uid','goos_claims') loop
  definition:=replace(replace(pg_get_functiondef(f.signature::oid),'auth.uid()','private.goos_uid()'),'auth.jwt()','private.goos_claims()');
  execute definition;
 end loop;
 end $$;
 do $$ declare p record;statement text;begin
 for p in select * from pg_policies where (schemaname='app' and tablename=any(array['accounts','subjects','organizations','role_definitions','org_memberships','org_member_roles','org_invitations','notice_versions','delegations','delegation_scopes'])) or (schemaname='private' and tablename=any(array['consent_events','revoked_sessions','audit_events','platform_role_grants'])) loop
  statement:=format('alter policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  if p.qual is not null then statement:=statement||' using ('||replace(replace(p.qual,'auth.uid()','private.goos_uid()'),'auth.jwt()','private.goos_claims()')||')';end if;
  if p.with_check is not null then statement:=statement||' with check ('||replace(replace(p.with_check,'auth.uid()','private.goos_uid()'),'auth.jwt()','private.goos_claims()')||')';end if;
  execute statement;
 end loop;
 end $$;

revoke create on schema private from goos_authz;
