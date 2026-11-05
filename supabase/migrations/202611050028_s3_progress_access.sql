-- queue closure/priority metadata; no package access for routing-only staff
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s3_list(uuid,integer)'::regprocedure);
 r:=replace(d,$s$'timezone',c.timezone,'job_stage'$s$,$s$'timezone',c.timezone,'priority',c.priority,'resolution_code',c.resolution_code,'job_stage'$s$);if r=d then raise exception 'queue metadata mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s3_transition(uuid,text,integer,text,text[])'::regprocedure);
 r:=replace(d,$s$a.job_stage='offer_accepted' then$s$,$s$a.job_stage='offer_accepted' and c.state='in_progress' then$s$);
 r:=replace(r,$s$a.job_stage='started' then$s$,$s$a.job_stage='started' and c.state='resolved' then$s$);if r=d then raise exception 'job consistency mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s3_case(uuid,text,integer,timestamptz,text,text,text)'::regprocedure);
 r:=replace(d,$s$if v_state is null then$s$,$s$if p_action='resolve' and exists(select 1 from app.opportunity_revisions where id=a.revision_id and category='jobs') and a.job_stage<>'started' then raise exception 'job_not_started' using errcode='40001';end if;\n if v_state is null then$s$);r:=replace(r,E'\\n',E'\n');if r=d then raise exception 'case consistency mismatch';end if;execute r;
end $$;
-- ใช้กับ Live sync เฉพาะ active detail page: boolean ไม่มี package/PII/existence oracle
create function public.goos_s3_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select private.goos_s3_progress(p_id) or private.goos_s3_work(p_id);$$;
grant create on schema public to goos_api;
alter function public.goos_s3_access(uuid) owner to goos_api;
revoke create on schema public from goos_api;
revoke all on function public.goos_s3_access(uuid) from public,anon;
grant execute on function public.goos_s3_access(uuid) to authenticated;
notify pgrst,'reload schema';
