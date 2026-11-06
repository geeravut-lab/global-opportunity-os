-- Every content writer takes a subject lock and rechecks after waiting for a purge.
create function private.goos_subject_write_barrier() returns trigger language plpgsql security definer set search_path='' as $$
declare s uuid;a uuid;ok boolean;begin
 if exists(select 1 from private.purge_execution_context where backend_pid=pg_backend_pid() and transaction_id=txid_current()) then return new;end if;
 if tg_table_schema='app' and tg_table_name='accounts' then
  if new.display_name is not distinct from old.display_name and new.locale is not distinct from old.locale then return new;end if;
  select id into s from app.subjects where account_id=new.id;
 elsif tg_table_schema='app' and tg_table_name='subjects' then s:=new.id;
 elsif tg_table_name in('assessments','bookmarks','applications','cases','resource_shares','s3_previews','s4_outcomes','s4_privacy','s4_referrals') then s:=new.subject_id;
 elsif tg_table_name in('application_packages','application_responses') then select subject_id into s from app.applications where id=new.application_id;
 elsif tg_table_name='case_notes' then select subject_id into s from app.cases where id=new.case_id;
 elsif tg_table_name in('s4_packages','s4_previews') then select subject_id into s from private.s4_referrals where id=new.referral_id;
 elsif tg_table_name='s4_notes' then select subject_id into s from private.s4_cases where id=new.case_id;
 elsif tg_table_name='s4_evidence' then select subject_id into s from private.s4_outcomes where id=new.outcome_id;
 elsif tg_table_name='s4_reports' then select id into s from app.subjects where account_id=new.reporter_id;
 elsif tg_table_name in('notifications','notification_preferences','outbox') then select id into s from app.subjects where account_id=new.account_id;
 end if;
 if s is null then return new;end if;
 select account_id into a from app.subjects where id=s for key share;
 if a is null then return new;end if;
 select x.status='active' and u.status='active' into ok from app.subjects x join app.accounts u on u.id=x.account_id where x.id=s;
 if not coalesce(ok,false) then raise exception 'subject_not_writable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.goos_subject_write_barrier() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
DO $$declare t text;begin foreach t in array array['app.subjects','app.assessments','app.bookmarks','app.applications','app.cases','app.resource_shares','app.notifications','app.notification_preferences','private.outbox','private.s3_previews','private.application_packages','private.application_responses','private.case_notes','private.s4_referrals','private.s4_previews','private.s4_packages','private.s4_notes','private.s4_outcomes','private.s4_evidence','private.s4_privacy','private.s4_reports'] loop
 execute format('create trigger subject_write_barrier before insert or update on %s for each row execute function private.goos_subject_write_barrier()',t);
end loop;end $$;
create trigger account_profile_write_barrier before update of display_name,locale on app.accounts for each row execute function private.goos_subject_write_barrier();

create function private.goos_purge_revision(p_subject uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce(string_agg(m,',' order by m),'')) from(
 select 'a:'||id::text||':'||version::text m from app.applications where subject_id=p_subject
 union all select 'r:'||id::text||':'||version::text from private.s4_referrals where subject_id=p_subject
 union all select 'o:'||id::text||':'||version::text from private.s4_outcomes where subject_id=p_subject
 union all select 'e:'||e.id::text||':'||e.status||':'||coalesce(e.processed_at::text,'') from private.s4_evidence e join private.s4_outcomes o on o.id=e.outcome_id where o.subject_id=p_subject
 union all select 'p:'||id::text||':'||version::text from private.s4_privacy where subject_id=p_subject
 union all select 's:'||id::text||':'||status from app.resource_shares where subject_id=p_subject
 union all select 'n:'||n.id::text from private.case_notes n join app.cases c on c.id=n.case_id where c.subject_id=p_subject
 union all select 'd:'||n.id::text from private.s4_notes n join private.s4_cases c on c.id=n.case_id where c.subject_id=p_subject
 union all select 'b:'||opportunity_id::text from app.bookmarks where subject_id=p_subject
 ) records;
