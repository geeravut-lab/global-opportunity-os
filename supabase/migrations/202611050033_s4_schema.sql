-- S4 metadata and encrypted content. No production retention or purge policy is implied.
alter table app.cases add constraint s4_source_case_tenant unique(id,subject_id,organization_id);
create table private.s4_referrals(
 id uuid primary key default gen_random_uuid(),source_case_id uuid not null references app.cases(id),subject_id uuid not null references app.subjects(id),source_org_id uuid not null references app.organizations(id),
 recipient_org_id uuid not null,opportunity_id uuid not null,revision_id uuid not null,
 proposed_by uuid not null references app.accounts(id),purpose text not null check(purpose in('service_support','work_support')),
 state text not null default 'proposed' check(state in('proposed','pending','accepted','declined','cancelled','expired')),
 share_active boolean not null default false,share_expires_at timestamptz,expires_at timestamptz not null default now()+interval '7 days',version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(source_org_id<>recipient_org_id),unique(id,subject_id,recipient_org_id),
 foreign key(source_case_id,subject_id,source_org_id) references app.cases(id,subject_id,organization_id),
 foreign key(opportunity_id,recipient_org_id) references app.opportunities(id,organization_id),foreign key(revision_id,opportunity_id) references app.opportunity_revisions(id,opportunity_id)
);
create unique index s4_active_referral on private.s4_referrals(source_case_id,opportunity_id) where state in('proposed','pending','accepted') and (state<>'accepted' or share_active);
create table private.s4_previews(
 id uuid primary key default gen_random_uuid(),referral_id uuid not null references private.s4_referrals(id),actor_id uuid not null references app.accounts(id),encrypted_payload bytea not null,content_hash text not null,
 notice_id uuid not null references app.notice_versions(id),subject_version integer not null,assessment_version integer,referral_version integer not null,source_version integer not null,
 expires_at timestamptz not null default now()+interval '15 minutes',consumed_at timestamptz
);
create table private.s4_packages(
 referral_id uuid primary key references private.s4_referrals(id),actor_id uuid not null references app.accounts(id),notice_id uuid not null references app.notice_versions(id),encrypted_payload bytea not null,
 content_hash text not null,fields text[] not null,created_at timestamptz not null default now(),check(private.goos_s3_fields(fields))
);
create table private.s4_cases(
 id uuid primary key default gen_random_uuid(),referral_id uuid not null unique,subject_id uuid not null,organization_id uuid not null,membership_id uuid not null,
 state text not null default 'open' check(state in('open','in_progress','resolved','closed')),version integer not null default 1 check(version>0),updated_at timestamptz not null default now(),
 foreign key(referral_id,subject_id,organization_id) references private.s4_referrals(id,subject_id,recipient_org_id),foreign key(membership_id,organization_id) references app.org_memberships(id,organization_id)
);
create table private.s4_notes(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references private.s4_cases(id),author_id uuid not null references app.accounts(id),visibility text not null check(visibility in('internal','beneficiary_shared')),
 encrypted_body bytea not null,supersedes_id uuid unique references private.s4_notes(id),created_at timestamptz not null default now()
);
create table private.s4_staff_scopes(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references app.accounts(id),scope text not null check(scope in('impact','privacy','safety')),granted_by uuid not null references app.accounts(id),
 expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now(),check(account_id<>granted_by)
);
create unique index s4_active_scope on private.s4_staff_scopes(account_id,scope) where revoked_at is null;
create table private.s4_outcomes(
 id uuid primary key default gen_random_uuid(),source_case_id uuid references app.cases(id),referral_case_id uuid references private.s4_cases(id),subject_id uuid not null references app.subjects(id),organization_id uuid not null references app.organizations(id),
 kind text not null check(kind in('service_delivered','job_started','skills_completed')),period_start date not null,period_end date not null,occurred_at timestamptz not null,
 reporter_id uuid not null references app.accounts(id),tier text not null check(tier in('L0','L1','L2')),state text not null default 'reported' check(state in('reported','verified','disputed','rejected','superseded')),
 encrypted_body bytea not null,confirmed boolean not null default false,reviewer_id uuid references app.accounts(id),review_expires_at timestamptz,reviewed_by uuid references app.accounts(id),
 alternate_reason text check(alternate_reason in('reviewed_documentary_evidence')),corrects_id uuid unique references private.s4_outcomes(id),version integer not null default 1,created_at timestamptz not null default now(),
 check(num_nonnulls(source_case_id,referral_case_id)=1),check(period_end>=period_start),check(period_end-period_start<=366),check((tier='L2')=(state='verified')),
 check(reviewed_by is null or reviewed_by<>reporter_id)
);
create unique index s4_outcome_source_dedup on private.s4_outcomes(source_case_id,kind,period_start,period_end) where source_case_id is not null and state<>'superseded';
create unique index s4_outcome_destination_dedup on private.s4_outcomes(referral_case_id,kind,period_start,period_end) where referral_case_id is not null and state<>'superseded';
create table private.s4_evidence(
 id uuid primary key default gen_random_uuid(),outcome_id uuid not null references private.s4_outcomes(id),uploaded_by uuid not null references app.accounts(id),status text not null default 'quarantined' check(status in('quarantined','clean','rejected')),
 original_body bytea,safe_body bytea,content_hash text,inspection text,created_at timestamptz not null default now(),processed_at timestamptz,
 check(original_body is null or octet_length(original_body) between 45 and 1048576),check(status<>'clean' or (safe_body is not null and original_body is null)),check(status<>'rejected' or (safe_body is null and original_body is null))
);
create table private.s4_privacy(
 id uuid primary key default gen_random_uuid(),subject_id uuid not null references app.subjects(id),requester_id uuid not null references app.accounts(id),kind text not null check(kind in('access','export','correct','delete')),
 encrypted_body bytea not null,profile_version integer not null,state text not null default 'submitted' check(state in('submitted','in_review','approved','awaiting_policy','on_hold','completed','declined')),
 officer_id uuid references app.accounts(id),assignment_expires_at timestamptz,identity_verified_at timestamptz,identity_reason text check(identity_reason in('authenticated_session_review','assisted_verified')),
 hold_code text check(hold_code in('active_investigation','legal_obligation')),version integer not null default 1,created_at timestamptz not null default now()
);
create table private.s4_reports(
 id uuid primary key default gen_random_uuid(),reporter_id uuid references app.accounts(id),organization_id uuid references app.organizations(id),accused_id uuid references app.accounts(id),kind text not null check(kind in('service','safety')),
 encrypted_body bytea not null,receipt_hash text,state text not null default 'submitted' check(state in('submitted','in_review','resolved','dismissed')),officer_id uuid references app.accounts(id),assignment_expires_at timestamptz,
 appeal_of uuid unique references private.s4_reports(id),version integer not null default 1,created_at timestamptz not null default now(),check(reporter_id is not null or receipt_hash is not null)
);
create table private.s4_cessations(
 id uuid primary key default gen_random_uuid(),subject_id uuid not null references app.subjects(id),resource_kind text not null check(resource_kind in('application','referral')),resource_id uuid not null,recipient_org_id uuid not null references app.organizations(id),
 status text not null default 'requested' check(status in('requested','acknowledged')),acknowledged_by uuid references app.accounts(id),created_at timestamptz not null default now(),unique(resource_kind,resource_id)
);
create table private.s4_withdrawals(referral_id uuid primary key references private.s4_referrals(id),subject_id uuid not null references app.subjects(id),actor_id uuid not null references app.accounts(id),created_at timestamptz not null default now());
create table private.s4_events(id uuid primary key default gen_random_uuid(),kind text not null check(kind in('referrals','outcomes','privacy','reports')),resource_id uuid not null,actor_id uuid references app.accounts(id),action text not null,created_at timestamptz not null default now());
create table private.s4_idempotency(actor_id uuid not null references app.accounts(id),route text not null,key text not null,request_hash text not null,resource_id uuid not null,receipt jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,route,key));
create index s4_referral_subject on private.s4_referrals(subject_id,created_at desc,id);
create index s4_referral_recipient on private.s4_referrals(recipient_org_id,state,created_at desc,id);
create index s4_evidence_work on private.s4_evidence(created_at) where status='quarantined';
alter table app.notice_versions drop constraint notice_versions_purpose_check;
alter table app.notice_versions add constraint notice_versions_purpose_check check(purpose in('profile','assessment','application','application_delegation','referral'));
insert into app.notice_versions(id,locale,version_label,body,content_hash,environment,purpose)
select id::uuid,locale,'dev-s4-referral-1',body,encode(sha256(convert_to(body,'UTF8')),'hex'),'development','referral' from(values
('00000000-0000-4000-8000-000000000401','th','ข้อมูลสมมติเท่านั้น ตรวจองค์กรปลายทาง วัตถุประสงค์ ฟิลด์และค่าที่จะแชร์ก่อนยืนยัน เคสและบันทึกภายในต้นทางไม่ถูกคัดลอก ผู้ใช้ถอนการแชร์ในอนาคตได้แต่ไม่อาจเรียกคืนข้อมูลที่ผู้รับอ่านแล้ว อายุคำขอ/การแชร์นี้เป็นค่าทดลอง ไม่ใช่นโยบาย production ที่รับรองแล้ว'),
('00000000-0000-4000-8000-000000000402','en','Synthetic data only. Review the named destination, purpose, exact fields and values. Source case notes are not copied. You may stop future sharing; information already read cannot be recalled. Request/share durations are development assumptions, not approved production policy.')) n(id,locale,body);
-- Metadata predicates use the established non-login/non-bypass authz role.
create function private.goos_s4_scope(p_scope text) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and exists(select 1 from private.s4_staff_scopes where account_id=private.goos_uid() and scope=p_scope and revoked_at is null and expires_at>now());
$$;
create function private.goos_s4_source(p_case uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.cases c join app.applications a on a.id=c.application_id where c.id=p_case and private.goos_s3_work(a.id));
$$;
create function private.goos_s4_valid(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.s4_referrals r join app.cases c on c.id=r.source_case_id join app.applications a on a.id=c.application_id join app.subjects s on s.id=r.subject_id join app.accounts u on u.id=s.account_id join app.organizations o on o.id=r.recipient_org_id
 where r.id=p_id and r.share_active and r.share_expires_at>now() and r.state in('pending','accepted') and (r.state='accepted' or r.expires_at>now()) and s.status='active' and s.age_band='adult' and u.status='active' and a.state<>'withdrawn' and o.status='verified' and o.verification_expires_at>now()
 and exists(select 1 from app.resource_shares sh where sh.application_id=a.id and sh.response_id is null and sh.status='active' and sh.expires_at>now()));
