-- Narrow existence check for assignee MFA; never grant raw auth tables to API/authz roles.
alter function private.goos_s4_assignee(uuid,text) owner to postgres;
create function private.goos_s4_person_valid(p_subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.subjects s join app.accounts u on u.id=s.account_id where s.id=p_subject and s.status='active' and s.age_band='adult' and u.status='active');
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_person_valid(uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_person_valid(uuid) from public,anon,authenticated,goos_worker;
grant execute on function private.goos_s4_person_valid(uuid) to goos_api;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_propose(uuid,uuid,text)'::regprocedure);
 r:=replace(d,$s$exists(select 1 from app.subjects s join app.accounts u on u.id=s.account_id where s.id=c.subject_id and s.status='active' and s.age_band='adult' and u.status='active')$s$,$s$private.goos_s4_person_valid(c.subject_id)$s$);if r=d then raise exception 'S4 source predicate mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_referral_action(uuid,text,integer,uuid)'::regprocedure);
 r:=replace(d,$s$if p_action='accept' and r.state='accepted' and private.goos_s3_routing(r.recipient_org_id) then$s$,$s$if p_action='accept' and r.state='accepted' and private.goos_s3_routing(r.recipient_org_id) and private.goos_s4_valid(r.id) then$s$);if r=d then raise exception 'S4 accept replay predicate mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
