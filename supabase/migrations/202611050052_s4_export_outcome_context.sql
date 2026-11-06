-- Include beneficiary-visible outcome narratives and inspection metadata in an approved owner's export.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_export(uuid)'::regprocedure);
 r:=replace(d,$s$'version',version)),'[]') from private.s4_outcomes where subject_id=p.subject_id)$s$,$s$'version',version,'body',private.goos_s3_decrypt(encrypted_body)->>'body','occurred_at',occurred_at,'period_start',period_start,'period_end',period_end,'organization_id',organization_id,'reporter_kind',case when reporter_id=private.goos_uid() then 'self' else 'provider' end,'evidence',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'hash',e.content_hash)),'[]') from private.s4_evidence e where e.outcome_id=o.id))),'[]') from private.s4_outcomes o where subject_id=p.subject_id)$s$);
 if r=d then raise exception 'S4 export outcome context source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
