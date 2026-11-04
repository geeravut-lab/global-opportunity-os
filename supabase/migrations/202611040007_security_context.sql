create function private.goos_recovery_session() returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from jsonb_array_elements(coalesce(private.goos_claims()->'amr','[]'::jsonb)) a
 where a->>'method' in ('otp','recovery') and (a->>'timestamp')::numeric between extract(epoch from now())-900 and extract(epoch from now())+30);
$$;
grant create on schema private to goos_authz;
alter function private.goos_recovery_session() owner to goos_authz;
revoke all on function private.goos_recovery_session() from public,anon,authenticated;
grant execute on function private.goos_recovery_session() to goos_api;
revoke create on schema private from goos_authz;
create or replace function public.goos_context() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 return jsonb_build_object('account_id',private.goos_uid(),'locale',(select locale from app.accounts where id=private.goos_uid()),
 'subject_id',(select id from app.subjects where account_id=private.goos_uid()),'aal',private.goos_claims()->>'aal','staff_assured',private.goos_staff_assured(),
 'has_platform_role',private.goos_has_platform_role(),'has_membership',exists(select 1 from app.org_memberships where account_id=private.goos_uid() and status='active'),
 'can_reset_password',private.goos_recovery_session());
end $$;
