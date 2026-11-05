-- UI DTOs expose routing metadata separately from consented package data
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s3_list(uuid,integer)'::regprocedure);
 r:=replace(d,$s$'job_stage',a.job_stage,'title_th'$s$,$s$'job_stage',a.job_stage,'category',r.category,'assigned_member_id',(select membership_id from app.case_assignments where case_id=c.id and ends_at is null),'title_th'$s$);
 if r=d then raise exception 'list DTO source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s3_detail(uuid)'::regprocedure);
 r:=replace(d,$s$return jsonb_build_object('id',a.id,$s$,$s$return jsonb_build_object('id',a.id,'subject_id',case when private.goos_can_subject(a.subject_id,'application:submit') then a.subject_id end,$s$);
 r:=replace(r,$s$'notes',(select$s$,$s$'case_events',(select coalesce(jsonb_agg(jsonb_build_object('action',action,'reason_code',reason_code,'created_at',created_at) order by created_at),'[]') from app.case_events where case_id=c.id and(reason_code<>'internal_note' or private.goos_s3_work(a.id))),'notes',(select$s$);
 if r=d then raise exception 'detail DTO source mismatch';end if;execute r;
end $$;
create table private.outbox_retries(id uuid primary key default gen_random_uuid(),job_id uuid not null references private.outbox(id),actor_id uuid not null references app.accounts(id),reason_code text not null check(reason_code in('transport_restored','scope_corrected')),created_at timestamptz not null default now());
alter table private.outbox_retries enable row level security;
revoke all on private.outbox_retries from public,anon,authenticated,goos_api,goos_authz,goos_worker;
create trigger s3_retry_immutable before update or delete or truncate on private.outbox_retries for each statement execute function private.goos_audit_immutable();
create function private.goos_s3_retry_job(p_id uuid,p_attempts integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare j private.outbox;begin
 select * into j from private.outbox where id=p_id for update;
 if not found or not(private.goos_platform_admin() or private.goos_s3_supervisor(j.organization_id)) then raise exception 'not_found' using errcode='P0002';end if;
 if j.status<>'dead' or j.attempts is distinct from p_attempts then raise exception 'state_conflict' using errcode='40001';end if;
 if p_reason is null or p_reason not in('transport_restored','scope_corrected') then raise exception 'invalid_reason' using errcode='22023';end if;
 if(select count(*) from private.outbox_retries where job_id=j.id and created_at>now()-interval '1 day')>=3 then raise exception 'retry_limit' using errcode='22023';end if;
 insert into private.outbox_retries(job_id,actor_id,reason_code) values(j.id,private.goos_uid(),p_reason);
 update private.outbox set status='pending',attempts=0,available_at=now(),lease_id=null,lease_until=null,last_error_code=null where id=j.id;
 perform private.goos_audit('outbox.retry',j.id,j.organization_id);
end $$;
revoke all on function private.goos_s3_retry_job(uuid,integer,text) from public,anon,authenticated,goos_authz,goos_worker;
grant execute on function private.goos_s3_retry_job(uuid,integer,text) to goos_api;
create function public.goos_s3_retry(p_id uuid,p_attempts integer,p_reason text) returns void language sql security definer set search_path='' as $$select private.goos_s3_retry_job(p_id,p_attempts,p_reason);$$;
grant create on schema public to goos_api;
alter function public.goos_s3_retry(uuid,integer,text) owner to goos_api;
revoke create on schema public from goos_api;
revoke all on function public.goos_s3_retry(uuid,integer,text) from public,anon;
grant execute on function public.goos_s3_retry(uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
