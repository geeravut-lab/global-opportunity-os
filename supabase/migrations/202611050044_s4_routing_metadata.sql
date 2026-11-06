DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s4_card(text,uuid)'::regprocedure);
 r:=replace(d,$s$return v||jsonb_build_object('id',p_id$s$,$s$if p_kind='referrals' then v:=v||coalesce((select jsonb_build_object('case_id',id,'case_version',version,'can_assign_case',private.goos_s3_routing(organization_id)) from private.s4_cases where referral_id=p_id),'{}');end if;
 return v||jsonb_build_object('id',p_id$s$);if r=d then raise exception 'S4 routing card source mismatch';end if;
 r:=replace(r,$s$and private.goos_s4_scope('impact') and o.reporter_id<>$s$,$s$and private.goos_s4_scope('impact') and private.goos_s4_case_active(o.source_case_id,o.referral_case_id) and private.goos_s4_independent(private.goos_uid(),o.subject_id,o.organization_id) and o.reporter_id<>$s$);execute r;
end $$;
notify pgrst,'reload schema';
