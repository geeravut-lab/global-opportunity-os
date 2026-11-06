-- Preserve who reported an outcome when verification is removed; L0 never becomes provider-reported L1.
create function private.goos_s4_reported_tier(p_subject uuid,p_reporter uuid) returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.subjects where id=p_subject and account_id=p_reporter) then 'L0' else 'L1' end;
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_reported_tier(uuid,uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_reported_tier(uuid,uuid) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_reported_tier(uuid,uuid) to goos_api;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_outcome_action(uuid,text,integer,text)'::regprocedure);
 r:=replace(d,$s$case when private.goos_owns_subject(o.subject_id) and o.reporter_id=private.goos_uid() then 'L0' else 'L1' end$s$,$s$private.goos_s4_reported_tier(o.subject_id,o.reporter_id)$s$);
 r:=replace(r,$s$tier=case p_action when 'verify' then 'L2' else 'L1' end$s$,$s$tier=case p_action when 'verify' then 'L2' else private.goos_s4_reported_tier(o.subject_id,o.reporter_id) end$s$);if r=d then raise exception 'S4 reported tier source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_outcome_create(uuid,text,date,date,timestamp with time zone,text,uuid)'::regprocedure);
 r:=replace(d,$s$case when reporter_id=(select account_id from app.subjects where id=subject_id) then 'L0' else 'L1' end$s$,$s$private.goos_s4_reported_tier(subject_id,reporter_id)$s$);if r=d then raise exception 'S4 correction tier source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
