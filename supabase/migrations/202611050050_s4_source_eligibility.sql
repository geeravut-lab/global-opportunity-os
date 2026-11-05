-- Fail before consent if the warm-handoff source is no longer shareable; direct applications remain in S3.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_propose(uuid,uuid,text)'::regprocedure);
 r:=replace(d,$s$or c.state='cancelled' or not private.goos_s4_person_valid$s$,$s$or c.state='cancelled' or not private.goos_s4_case_active(c.id,null) or not private.goos_s4_person_valid$s$);if r=d then raise exception 'S4 source eligibility mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_sources()'::regprocedure);
 r:=replace(d,$s$coalesce(o.display_name,r.title_en) organization_name from app.cases$s$,$s$coalesce(o.display_name,r.title_en) organization_name,private.goos_s4_case_active(c.id,null) can_refer from app.cases$s$);
 r:=replace(r,$s$c.organization_id,coalesce(o.display_name,'') from private.s4_cases$s$,$s$c.organization_id,coalesce(o.display_name,''),false from private.s4_cases$s$);if r=d then raise exception 'S4 source DTO mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
