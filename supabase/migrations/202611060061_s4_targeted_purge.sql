-- Targeted, reviewed deletion. No job is created or enabled by this migration.
alter table app.accounts add column auth_user_id uuid unique references auth.users(id) on delete set null;
update app.accounts set auth_user_id=id;
alter table app.accounts drop constraint accounts_id_fkey;
create function private.goos_account_auth_link() returns trigger language plpgsql security definer set search_path='' as $$
begin new.auth_user_id:=new.id;return new;end $$;
revoke all on function private.goos_account_auth_link() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create trigger account_auth_link before insert on app.accounts for each row execute function private.goos_account_auth_link();

create table private.retention_holds(id uuid primary key default gen_random_uuid(),subject_id uuid not null references app.subjects(id),reason_code text not null check(reason_code in('active_investigation','legal_obligation')),authorized_by uuid not null references app.accounts(id),expires_at timestamptz not null,created_at timestamptz not null default now(),released_at timestamptz,released_by uuid references app.accounts(id));
create table private.purge_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into private.purge_settings values(true,false);
create table private.purge_jobs(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique references private.s4_privacy(id),subject_id uuid not null references app.subjects(id),account_id uuid not null references app.accounts(id),policy_id uuid not null references private.policy_versions(id),
 preview_hash text not null,officer_id uuid not null references app.accounts(id),approved_by uuid not null references app.accounts(id),approved_at timestamptz not null default now(),
 state text not null default 'awaiting_ledger' check(state in('awaiting_ledger','approved','db_purged','awaiting_recipients','completed_live','blocked','cancelled')),
 ledger_hash text,ledger_saved_by uuid references app.accounts(id),ledger_saved_at timestamptz,lease_id uuid,lease_until timestamptz,
 db_purged_at timestamptz,auth_deleted_at timestamptz,counts jsonb not null default '{}',last_error_code text,
 check(officer_id<>approved_by),check(account_id<>approved_by and account_id<>officer_id)
);
create table private.purge_receipts(request_id uuid primary key references private.s4_privacy(id),receipt_hash text not null unique);
create table private.purge_tombstones(job_id uuid primary key references private.purge_jobs(id),subject_id uuid not null references app.subjects(id),account_id uuid not null references app.accounts(id),policy_hash text not null,created_at timestamptz not null default now());
create table private.purge_events(id uuid primary key default gen_random_uuid(),job_id uuid not null references private.purge_jobs(id),action text not null,created_at timestamptz not null default now());
create table private.purge_execution_context(backend_pid integer primary key,transaction_id bigint not null,job_id uuid);
create index purge_claim on private.purge_jobs(state,approved_at);
create index retention_hold_subject on private.retention_holds(subject_id) where released_at is null;
DO $$declare t text;begin foreach t in array array['retention_holds','purge_settings','purge_jobs','purge_receipts','purge_tombstones','purge_execution_context','purge_events'] loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter',t);
end loop;end $$;
create trigger purge_tombstone_immutable before update or delete or truncate on private.purge_tombstones for each statement execute function private.goos_audit_immutable();

-- Only approved job execution can scrub immutable content; audit/consent/events are never included.
create function private.goos_content_immutable() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and exists(select 1 from private.purge_execution_context where backend_pid=pg_backend_pid() and transaction_id=txid_current()) then return null;end if;
 raise exception 'immutable_content' using errcode='42501';
end $$;
revoke all on function private.goos_content_immutable() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
DO $$declare t text;g record;begin foreach t in array array['application_packages','application_responses','case_notes','s4_packages','s4_notes'] loop
 for g in select tgname from pg_trigger where tgrelid=('private.'||t)::regclass and tgfoid='private.goos_audit_immutable()'::regprocedure loop execute format('drop trigger %I on private.%I',g.tgname,t);execute format('create trigger %I before update or delete or truncate on private.%I for each statement execute function private.goos_content_immutable()',g.tgname,t);end loop;
end loop;end $$;
create function private.goos_policy_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if old.state<>'draft' and(new.definition is distinct from old.definition or new.content_hash is distinct from old.content_hash or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at or new.published_by is distinct from old.published_by or new.published_at is distinct from old.published_at or new.state not in('published','retired') or old.state='retired') then raise exception 'immutable_policy' using errcode='42501';end if;return new;
end $$;
revoke all on function private.goos_policy_immutable() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create trigger policy_immutable before update on private.policy_versions for each row execute function private.goos_policy_immutable();
create trigger policy_no_delete before delete or truncate on private.policy_versions for each statement execute function private.goos_audit_immutable();

