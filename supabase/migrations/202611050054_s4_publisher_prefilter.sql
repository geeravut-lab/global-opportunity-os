-- Narrow current-membership candidates before evaluating per-organization RLS/editor rules; preserve all original authorization predicates.
create function private.goos_s4_editor_org_candidates() returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(m.organization_id),'{}'::uuid[]) from app.org_memberships m where m.account_id=private.goos_uid() and m.status='active' and private.goos_actor_active();
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_editor_org_candidates() owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_editor_org_candidates() from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_editor_org_candidates() to goos_api;
create index opportunities_org_queue on app.opportunities(organization_id,updated_at desc,id);
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s2_orgs(boolean,integer)'::regprocedure);
 r:=replace(d,$s$from app.organizations source where case$s$,$s$from app.organizations source where (p_review or source.id=any((select private.goos_s4_editor_org_candidates())::uuid[])) and case$s$);
 if r=d then raise exception 'S2 own organizations candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s2_listings(uuid,boolean,integer)'::regprocedure);
 r:=replace(d,$s$from app.opportunities source where(p_org$s$,$s$from app.opportunities source where (p_review or source.organization_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) and(p_org$s$);
 if r=d then raise exception 'S2 publisher listing candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
