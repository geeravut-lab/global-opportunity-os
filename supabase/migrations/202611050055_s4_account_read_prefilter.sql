-- Account pages must narrow metadata to the current owner/membership before evaluating unchanged RLS predicates on historical fixtures.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_organizations()'::regprocedure);
 r:=replace(d,$s$where private.goos_has_org_role(o.id$s$,$s$where o.id=any((select private.goos_s4_editor_org_candidates())::uuid[]) and private.goos_has_org_role(o.id$s$);
 if r=d then raise exception 'Account organization candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_consents()'::regprocedure);
 r:=replace(d,$s$from private.consent_events;$s$,$s$from private.consent_events where subject_id=any((select coalesce(array_agg(id),'{}'::uuid[]) from app.subjects where account_id=private.goos_uid())::uuid[]);$s$);
 if r=d then raise exception 'Account consent candidate source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_delegations()'::regprocedure);
 r:=replace(d,$s$from app.delegations d;$s$,$s$from app.delegations d where d.delegate_account_id=private.goos_uid() or d.subject_id=any((select coalesce(array_agg(id),'{}'::uuid[]) from app.subjects where account_id=private.goos_uid())::uuid[]);$s$);
 if r=d then raise exception 'Account delegation candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