create function private.goos_purge_blockers(p_request uuid,p_policy uuid) returns text[] language plpgsql stable security definer set search_path='' as $$
declare r private.s4_privacy;s app.subjects;p private.policy_versions;a uuid;b text[]:='{}';begin
 select * into r from private.s4_privacy where id=p_request;select * into s from app.subjects where id=r.subject_id;a:=s.account_id;select * into p from private.policy_versions where id=p_policy;
 if r.id is null or r.kind<>'delete' or r.identity_verified_at is null or r.officer_id is null or r.state not in('in_review','approved','awaiting_policy') then b:=array_append(b,'REQUEST_REVIEW_REQUIRED');end if;
 if r.assignment_expires_at is null or r.assignment_expires_at<=now() or not exists(select 1 from private.s4_staff_scopes g join app.accounts x on x.id=g.account_id where g.account_id=r.officer_id and x.status='active' and g.scope='privacy' and g.revoked_at is null and g.expires_at>now() and exists(select 1 from auth.mfa_factors f where f.user_id=x.id and f.status='verified')) then b:=array_append(b,'OFFICER_REVIEW_REQUIRED');end if;
 if p.state is distinct from 'published' or not private.goos_policy_valid(p.definition,true) or not exists(select 1 from private.policy_current where policy_id=p.id) or not(s.country_code in(select jsonb_array_elements_text(p.definition->'country_codes'))) then b:=array_append(b,'POLICY_REVIEW_REQUIRED');end if;
 if r.hold_code is not null or exists(select 1 from private.s4_privacy x where x.subject_id=s.id and x.hold_code is not null) or exists(select 1 from private.retention_holds h where h.subject_id=s.id and h.released_at is null) then b:=array_append(b,'ACTIVE_HOLD');end if;
 if exists(select 1 from private.platform_role_grants where account_id=a and revoked_at is null) then b:=array_append(b,'TRANSFER_PLATFORM_ROLE');end if;
 if exists(select 1 from app.org_memberships m join app.org_member_roles mr on mr.membership_id=m.id where m.account_id=a and m.status='active' and mr.role_code='owner') then b:=array_append(b,'TRANSFER_ORGANIZATION_OWNER');end if;
 if exists(select 1 from private.s4_reports x where x.accused_id=a or x.reporter_id=a and x.kind='safety' and x.state in('submitted','in_review')) then b:=array_append(b,'SAFETY_OR_THIRD_PARTY_REVIEW');end if;
 if exists(select 1 from private.case_notes n join app.cases c on c.id=n.case_id where n.author_id=a and c.subject_id<>s.id) or exists(select 1 from private.s4_notes n join private.s4_cases c on c.id=n.case_id where n.author_id=a and c.subject_id<>s.id) then b:=array_append(b,'STAFF_RECORD_REVIEW');end if;
 if exists(select 1 from app.organizations o join private.org_evidence e on e.organization_id=o.id where o.created_by=a and(e.original_body is not null or e.safe_body is not null)) then b:=array_append(b,'ORGANIZATION_DOCUMENT_REVIEW');end if;
 return b;
end $$;
create function private.goos_purge_inventory(p_subject uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'profile',(select count(*) from app.subjects where id=p_subject),'assessment',(select count(*) from app.assessments where subject_id=p_subject),
 'application_packages',(select count(*) from private.application_packages k join app.applications a on a.id=k.application_id where a.subject_id=p_subject),
 'responses',(select count(*) from private.application_responses k join app.applications a on a.id=k.application_id where a.subject_id=p_subject),
 'source_notes',(select count(*) from private.case_notes n join app.cases c on c.id=n.case_id where c.subject_id=p_subject),
 'referral_packages',(select count(*) from private.s4_packages k join private.s4_referrals r on r.id=k.referral_id where r.subject_id=p_subject),
 'destination_notes',(select count(*) from private.s4_notes n join private.s4_cases c on c.id=n.case_id where c.subject_id=p_subject),
 'outcomes',(select count(*) from private.s4_outcomes where subject_id=p_subject),
 'evidence',(select count(*) from private.s4_evidence e join private.s4_outcomes o on o.id=e.outcome_id where o.subject_id=p_subject),
 'previews',(select count(*) from private.s3_previews where subject_id=p_subject)+(select count(*) from private.s4_previews v join private.s4_referrals r on r.id=v.referral_id where r.subject_id=p_subject));
