-- Intent receipts block restoration; only an executed receipt authorizes deletion replay.
alter table private.purge_jobs add column executed_ledger_hash text,add column executed_ledger_saved_at timestamptz;
create or replace function private.goos_purge_ledger(p_job uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j private.purge_jobs;v jsonb;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 select * into j from private.purge_jobs where id=p_job;if not found then raise exception 'not_found' using errcode='P0002';end if;
 v:=jsonb_build_object('format',1,'stage',case when j.db_purged_at is null then 'intent' else 'executed' end,'job_id',j.id,'request_id',j.request_id,'subject_id',j.subject_id,'account_id',j.account_id,'policy_id',j.policy_id,'policy_hash',(select content_hash from private.policy_versions where id=j.policy_id),'approved_by',j.approved_by,'officer_id',j.officer_id,'approved_at',j.approved_at,'preview_hash',j.preview_hash,'db_purged_at',j.db_purged_at,'auth_deleted_at',j.auth_deleted_at);
 return jsonb_build_object('ledger',v,'hash',encode(sha256(convert_to(v::text,'UTF8')),'hex'));
end $$;
create or replace function private.goos_purge_ledger_saved(p_job uuid,p_hash text) returns void language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
 v:=private.goos_purge_ledger(p_job);if(v->>'hash') is distinct from p_hash then raise exception 'ledger_changed' using errcode='40001';end if;
 if v->'ledger'->>'stage'='executed' then
  update private.purge_jobs set executed_ledger_hash=p_hash,executed_ledger_saved_at=now() where id=p_job and db_purged_at is not null;
 else update private.purge_jobs set ledger_hash=p_hash,ledger_saved_by=private.goos_uid(),ledger_saved_at=now(),state='approved' where id=p_job and state='awaiting_ledger';if not found then raise exception 'state_conflict' using errcode='40001';end if;end if;
 perform private.goos_audit('privacy.purge.ledger.external_ack',p_job);
end $$;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_subject_write_barrier()'::regprocedure);r:=replace(d,$s$x.status='active' and u.status='active'$s$,$s$u.status<>'deletion_pending' and u.auth_user_id is not null$s$);if r=d then raise exception 'Purge barrier status source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_preview(uuid)'::regprocedure);
 r:=replace(d,$s$private.goos_s4_privacy(p_request,true)$s$,$s$(private.goos_s4_scope('privacy') and exists(select 1 from private.s4_privacy where id=p_request and officer_id=private.goos_uid() and assignment_expires_at>now()) and private.goos_s4_privacy(p_request,true))$s$);if r=d then raise exception 'Purge preview officer source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_hold(uuid,text,timestamp with time zone,uuid)'::regprocedure);
 r:=replace(d,$s$private.goos_s4_privacy(p_request,true)$s$,$s$(private.goos_s4_scope('privacy') and exists(select 1 from private.s4_privacy where id=p_request and officer_id=private.goos_uid() and assignment_expires_at>now()) and private.goos_s4_privacy(p_request,true))$s$);if r=d then raise exception 'Purge hold officer source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_replay(jsonb)'::regprocedure);
 r:=replace(d,$s$l:=x->'ledger';$s$,$s$l:=x->'ledger';if(l->>'stage') is distinct from 'executed' or l->>'db_purged_at' is null then raise exception 'resolve_pending_deletion_intents_before_restore' using errcode='42501';end if;$s$);if r=d then raise exception 'Purge executed receipt source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_auth_done(uuid,uuid)'::regprocedure);
 r:=replace(d,$s$case when exists(select 1 from private.s4_cessations$s$,$s$case when j.executed_ledger_saved_at is null or exists(select 1 from private.s4_cessations$s$);if r=d then raise exception 'Purge durable receipt source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_tick()'::regprocedure);
 r:=replace(d,$s$j.auth_deleted_at is not null and not exists$s$,$s$j.auth_deleted_at is not null and j.executed_ledger_saved_at is not null and not exists$s$);if r=d then raise exception 'Purge receipt tick source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_purge_status(text)'::regprocedure);
 r:=replace(d,$s$'backups','restricted_restore_replay_required'$s$,$s$'restore_ledger',case when j.executed_ledger_saved_at is null then 'pending' else 'stored' end,'provider_logs','vendor_retention_review_required','backups','restricted_restore_replay_required'$s$);if r=d then raise exception 'Purge receipt status source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
