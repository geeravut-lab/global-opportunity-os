-- Narrow metadata candidates before the unchanged per-resource authorization checks.
-- Candidate membership is never an authorization grant, and these helpers are not public RPCs.
create function private.goos_s4_owned_candidates() returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(id),'{}'::uuid[]) from app.subjects where account_id=private.goos_uid();
$$;
create function private.goos_s4_candidates(p_kind text) returns uuid[] language sql stable security definer set search_path='' as $$
 with actor as materialized(select private.goos_uid() uid,private.goos_platform_admin() admin,private.goos_s4_editor_org_candidates() orgs,private.goos_s4_owned_candidates() subjects),
 source_cases as materialized(select id from app.cases where organization_id=any((select orgs from actor)::uuid[])),
 destination_cases as materialized(select id from private.s4_cases where organization_id=any((select orgs from actor)::uuid[]))
 select coalesce(array_agg(id),'{}'::uuid[]) from(
 select id from private.s4_referrals where p_kind='referrals' and(subject_id=any((select subjects from actor)::uuid[]) or source_case_id in(select id from source_cases) or recipient_org_id=any((select orgs from actor)::uuid[]))
 union all select id from private.s4_outcomes where p_kind='outcomes' and(subject_id=any((select subjects from actor)::uuid[]) or source_case_id in(select id from source_cases) or referral_case_id in(select id from destination_cases) or reviewer_id=(select uid from actor) or(select admin from actor))
 union all select id from private.s4_privacy where p_kind='privacy' and(subject_id=any((select subjects from actor)::uuid[]) or officer_id=(select uid from actor) or(select admin from actor))
 union all select id from private.s4_reports where p_kind='reports' and(reporter_id=(select uid from actor) or officer_id=(select uid from actor) or(select admin from actor))
 ) candidates;
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_owned_candidates() owner to goos_authz;
alter function private.goos_s4_candidates(text) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_owned_candidates(),private.goos_s4_candidates(text) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_owned_candidates(),private.goos_s4_candidates(text) to goos_api;
create index s4_case_org_candidates on private.s4_cases(organization_id,id);
DO $$declare d text;r text;k text;begin
 d:=pg_get_functiondef('private.goos_s4_clock()'::regprocedure);r:=d;
 foreach k in array array['referrals','outcomes','privacy','reports'] loop
  r:=replace(r,format('from private.s4_%s where private.goos_s4_',k),format('from private.s4_%s where id=any((select private.goos_s4_candidates(%L))::uuid[]) and private.goos_s4_',k,k));
 end loop;
 r:=replace(r,'from private.s4_cases c where private.goos_s4_referral','from private.s4_cases c where c.referral_id=any((select private.goos_s4_candidates(''referrals''))::uuid[]) and private.goos_s4_referral');
 r:=replace(r,'from private.s4_evidence e where private.goos_s4_outcome','from private.s4_evidence e where e.outcome_id=any((select private.goos_s4_candidates(''outcomes''))::uuid[]) and private.goos_s4_outcome');
 r:=replace(r,'where private.goos_s4_work(c.id) or n.visibility=''beneficiary_shared'' and private.goos_owns_subject(c.subject_id)','where c.referral_id=any((select private.goos_s4_candidates(''referrals''))::uuid[]) and (private.goos_s4_work(c.id) or n.visibility=''beneficiary_shared'' and private.goos_owns_subject(c.subject_id))');
 r:=replace(r,'from private.s4_cessations where private.goos_owns_subject(subject_id) or private.goos_s3_routing(recipient_org_id)','from private.s4_cessations where (subject_id=any((select private.goos_s4_owned_candidates())::uuid[]) or recipient_org_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) and (private.goos_owns_subject(subject_id) or private.goos_s3_routing(recipient_org_id))');
 if r=d then raise exception 'S4 live clock candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_s4_deadline()'::regprocedure);
 r:=replace(d,'from private.s4_referrals where','from private.s4_referrals where id=any((select private.goos_s4_candidates(''referrals''))::uuid[]) and');
 if r=d then raise exception 'S4 deadline candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_sources()'::regprocedure);
 r:=replace(d,'where private.goos_owns_subject(c.subject_id) or private.goos_s4_source(c.id)','where (c.subject_id=any((select private.goos_s4_owned_candidates())::uuid[]) or c.organization_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) and (private.goos_owns_subject(c.subject_id) or private.goos_s4_source(c.id))');
 r:=replace(r,'where private.goos_owns_subject(c.subject_id) or private.goos_s4_work(c.id)','where (c.subject_id=any((select private.goos_s4_owned_candidates())::uuid[]) or c.organization_id=any((select private.goos_s4_editor_org_candidates())::uuid[])) and (private.goos_owns_subject(c.subject_id) or private.goos_s4_work(c.id))');
 if r=d then raise exception 'S4 sources candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
