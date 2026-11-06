create trigger purge_event_immutable before update or delete or truncate on private.purge_events for each statement execute function private.goos_audit_immutable();
create table private.purge_replay_log(job_id uuid primary key,ledger_hash text not null,replayed_at timestamptz not null default now());
alter table private.purge_replay_log enable row level security;
revoke all on private.purge_replay_log from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create trigger purge_replay_immutable before update or delete or truncate on private.purge_replay_log for each statement execute function private.goos_audit_immutable();

create function private.goos_purge_receipt(p_request uuid) returns text language plpgsql security definer set search_path='' as $$
declare r private.s4_privacy;v text;begin
 select * into r from private.s4_privacy where id=p_request;
 if not found or r.kind<>'delete' or not private.goos_owns_subject(r.subject_id) then raise exception 'not_found' using errcode='P0002';end if;
 v:=encode(extensions.gen_random_bytes(32),'hex');insert into private.purge_receipts values(r.id,encode(sha256(convert_to(v,'UTF8')),'hex')) on conflict(request_id) do update set receipt_hash=excluded.receipt_hash;
 perform private.goos_audit('privacy.purge.receipt.rotated',r.id);return v;
end $$;
create function private.goos_purge_status(p_receipt text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j private.purge_jobs;r uuid;begin
 if p_receipt is null or p_receipt!~'^[a-f0-9]{64}$' then raise exception 'not_found' using errcode='P0002';end if;
 select request_id into r from private.purge_receipts where receipt_hash=encode(sha256(convert_to(p_receipt,'UTF8')),'hex');if not found then raise exception 'not_found' using errcode='P0002';end if;
 select * into j from private.purge_jobs where request_id=r;
 return jsonb_build_object('state',coalesce(j.state,'request_received'),'live_database',case when j.db_purged_at is null then 'pending' else 'scrubbed' end,'authentication',case when j.auth_deleted_at is null then 'pending' else 'deleted' end,'recipient_cessation',case when j.state='completed_live' then 'acknowledged_or_not_applicable' else 'pending' end,'backups','restricted_restore_replay_required','external_copies','recipient_process_required');
end $$;
create function private.goos_purge_retention_scan() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 select p.definition->'retention' into d from private.policy_current c join private.policy_versions p on p.id=c.policy_id where p.state='published';
 if d is null then return jsonb_build_object('policy_ready',false,'automatic_deletion',false);end if;
 return jsonb_build_object('policy_ready',true,'automatic_deletion',false,'inactive_draft_assessments',(select count(*) from app.assessments where confirmed_at is null and updated_at<now()-make_interval(days=>(d->>'draft_days')::integer)),
 'expired_previews',(select count(*) from private.s3_previews where expires_at<now()-make_interval(days=>(d->>'draft_days')::integer))+(select count(*) from private.s4_previews where expires_at<now()-make_interval(days=>(d->>'draft_days')::integer)),
 'closed_cases_for_review',(select count(*) from app.cases c where c.state='closed' and c.updated_at<now()-make_interval(days=>(d->>'case_days')::integer) and not exists(select 1 from private.retention_holds h where h.subject_id=c.subject_id and h.released_at is null)),
 'overdue_holds_for_review',(select count(*) from private.retention_holds where released_at is null and expires_at<=now()));
end $$;
create function public.goos_purge_receipt(p_request uuid) returns text language sql security definer set search_path='' as $$select private.goos_purge_receipt(p_request);$$;
create function public.goos_purge_status(p_receipt text) returns jsonb language sql security definer set search_path='' as $$select private.goos_purge_status(p_receipt);$$;
create function public.goos_purge_retention_scan() returns jsonb language sql security definer set search_path='' as $$select private.goos_purge_retention_scan();$$;
grant create on schema public to goos_api;
DO $$declare f record;d text;r text;begin
 for f in select p.oid::regprocedure sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.proname in('goos_purge_receipt','goos_purge_status','goos_purge_retention_scan') loop
  execute format('revoke all on function %s from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter',f.sig);
  if f.nspname='public' then execute format('alter function %s owner to goos_api',f.sig);execute format('grant execute on function %s to authenticated',f.sig);if f.proname='goos_purge_status' then execute format('grant execute on function %s to anon',f.sig);end if;
  else execute format('grant execute on function %s to goos_api',f.sig);end if;
 end loop;
 d:=pg_get_functiondef('private.goos_purge_blockers(uuid,uuid)'::regprocedure);
 r:=replace(d,$s$if exists(select 1 from private.platform_role_grants$s$,$s$if exists(select 1 from private.s4_staff_scopes where account_id=a and revoked_at is null and expires_at>now()) or exists(select 1 from app.case_assignments ca join app.org_memberships m on m.id=ca.membership_id where m.account_id=a and ca.ends_at is null) then b:=array_append(b,'REASSIGN_STAFF_WORK');end if;
 if exists(select 1 from private.platform_role_grants$s$);if r=d then raise exception 'Purge staff blocker source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_replay(jsonb)'::regprocedure);
 r:=replace(d,$s$then perform private.goos_purge_scrub$s$,$s$then perform private.goos_purge_scrub$s$);
 r:=replace(r,$s$end if;
 end loop;return n;$s$,$s$end if;
  insert into private.purge_replay_log(job_id,ledger_hash) values((l->>'job_id')::uuid,x->>'hash') on conflict do nothing;
 end loop;return n;$s$);if r=d then raise exception 'Purge replay log source mismatch';end if;execute r;
end $$;
revoke create on schema public from goos_api;
notify pgrst,'reload schema';
