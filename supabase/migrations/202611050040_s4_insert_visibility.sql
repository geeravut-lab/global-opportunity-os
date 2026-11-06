-- Decide INSERT RETURNING authorization from the new row, not a same-statement STABLE lookup.
alter policy s4_api on private.s4_referrals using(private.goos_owns_subject(subject_id) or private.goos_s4_source(source_case_id) or private.goos_s4_referral(id));
notify pgrst,'reload schema';
