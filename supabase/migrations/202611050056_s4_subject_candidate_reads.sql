-- Only owner/delegate subjects can satisfy the unchanged S3 prepare/progress predicates.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s3_subjects()'::regprocedure);
 r:=replace(d,$s$where private.goos_owns_subject(s.id) or private.goos_can_subject(s.id,'application:prepare') or private.goos_can_subject(s.id,'progress:read')$s$,$s$where (s.account_id=private.goos_uid() or s.id in(select subject_id from app.delegations where delegate_account_id=private.goos_uid())) and (private.goos_owns_subject(s.id) or private.goos_can_subject(s.id,'application:prepare') or private.goos_can_subject(s.id,'progress:read'))$s$);
 if r=d then raise exception 'S3 subject candidate source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
