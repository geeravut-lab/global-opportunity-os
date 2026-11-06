-- Fetch source/destination cases and queue rows by candidate IDs before RLS and the original predicates.
create function private.goos_s4_case_candidates(p_destination boolean) returns uuid[] language sql stable security definer set search_path='' as $$
 select case when p_destination then(
 select coalesce(array_agg(id),'{}'::uuid[]) from private.s4_cases where subject_id=any((select private.goos_s4_owned_candidates())::uuid[]) or organization_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) else(
 select coalesce(array_agg(id),'{}'::uuid[]) from app.cases where subject_id=any((select private.goos_s4_owned_candidates())::uuid[]) or organization_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) end;
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_case_candidates(boolean) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_case_candidates(boolean) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_case_candidates(boolean) to goos_api;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_sources()'::regprocedure);
 r:=replace(d,'where (c.subject_id=any((select private.goos_s4_owned_candidates())::uuid[]) or c.organization_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) and (private.goos_owns_subject(c.subject_id) or private.goos_s4_source(c.id))','where c.id=any((select private.goos_s4_case_candidates(false))::uuid[]) and (private.goos_owns_subject(c.subject_id) or private.goos_s4_source(c.id))');
 r:=replace(r,'where (c.subject_id=any((select private.goos_s4_owned_candidates())::uuid[]) or c.organization_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) and (private.goos_owns_subject(c.subject_id) or private.goos_s4_work(c.id))','where c.id=any((select private.goos_s4_case_candidates(true))::uuid[]) and (private.goos_owns_subject(c.subject_id) or private.goos_s4_work(c.id))');
 if r=d then raise exception 'S4 source case candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_list(text,integer)'::regprocedure);
 r:=replace(d,'where p_kind=''referrals''','where p_kind=''referrals'' and id=any((select private.goos_s4_candidates(''referrals''))::uuid[])');
 r:=replace(r,'where p_kind=''outcomes''','where p_kind=''outcomes'' and id=any((select private.goos_s4_candidates(''outcomes''))::uuid[])');
 r:=replace(r,'where p_kind=''privacy''','where p_kind=''privacy'' and id=any((select private.goos_s4_candidates(''privacy''))::uuid[])');
 r:=replace(r,'where p_kind=''reports''','where p_kind=''reports'' and id=any((select private.goos_s4_candidates(''reports''))::uuid[])');
 if r=d then raise exception 'S4 queue candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';

-- Request budgets also need indexed actor candidates before resource RLS on accumulated history.
create index s4_referral_proposer_budget on private.s4_referrals(proposed_by,created_at);
create index s4_preview_actor_budget on private.s4_previews(actor_id,expires_at);
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_propose(uuid,uuid,text)'::regprocedure);
 r:=replace(d,'where proposed_by=private.goos_uid() and created_at','where proposed_by=(select private.goos_uid()) and created_at');
 if r=d then raise exception 'S4 proposer budget candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_preview(uuid,text[],jsonb,uuid)'::regprocedure);
 r:=replace(d,'where actor_id=private.goos_uid() and expires_at','where actor_id=(select private.goos_uid()) and expires_at');
 if r=d then raise exception 'S4 preview budget candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