$$;
create function private.goos_s4_work(p_case uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and exists(select 1 from private.s4_cases c join app.org_memberships m on m.id=c.membership_id where c.id=p_case and m.account_id=private.goos_uid() and m.status='active' and private.goos_has_org_role(c.organization_id,array['caseworker']) and private.goos_s4_valid(c.referral_id));
$$;
create function private.goos_s4_referral(p_id uuid,p_detail boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from private.s4_referrals r where r.id=p_id and (private.goos_owns_subject(r.subject_id) or private.goos_s4_source(r.source_case_id)
 or exists(select 1 from private.s4_cases c where c.referral_id=r.id and private.goos_s4_work(c.id)) or(not p_detail and r.state<>'proposed' and private.goos_s3_routing(r.recipient_org_id))));
$$;
create function private.goos_s4_outcome(p_id uuid,p_detail boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from private.s4_outcomes o where o.id=p_id and (private.goos_owns_subject(o.subject_id) or private.goos_s4_source(o.source_case_id) or private.goos_s4_work(o.referral_case_id)
 or(o.reviewer_id=private.goos_uid() and o.review_expires_at>now() and private.goos_s4_scope('impact') and o.reporter_id<>private.goos_uid() and not exists(select 1 from app.subjects s where s.id=o.subject_id and s.account_id=private.goos_uid()) and not exists(select 1 from app.org_memberships m where m.organization_id=o.organization_id and m.account_id=private.goos_uid() and m.status='active'))
 or(not p_detail and private.goos_platform_admin())));
$$;
create function private.goos_s4_privacy(p_id uuid,p_detail boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from private.s4_privacy p where p.id=p_id and (private.goos_owns_subject(p.subject_id) or(p.officer_id=private.goos_uid() and p.assignment_expires_at>now() and private.goos_s4_scope('privacy')) or(not p_detail and private.goos_platform_admin())));
$$;
create function private.goos_s4_report(p_id uuid,p_detail boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from private.s4_reports r where r.id=p_id and (r.reporter_id=private.goos_uid() or(r.officer_id=private.goos_uid() and r.assignment_expires_at>now() and private.goos_s4_scope('safety') and r.accused_id is distinct from private.goos_uid() and not exists(select 1 from app.org_memberships m where m.organization_id=r.organization_id and m.account_id=private.goos_uid() and m.status='active')) or(not p_detail and private.goos_platform_admin() and r.accused_id is distinct from private.goos_uid())));
$$;
create function private.goos_s4_visible(p_kind text,p_id uuid,p_detail boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select case p_kind when 'referrals' then private.goos_s4_referral(p_id,p_detail) when 'outcomes' then private.goos_s4_outcome(p_id,p_detail) when 'privacy' then private.goos_s4_privacy(p_id,p_detail) when 'reports' then private.goos_s4_report(p_id,p_detail) else false end;
$$;
DO $$declare t text;f record;begin
 foreach t in array array['s4_referrals','s4_previews','s4_packages','s4_cases','s4_notes','s4_staff_scopes','s4_outcomes','s4_evidence','s4_privacy','s4_reports','s4_cessations','s4_withdrawals','s4_events','s4_idempotency'] loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,goos_worker',t);
 execute format('create policy s4_authz on private.%I for select to goos_authz using(true)',t);execute format('grant select on private.%I to goos_authz',t);
 end loop;
 grant create on schema private to goos_authz;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'goos_s4_%' loop
 execute format('alter function %s owner to goos_authz',f.sig);execute format('revoke all on function %s from public,anon,authenticated,goos_worker',f.sig);execute format('grant execute on function %s to goos_api',f.sig);
 end loop;revoke create on schema private from goos_authz;
end $$;
create policy s4_api on private.s4_referrals to goos_api using(private.goos_s4_referral(id)) with check(private.goos_actor_active() and (private.goos_owns_subject(subject_id) or private.goos_s4_source(source_case_id) or private.goos_s3_routing(recipient_org_id)));
create policy s4_api on private.s4_previews to goos_api using(actor_id=private.goos_uid() and private.goos_s4_referral(referral_id,true)) with check(actor_id=private.goos_uid() and private.goos_s4_referral(referral_id,true));
create policy s4_api on private.s4_packages to goos_api using(private.goos_s4_referral(referral_id,true)) with check(actor_id=private.goos_uid() and exists(select 1 from private.s4_referrals r where r.id=referral_id and private.goos_owns_subject(r.subject_id)));
create policy s4_api on private.s4_cases to goos_api using(private.goos_s4_referral(referral_id)) with check(private.goos_s3_routing(organization_id) or private.goos_s4_work(id));
create policy s4_api on private.s4_notes to goos_api using(exists(select 1 from private.s4_cases c where c.id=case_id and (private.goos_s4_work(c.id) or visibility='beneficiary_shared' and private.goos_owns_subject(c.subject_id)))) with check(author_id=private.goos_uid() and private.goos_s4_work(case_id));
create policy s4_api on private.s4_staff_scopes to goos_api using(private.goos_platform_admin() or account_id=private.goos_uid()) with check(private.goos_platform_admin() and account_id<>private.goos_uid() and granted_by=private.goos_uid());
create policy s4_api on private.s4_outcomes to goos_api using(private.goos_s4_outcome(id)) with check(private.goos_actor_active() and (private.goos_owns_subject(subject_id) or private.goos_s4_source(source_case_id) or private.goos_s4_work(referral_case_id) or private.goos_s4_outcome(id,true) or private.goos_platform_admin()));
create policy s4_api on private.s4_evidence to goos_api using(private.goos_s4_outcome(outcome_id,true)) with check(uploaded_by=private.goos_uid() and private.goos_s4_outcome(outcome_id,true));
create policy s4_api on private.s4_privacy to goos_api using(private.goos_s4_privacy(id)) with check(private.goos_owns_subject(subject_id) or private.goos_s4_privacy(id,true) or private.goos_platform_admin());
create policy s4_api on private.s4_reports to goos_api using(private.goos_s4_report(id)) with check(private.goos_actor_active() and (reporter_id=private.goos_uid() or private.goos_s4_report(id,true) or private.goos_platform_admin()));
create policy s4_api on private.s4_cessations to goos_api using(private.goos_owns_subject(subject_id) or private.goos_s3_routing(recipient_org_id)) with check(private.goos_owns_subject(subject_id) or private.goos_s3_routing(recipient_org_id));
create policy s4_api on private.s4_withdrawals to goos_api using(private.goos_owns_subject(subject_id)) with check(actor_id=private.goos_uid() and private.goos_owns_subject(subject_id));
create policy s4_api on private.s4_events to goos_api using(private.goos_s4_visible(kind,resource_id,true)) with check(actor_id=private.goos_uid() and private.goos_s4_visible(kind,resource_id));
create policy s4_api on private.s4_idempotency to goos_api using(actor_id=private.goos_uid() and private.goos_actor_active()) with check(actor_id=private.goos_uid() and private.goos_actor_active());
grant select,insert on private.s4_referrals,private.s4_previews,private.s4_packages,private.s4_cases,private.s4_notes,private.s4_staff_scopes,private.s4_outcomes,private.s4_evidence,private.s4_privacy,private.s4_reports,private.s4_cessations,private.s4_withdrawals,private.s4_events,private.s4_idempotency to goos_api;
grant update(state,share_active,share_expires_at,version,updated_at) on private.s4_referrals to goos_api;
grant update(consumed_at) on private.s4_previews to goos_api;
grant update(state,version,membership_id,updated_at) on private.s4_cases to goos_api;
grant update(revoked_at) on private.s4_staff_scopes to goos_api;
grant update(state,tier,confirmed,reviewer_id,review_expires_at,reviewed_by,alternate_reason,version) on private.s4_outcomes to goos_api;
grant update(state,officer_id,assignment_expires_at,identity_verified_at,identity_reason,hold_code,version) on private.s4_privacy to goos_api;
grant update(state,officer_id,assignment_expires_at,version) on private.s4_reports to goos_api;
grant update(status,acknowledged_by) on private.s4_cessations to goos_api;
DO $$declare t text;begin foreach t in array array['s4_packages','s4_notes','s4_events','s4_idempotency','s4_withdrawals'] loop execute format('create trigger s4_immutable before update or delete or truncate on private.%I for each statement execute function private.goos_audit_immutable()',t);end loop;end $$;
create policy s4_machine_read on private.s4_evidence for select to goos_worker using(status in('quarantined','clean','rejected'));
create policy s4_machine_write on private.s4_evidence for update to goos_worker using(status='quarantined') with check(status in('clean','rejected') and original_body is null and ((status='clean' and safe_body is not null) or(status='rejected' and safe_body is null)));
grant select(id,original_body,status,created_at),update(status,safe_body,original_body,content_hash,inspection,processed_at) on private.s4_evidence to goos_worker;