$$;
revoke all on function private.goos_purge_revision(uuid) from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create function private.goos_policy_scope(p_account uuid,p_scope text,p_grant boolean,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() or p_account=private.goos_uid() or not private.goos_recipient_active(p_account) then raise exception 'not_found' using errcode='P0002';end if;
 if p_scope is null or p_scope not in('impact','privacy','safety') or p_grant is null or p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days' then raise exception 'invalid_input' using errcode='22023';end if;
 update private.s4_staff_scopes set revoked_at=now() where account_id=p_account and scope=p_scope and revoked_at is null;
 if p_grant then insert into private.s4_staff_scopes(account_id,scope,granted_by,expires_at) values(p_account,p_scope,private.goos_uid(),p_expires);
 else update private.s4_staff_scopes set revoked_at=now() where account_id=p_account and scope=p_scope and revoked_at is null;end if;
 perform private.goos_audit('policy.staff.scope.changed',p_account);
end $$;
create function public.goos_policy_scope(p_account uuid,p_scope text,p_grant boolean,p_expires timestamptz) returns void language sql security definer set search_path='' as $$select private.goos_policy_scope(p_account,p_scope,p_grant,p_expires);$$;
grant create on schema public to goos_api;
alter function public.goos_policy_scope(uuid,text,boolean,timestamptz) owner to goos_api;
revoke create on schema public from goos_api;
revoke all on function private.goos_policy_scope(uuid,text,boolean,timestamptz),public.goos_policy_scope(uuid,text,boolean,timestamptz) from public,anon,authenticated,goos_authz,goos_worker,goos_reporter;
grant execute on function private.goos_policy_scope(uuid,text,boolean,timestamptz) to goos_api;
grant execute on function public.goos_policy_scope(uuid,text,boolean,timestamptz) to authenticated;
create function private.goos_purge_tick() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;begin
 with updated as(update private.purge_jobs j set state='completed_live' where j.state='awaiting_recipients' and j.auth_deleted_at is not null and not exists(select 1 from private.s4_cessations c where c.subject_id=j.subject_id and c.status<>'acknowledged') returning id)
 insert into private.purge_events(job_id,action) select id,'recipients.acknowledged' from updated;get diagnostics n=row_count;return n;
end $$;
revoke all on function private.goos_purge_tick() from public,anon,authenticated,goos_api,goos_authz,goos_reporter;
grant execute on function private.goos_purge_tick() to goos_worker;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_policy_valid(jsonb,boolean)'::regprocedure);r:=replace(d,'where x!~','where x is null or x!~');if r=d then raise exception 'Policy country validation source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_snapshot(uuid)'::regprocedure);r:=replace(d,$s$'inventory',private.goos_purge_inventory(s.id)$s$,$s$'inventory',private.goos_purge_inventory(s.id),'inventory_revision',private.goos_purge_revision(s.id)$s$);if r=d then raise exception 'Purge revision source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_claim()'::regprocedure);
 r:=replace(d,$s$if cardinality(b)>0 then$s$,$s$if(private.goos_purge_snapshot(j.request_id)->>'hash') is distinct from j.preview_hash then b:=array_append(b,'PREVIEW_CHANGED');end if;if cardinality(b)>0 then$s$);if r=d then raise exception 'Purge claim revision source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_execute(uuid,uuid)'::regprocedure);
 r:=replace(d,$s$b:=private.goos_purge_blockers$s$,$s$perform 1 from app.subjects where id=j.subject_id for update;b:=private.goos_purge_blockers$s$);
 r:=replace(r,$s$if cardinality(b)>0 then$s$,$s$if(private.goos_purge_snapshot(j.request_id)->>'hash') is distinct from j.preview_hash then b:=array_append(b,'PREVIEW_CHANGED');end if;if cardinality(b)>0 then$s$);if r=d then raise exception 'Purge execute revision source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_approve(uuid,text)'::regprocedure);
 r:=replace(d,$s$values(r.id,r.subject_id,a,(v->>'policy_id')::uuid,p_hash,r.officer_id,private.goos_uid()) returning id into j;$s$,$s$values(r.id,r.subject_id,a,(v->>'policy_id')::uuid,p_hash,r.officer_id,private.goos_uid()) on conflict(request_id) do update set subject_id=excluded.subject_id,account_id=excluded.account_id,policy_id=excluded.policy_id,preview_hash=excluded.preview_hash,officer_id=excluded.officer_id,approved_by=excluded.approved_by,approved_at=now(),state='awaiting_ledger',ledger_hash=null,ledger_saved_by=null,ledger_saved_at=null,lease_id=null,lease_until=null,last_error_code=null where private.purge_jobs.state in('blocked','cancelled') and private.purge_jobs.db_purged_at is null returning id into j;
 if j is null then raise exception 'state_conflict' using errcode='40001';end if;$s$);if r=d then raise exception 'Purge reapproval source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
