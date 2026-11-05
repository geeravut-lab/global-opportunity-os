-- Evidence/outcome updates wake currently assigned case staff, in addition to the owner and scoped reviewer; signals contain no payload.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s4_signal()'::regprocedure);
 r:=replace(d,$s$if v_officer is not null and exists$s$,$s$
 if v_kind='outcomes' then
  for v_old in select distinct actor from(
   select m.account_id actor from private.s4_outcomes o join private.s4_cases c on c.id=o.referral_case_id join app.org_memberships m on m.id=c.membership_id where o.id=v_id and m.status='active' and private.goos_s4_case_active(o.source_case_id,o.referral_case_id)
   union select m.account_id from private.s4_outcomes o join app.case_assignments a on a.case_id=o.source_case_id and a.ends_at is null join app.org_memberships m on m.id=a.membership_id where o.id=v_id and m.status='active' and private.goos_s4_case_active(o.source_case_id,o.referral_case_id)
  ) actors where actor is not null loop perform private.goos_live_bump(v_old);end loop;
 end if;
 if v_officer is not null and exists$s$);
 if r=d then raise exception 'S4 evidence signal source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