$$;
create function private.goos_purge_snapshot(p_request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r private.s4_privacy;s app.subjects;p private.policy_versions;v jsonb;begin
 select * into r from private.s4_privacy where id=p_request;select * into s from app.subjects where id=r.subject_id;select x.* into p from private.policy_current c join private.policy_versions x on x.id=c.policy_id;
 v:=jsonb_build_object('request_id',r.id,'request_version',r.version,'subject_id',s.id,'profile_version',s.version,'policy_id',p.id,'policy_hash',p.content_hash,'officer_id',r.officer_id,'blockers',to_jsonb(private.goos_purge_blockers(p_request,p.id)),'inventory',private.goos_purge_inventory(s.id));
 return v||jsonb_build_object('hash',encode(sha256(convert_to(v::text,'UTF8')),'hex'));
end $$;
create function private.goos_purge_preview(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not(private.goos_platform_admin() or private.goos_s4_privacy(p_request,true)) then raise exception 'not_found' using errcode='P0002';end if;
 perform private.goos_audit('privacy.purge.previewed',p_request);return private.goos_purge_snapshot(p_request);
end $$;
create function private.goos_purge_approve(p_request uuid,p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare v jsonb;r private.s4_privacy;a uuid;j uuid;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 select * into r from private.s4_privacy where id=p_request for update;select account_id into a from app.subjects where id=r.subject_id;
 perform pg_advisory_xact_lock(hashtextextended('purge:'||r.subject_id::text,0));v:=private.goos_purge_snapshot(p_request);
 if r.id is null or a=private.goos_uid() or r.officer_id=private.goos_uid() or r.requester_id=private.goos_uid() then raise exception 'independent_approval_required' using errcode='42501';end if;
 if(v->>'hash') is distinct from p_hash or jsonb_array_length(v->'blockers')<>0 then raise exception 'purge_snapshot_changed_or_blocked' using errcode='40001';end if;
 insert into private.purge_jobs(request_id,subject_id,account_id,policy_id,preview_hash,officer_id,approved_by) values(r.id,r.subject_id,a,(v->>'policy_id')::uuid,p_hash,r.officer_id,private.goos_uid()) returning id into j;
 perform private.goos_audit('privacy.purge.approved',j);return j;
end $$;
create function private.goos_purge_ledger(p_job uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j private.purge_jobs;v jsonb;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 select * into j from private.purge_jobs where id=p_job;if not found then raise exception 'not_found' using errcode='P0002';end if;
 v:=jsonb_build_object('format',1,'job_id',j.id,'request_id',j.request_id,'subject_id',j.subject_id,'account_id',j.account_id,'policy_id',j.policy_id,'policy_hash',(select content_hash from private.policy_versions where id=j.policy_id),'approved_by',j.approved_by,'officer_id',j.officer_id,'approved_at',j.approved_at,'preview_hash',j.preview_hash);
 return jsonb_build_object('ledger',v,'hash',encode(sha256(convert_to(v::text,'UTF8')),'hex'));
end $$;
create function private.goos_purge_ledger_saved(p_job uuid,p_hash text) returns void language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
 v:=private.goos_purge_ledger(p_job);if v->>'hash' is distinct from p_hash then raise exception 'ledger_changed' using errcode='40001';end if;
 update private.purge_jobs set ledger_hash=p_hash,ledger_saved_by=private.goos_uid(),ledger_saved_at=now(),state='approved' where id=p_job and state='awaiting_ledger';if not found then raise exception 'state_conflict' using errcode='40001';end if;
 perform private.goos_audit('privacy.purge.ledger.external_ack',p_job);
end $$;
create function private.goos_purge_hold(p_request uuid,p_reason text,p_expires timestamptz,p_release uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare s uuid;begin
 if not(private.goos_platform_admin() or private.goos_s4_privacy(p_request,true)) then raise exception 'not_found' using errcode='P0002';end if;
 select subject_id into s from private.s4_privacy where id=p_request;perform pg_advisory_xact_lock(hashtextextended('purge:'||s::text,0));
 if exists(select 1 from private.purge_jobs where subject_id=s and db_purged_at is not null) then raise exception 'purge_already_executed' using errcode='40001';end if;
 if p_release is not null then update private.retention_holds set released_at=now(),released_by=private.goos_uid() where id=p_release and subject_id=s and released_at is null;if not found then raise exception 'not_found' using errcode='P0002';end if;
 else if p_reason is null or p_reason not in('active_investigation','legal_obligation') or p_expires is null or p_expires<=now() or p_expires>now()+interval '365 days' then raise exception 'invalid_input' using errcode='22023';end if;
 insert into private.retention_holds(subject_id,reason_code,authorized_by,expires_at) values(s,p_reason,private.goos_uid(),p_expires);end if;
 perform private.goos_audit('privacy.hold.changed',p_request);
end $$;
create function private.goos_purge_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 return jsonb_build_object('enabled',(select enabled from private.purge_settings where singleton),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'version',version,'identity_verified',identity_verified_at is not null,'officer_id',officer_id,'hold',hold_code) order by created_at desc),'[]') from(select * from private.s4_privacy where kind='delete' order by created_at desc limit 100)x),
 'jobs',(select coalesce(jsonb_agg(to_jsonb(j)-'lease_id' order by approved_at desc),'[]') from(select * from private.purge_jobs order by approved_at desc limit 100)j),
 'holds',(select coalesce(jsonb_agg(to_jsonb(h) order by created_at desc),'[]') from(select * from private.retention_holds where released_at is null order by created_at desc limit 100)h));
end $$;
create function private.goos_purge_enable(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 if p_enabled is null or(p_enabled and(not private.goos_policy_ready() or not private.goos_policy_roster_ready())) then raise exception 'policy_roster_not_ready' using errcode='22023';end if;
 update private.purge_settings set enabled=p_enabled where singleton;perform private.goos_audit('privacy.purge.worker.configuration',null);
end $$;

-- Root-only scrub primitive. Trusted restore replay also invokes this before traffic resumes.
create function private.goos_purge_scrub(p_subject uuid,p_account uuid,p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;b bytea;h text;begin
 if not exists(select 1 from app.subjects where id=p_subject and account_id=p_account) then raise exception 'subject_account_mismatch' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('purge:'||p_subject::text,0));v:=private.goos_purge_inventory(p_subject);
 insert into private.purge_execution_context values(pg_backend_pid(),txid_current(),p_job);
 b:=private.goos_s3_encrypt('{}'::jsonb);h:=encode(sha256(convert_to('{}','UTF8')),'hex');
 insert into private.revoked_sessions(session_id,account_id) select id,p_account from auth.sessions where user_id=p_account on conflict do nothing;
 update app.accounts set status='deletion_pending',display_name='Deleted user' where id=p_account;
 update app.delegations set status='revoked',revoked_at=now(),version=version+1 where(subject_id=p_subject or delegate_account_id=p_account or granted_by=p_account) and status='active';
 update app.org_memberships set status='revoked',version=version+1 where account_id=p_account and status='active';
 update app.org_invitations set status='cancelled' where recipient_account_id=p_account and status='pending';
 update app.resource_shares set status='revoked',revoked_at=now() where subject_id=p_subject and status='active';
 update private.s4_referrals set share_active=false,state=case when state in('proposed','pending') then 'cancelled' else state end,version=version+1 where subject_id=p_subject and(share_active or state in('proposed','pending'));
 insert into private.s4_cessations(subject_id,resource_kind,resource_id,recipient_org_id) select p_subject,'application',id,organization_id from app.applications where subject_id=p_subject on conflict do nothing;
 insert into private.s4_cessations(subject_id,resource_kind,resource_id,recipient_org_id) select p_subject,'referral',id,recipient_org_id from private.s4_referrals where subject_id=p_subject on conflict do nothing;
 update private.outbox set status='cancelled',lease_id=null,lease_until=null where account_id=p_account and status in('pending','inflight');
 delete from app.notifications where account_id=p_account;delete from app.notification_preferences where account_id=p_account;
 delete from app.bookmarks where subject_id=p_subject;delete from app.assessments where subject_id=p_subject;
 update private.application_packages set encrypted_payload=b,content_hash=h where application_id in(select id from app.applications where subject_id=p_subject);
 update private.application_responses set encrypted_payload=b,content_hash=h where application_id in(select id from app.applications where subject_id=p_subject);
 update private.case_notes set encrypted_body=b where case_id in(select id from app.cases where subject_id=p_subject);
 update private.s3_previews set encrypted_payload=b,content_hash=h,expires_at=least(expires_at,now()) where subject_id=p_subject;
 update private.s4_packages set encrypted_payload=b,content_hash=h where referral_id in(select id from private.s4_referrals where subject_id=p_subject);
 update private.s4_previews set encrypted_payload=b,content_hash=h,expires_at=least(expires_at,now()) where referral_id in(select id from private.s4_referrals where subject_id=p_subject);
 update private.s4_notes set encrypted_body=b where case_id in(select id from private.s4_cases where subject_id=p_subject);
 update private.s4_outcomes set encrypted_body=b,state=case when state='superseded' then 'superseded' else 'disputed' end,tier=case when reporter_id=p_account then 'L0' else 'L1' end,confirmed=false,version=version+1 where subject_id=p_subject;
 update private.s4_evidence set original_body=null,safe_body=null,content_hash=null,status='rejected',inspection='purged-approved-request',processed_at=now() where outcome_id in(select id from private.s4_outcomes where subject_id=p_subject);
 update private.s4_privacy set encrypted_body=b,version=version+1 where subject_id=p_subject;
 update private.s4_reports set encrypted_body=b,version=version+1 where reporter_id=p_account;
 update app.subjects set display_alias='Deleted user',country_code='ZZ',coarse_region='',safe_contact='none',status='suspended',version=version+1,updated_at=now() where id=p_subject;
 delete from private.purge_execution_context where backend_pid=pg_backend_pid();return v;
end $$;
create function private.goos_purge_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.purge_jobs;b text[];begin
 if not(select enabled from private.purge_settings where singleton) then return null;end if;
 select * into j from private.purge_jobs where state in('approved','db_purged') and ledger_saved_at is not null and(lease_until is null or lease_until<now()) order by approved_at for update skip locked limit 1;if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('purge:'||j.subject_id::text,0));
 if j.db_purged_at is null then b:=private.goos_purge_blockers(j.request_id,j.policy_id);if cardinality(b)>0 then update private.purge_jobs set state='blocked',last_error_code=b[1] where id=j.id;return null;end if;end if;
 update private.purge_jobs set lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes' where id=j.id returning * into j;
 return jsonb_build_object('job_id',j.id,'account_id',j.account_id,'lease_id',j.lease_id,'db_purged',j.db_purged_at is not null);
end $$;
create function private.goos_purge_execute(p_job uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.purge_jobs;b text[];c jsonb;begin
 select * into j from private.purge_jobs where id=p_job and lease_id=p_lease and lease_until>now() for update;if not found or j.state not in('approved','db_purged') then raise exception 'not_found' using errcode='P0002';end if;
 if j.db_purged_at is not null then return j.counts;end if;
 perform pg_advisory_xact_lock(hashtextextended('purge:'||j.subject_id::text,0));b:=private.goos_purge_blockers(j.request_id,j.policy_id);
 if cardinality(b)>0 then update private.purge_jobs set state='blocked',last_error_code=b[1],lease_id=null,lease_until=null where id=j.id;return null;end if;
 c:=private.goos_purge_scrub(j.subject_id,j.account_id,j.id);
 insert into private.purge_tombstones(job_id,subject_id,account_id,policy_hash) select j.id,j.subject_id,j.account_id,content_hash from private.policy_versions where id=j.policy_id on conflict do nothing;
 update private.purge_jobs set state='db_purged',db_purged_at=now(),counts=c where id=j.id;
 insert into private.purge_events(job_id,action) values(j.id,'db.completed');return c;
end $$;
create function private.goos_purge_auth_done(p_job uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
declare j private.purge_jobs;begin
 select * into j from private.purge_jobs where id=p_job and lease_id=p_lease and db_purged_at is not null for update;if not found then raise exception 'not_found' using errcode='P0002';end if;
 if exists(select 1 from auth.users where id=j.account_id) then raise exception 'auth_identity_not_deleted' using errcode='40001';end if;
 update private.purge_jobs set auth_deleted_at=now(),state=case when exists(select 1 from private.s4_cessations where subject_id=j.subject_id and status<>'acknowledged') then 'awaiting_recipients' else 'completed_live' end,lease_id=null,lease_until=null,last_error_code=null where id=j.id;
 insert into private.purge_events(job_id,action) values(j.id,'auth.completed');
end $$;
create function private.goos_purge_replay(p_receipts jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare x jsonb;l jsonb;n integer:=0;begin
 if jsonb_typeof(p_receipts) is distinct from 'array' or jsonb_array_length(p_receipts)>10000 then raise exception 'invalid_ledger' using errcode='22023';end if;
 for x in select jsonb_array_elements(p_receipts) loop
  l:=x->'ledger';if(x->>'hash') is distinct from encode(sha256(convert_to(l::text,'UTF8')),'hex') or(l->>'format')::integer<>1 or(l->>'account_id') is null or(l->>'subject_id') is null or(l->>'approved_by')=(l->>'officer_id') then raise exception 'untrusted_ledger' using errcode='22023';end if;
  if exists(select 1 from app.subjects where id=(l->>'subject_id')::uuid and account_id=(l->>'account_id')::uuid) then
   if exists(select 1 from app.subjects where id=(l->>'subject_id')::uuid and status='active') or exists(select 1 from app.accounts where id=(l->>'account_id')::uuid and status<>'deletion_pending') then perform private.goos_purge_scrub((l->>'subject_id')::uuid,(l->>'account_id')::uuid,null);n:=n+1;end if;
  end if;
 end loop;return n;
end $$;

-- Public policy projection deliberately omits staff IDs, drafts and legal-review internals.
create function private.goos_policy_public(p_locale text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'hash',p.content_hash,'controller',p.definition->>'controller_name','countries',p.definition->'country_codes','contact',p.definition->>'privacy_contact','hours',p.definition->>'service_hours','notice',p.definition->>('notice_'||p_locale),'retention',p.definition->'retention','published_at',p.published_at) from private.policy_current c join private.policy_versions p on p.id=c.policy_id where p.state='published' and p_locale in('th','en');
$$;

create function public.goos_purge_list() returns jsonb language sql security definer set search_path='' as $$select private.goos_purge_list();$$;
create function public.goos_purge_preview(p_request uuid) returns jsonb language sql security definer set search_path='' as $$select private.goos_purge_preview(p_request);$$;
create function public.goos_purge_approve(p_request uuid,p_hash text) returns uuid language sql security definer set search_path='' as $$select private.goos_purge_approve(p_request,p_hash);$$;
create function public.goos_purge_ledger(p_job uuid) returns jsonb language sql security definer set search_path='' as $$select private.goos_purge_ledger(p_job);$$;
create function public.goos_purge_ledger_saved(p_job uuid,p_hash text) returns void language sql security definer set search_path='' as $$select private.goos_purge_ledger_saved(p_job,p_hash);$$;
create function public.goos_purge_hold(p_request uuid,p_reason text,p_expires timestamptz,p_release uuid default null) returns void language sql security definer set search_path='' as $$select private.goos_purge_hold(p_request,p_reason,p_expires,p_release);$$;
create function public.goos_purge_enable(p_enabled boolean) returns void language sql security definer set search_path='' as $$select private.goos_purge_enable(p_enabled);$$;
create function public.goos_policy_public(p_locale text) returns jsonb language sql security definer set search_path='' as $$select private.goos_policy_public(p_locale);$$;
grant create on schema public to goos_api;
DO $$declare f record;begin
 for f in select p.oid::regprocedure sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and(p.proname like 'goos_purge_%' or p.proname='goos_policy_public') loop
  execute format('revoke all on function %s from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter',f.sig);
  if f.nspname='public' then execute format('alter function %s owner to goos_api',f.sig);execute format('grant execute on function %s to authenticated',f.sig);if f.proname='goos_policy_public' then execute format('grant execute on function %s to anon',f.sig);end if;
  elsif f.proname in('goos_purge_list','goos_purge_preview','goos_purge_approve','goos_purge_ledger','goos_purge_ledger_saved','goos_purge_hold','goos_purge_enable','goos_policy_public') then execute format('grant execute on function %s to goos_api',f.sig);
  elsif f.proname in('goos_purge_claim','goos_purge_execute','goos_purge_auth_done') then execute format('grant execute on function %s to goos_worker',f.sig);end if;
 end loop;
end $$;
revoke create on schema public from goos_api;
notify pgrst,'reload schema';
