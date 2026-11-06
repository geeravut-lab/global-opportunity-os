-- Complete DB feature gate for SQL RPCs as well as BFF / PLpgSQL RPCs.
DO $$declare f record;d text;body text;begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'goos_s4_%' and p.prolang=(select oid from pg_language where lanname='sql') loop
 d:=pg_get_functiondef(f.oid);body:='begin if not private.goos_s4_enabled() then raise exception ''s4_not_enabled'' using errcode=''42501'';end if; return ('||regexp_replace(f.prosrc,';\s*$','')||');end';
 d:=replace(replace(d,'LANGUAGE sql','LANGUAGE plpgsql'),f.prosrc,body);execute d;
 end loop;
 d:=pg_get_functiondef('private.goos_s4_report(uuid,boolean)'::regprocedure);
 d:=replace(d,$s$and r.accused_id is distinct from private.goos_uid()))$s$,$s$and r.accused_id is distinct from private.goos_uid() and not exists(select 1 from app.org_memberships m where m.organization_id=r.organization_id and m.account_id=private.goos_uid() and m.status='active')))$s$);execute d;
 d:=pg_get_functiondef('public.goos_s4_assign(text,uuid,uuid,timestamp with time zone,integer)'::regprocedure);
 d:=replace(d,$s$elsif p_kind='privacy' then select version into v_version from private.s4_privacy where id=p_id for update;$s$,$s$elsif p_kind='privacy' then select version into v_version from private.s4_privacy where id=p_id and requester_id<>p_account for update;$s$);execute d;
 d:=pg_get_functiondef('public.goos_s4_outcome_action(uuid,text,integer,text)'::regprocedure);
 d:=replace(d,$s$set state='disputed',tier=$s$,$s$set state='disputed',confirmed=false,tier=$s$);execute d;
end $$;
notify pgrst,'reload schema';
