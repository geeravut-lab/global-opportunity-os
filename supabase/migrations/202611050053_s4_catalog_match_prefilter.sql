-- Avoid checking private/inactive historical revisions as rule-matching candidates; preserve the public-listing predicate and RLS.
create index if not exists opportunities_match_candidates on app.opportunities(state,id) include(approved_revision_id);
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s2_matches()'::regprocedure);
 r:=replace(d,$s$from app.opportunities p join app.opportunity_revisions r on r.id=p.approved_revision_id where private.goos_s2_public_listing(p.id)$s$,$s$from app.opportunities p join app.opportunity_revisions r on r.id=p.approved_revision_id where p.state='published' and r.valid_until>now() and private.goos_s2_public_listing(p.id)$s$);
 if r=d then raise exception 'S2 matching candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
