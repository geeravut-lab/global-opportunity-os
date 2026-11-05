-- Roster names use narrow checked helpers, keeping beneficiary display_alias out of authz table grants.
alter function private.goos_s4_staff_list() owner to postgres;
alter function private.goos_s4_team(uuid) owner to postgres;
create function private.goos_s4_deadline() returns timestamptz language sql stable security definer set search_path='' as $$
 select case when private.goos_s4_enabled() and private.goos_actor_active() then(select min(t) from(
 select expires_at t from private.s4_referrals where state in('proposed','pending') and private.goos_s4_referral(id)
 union all select share_expires_at from private.s4_referrals where share_active and private.goos_s4_referral(id)
 union all select review_expires_at from private.s4_outcomes where reviewer_id=private.goos_uid() and private.goos_s4_outcome(id)
 union all select assignment_expires_at from private.s4_privacy where officer_id=private.goos_uid()
 union all select assignment_expires_at from private.s4_reports where officer_id=private.goos_uid()
 union all select expires_at from private.s4_staff_scopes where account_id=private.goos_uid() and revoked_at is null
 )x where t>now()) end;
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_deadline() owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_deadline() from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_deadline() to goos_api;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_live_fingerprint()'::regprocedure);
 r:=replace(d,$s$least((v_catalog->>'next_at')::timestamptz,(v_s3->>'next_at')::timestamptz)$s$,$s$least((v_catalog->>'next_at')::timestamptz,(v_s3->>'next_at')::timestamptz,private.goos_s4_deadline())$s$);if r=d then raise exception 'S4 deadline source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
