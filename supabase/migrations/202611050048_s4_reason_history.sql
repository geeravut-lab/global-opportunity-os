-- Preserve verification/hold reasons in append-only history, including after holds are released.
alter table private.s4_events add column reason_code text check(reason_code in('authenticated_session_review','assisted_verified','active_investigation','legal_obligation','policy_pending','reviewed_documentary_evidence','beneficiary_confirmed'));
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_privacy_action(uuid,text,integer,text)'::regprocedure);
 r:=replace(d,$s$insert into private.s4_events(kind,resource_id,actor_id,action) values('privacy',p.id,private.goos_uid(),p_action);$s$,$s$insert into private.s4_events(kind,resource_id,actor_id,action,reason_code) values('privacy',p.id,private.goos_uid(),p_action,case when p_action in('verify_identity','hold') then p_reason when p_action='release_hold' then p.hold_code when p_action='approve' and p.kind='delete' then 'policy_pending' end);$s$);if r=d then raise exception 'S4 privacy history source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_outcome_action(uuid,text,integer,text)'::regprocedure);
 r:=replace(d,$s$insert into private.s4_events(kind,resource_id,actor_id,action) values('outcomes',o.id,private.goos_uid(),p_action);$s$,$s$insert into private.s4_events(kind,resource_id,actor_id,action,reason_code) values('outcomes',o.id,private.goos_uid(),p_action,case when p_action='verify' then coalesce(p_alternate,case when o.confirmed then 'beneficiary_confirmed' end) end);$s$);if r=d then raise exception 'S4 review history source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_detail(text,uuid)'::regprocedure);
 r:=replace(d,$s$'action',action,'created_at',created_at$s$,$s$'action',action,'reason_code',reason_code,'created_at',created_at$s$);if r=d then raise exception 'S4 event projection source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
