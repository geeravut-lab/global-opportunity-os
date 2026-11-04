-- Only a boolean is returned; Auth password hashes never leave this operator-owned predicate.
create or replace function private.goos_auth_identity() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'verified',exists(select 1 from auth.users u where u.id=private.goos_uid() and u.email_confirmed_at is not null and not u.is_anonymous),
 'session_live',exists(select 1 from auth.sessions s where s.id::text=private.goos_claims()->>'session_id' and s.user_id=private.goos_uid()),
 'mfa_live',exists(select 1 from auth.mfa_factors f where f.user_id=private.goos_uid() and f.status='verified'),
 'password_ready',exists(select 1 from auth.users u where u.id=private.goos_uid() and coalesce(u.encrypted_password,'')<>''));
$$;
create or replace function public.goos_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 return jsonb_build_object('account_id',private.goos_uid(),'locale',(select locale from app.accounts where id=private.goos_uid()),
 'subject_id',(select id from app.subjects where account_id=private.goos_uid()),'aal',private.goos_claims()->>'aal','staff_assured',private.goos_staff_assured(),
 'has_platform_role',private.goos_has_platform_role(),'has_membership',exists(select 1 from app.org_memberships where account_id=private.goos_uid() and status='active'),
 'can_reset_password',private.goos_recovery_session(),'has_password',(private.goos_auth_identity()->>'password_ready')::boolean);
end $$;
-- goos_api cannot call the Auth predicate directly: use the authz-owned boolean bridge.
create function private.goos_has_password() returns boolean language sql stable security definer set search_path='' as $$select (private.goos_auth_identity()->>'password_ready')::boolean;$$;
grant create on schema private to goos_authz;
alter function private.goos_has_password() owner to goos_authz;
revoke all on function private.goos_has_password() from public,anon,authenticated;
grant execute on function private.goos_has_password() to goos_api;
revoke create on schema private from goos_authz;
do $$declare f text;begin f:=replace(pg_get_functiondef('public.goos_context()'::regprocedure),'(private.goos_auth_identity()->>''password_ready'')::boolean','private.goos_has_password()');execute f;end $$;
