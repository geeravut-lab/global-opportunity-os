-- S3: immutable consent/packages, tenant/assignment metadata, private machine outbox
create extension if not exists pgcrypto with schema extensions;
alter table app.notice_versions drop constraint notice_versions_purpose_check;
alter table app.notice_versions add constraint notice_versions_purpose_check check(purpose in('profile','assessment','application','application_delegation'));
insert into app.notice_versions(id,locale,version_label,body,content_hash,environment,purpose)
select id::uuid,locale,version_label,body,encode(sha256(convert_to(body,'UTF8')),'hex'),environment,purpose from(values
('00000000-0000-4000-8000-000000000201','th','dev-s3-application-1','ข้อมูลสมมติเท่านั้น ตรวจชื่อองค์กรผู้รับ จุดประสงค์ ฟิลด์และค่าที่เลือกใน preview ก่อนยืนยัน ส่งเฉพาะคำขอนี้ ไม่ส่งทั้งโปรไฟล์หรือแบบประเมิน การตอบข้อมูลเพิ่มต้องตรวจและยืนยันอีกครั้ง คุณถอนการแชร์ในอนาคตได้ แต่ไม่อาจเรียกคืนข้อมูลที่ผู้รับอ่านแล้ว ข้อความนี้ไม่ใช่นโยบาย production ที่รับรองแล้ว',encode(sha256(convert_to('dev-s3-application-th-1','UTF8')),'hex'),'development','application'),
('00000000-0000-4000-8000-000000000202','en','dev-s3-application-1','Synthetic data only. Review the named recipient, purpose, exact selected fields and values before confirming this request. Your full profile or assessment is not sent. Additional information requires a new preview and confirmation. You may stop future sharing; information already read cannot be recalled. This is not an approved production notice.',encode(sha256(convert_to('dev-s3-application-en-1','UTF8')),'hex'),'development','application'),
('00000000-0000-4000-8000-000000000203','th','dev-s3-delegation-1','ข้อมูลสมมติเท่านั้น ระบุบัญชีผู้ช่วย ขอบเขตเตรียมคำขอ/ส่งคำขอ/อ่านความคืบหน้าแยกกัน และวันหมดอายุ การให้สิทธิ์โปรไฟล์ไม่ให้สิทธิ์เหล่านี้ ผู้ช่วยต้องอ่านทวน preview และบันทึกการยืนยันก่อนส่ง คุณถอนอำนาจในอนาคตได้',encode(sha256(convert_to('dev-s3-delegation-th-1','UTF8')),'hex'),'development','application_delegation'),
('00000000-0000-4000-8000-000000000204','en','dev-s3-delegation-1','Synthetic data only. Name the helper account, separate prepare/submit/progress scopes and an expiry. Profile access does not grant these scopes. The helper must read back and confirm the preview before submission. You may revoke future authority.',encode(sha256(convert_to('dev-s3-delegation-en-1','UTF8')),'hex'),'development','application_delegation')) n(id,locale,version_label,body,ignored_hash,environment,purpose);
-- Hash จาก body จริง ณ INSERT; notice ที่เผยแพร่แล้วแก้ไม่ได้
alter table app.delegation_scopes drop constraint delegation_scopes_scope_check;
alter table app.delegation_scopes add constraint delegation_scopes_scope_check check(scope in('profile:read','profile:write','application:prepare','application:submit','progress:read'));
alter table private.consent_events drop constraint consent_events_purpose_check;
alter table private.consent_events add constraint consent_events_purpose_check check(purpose in('profile_processing','profile_delegation','application_delegation'));
alter table app.opportunities add column filled_count integer not null default 0 check(filled_count>=0);
alter table app.opportunities add constraint s3_opportunity_org unique(id,organization_id);

create table private.s3_keys(id integer primary key check(id=1), key_bytes bytea not null check(octet_length(key_bytes)=32));
insert into private.s3_keys values(1,extensions.gen_random_bytes(32));
alter table private.s3_keys enable row level security;
revoke all on private.s3_keys from public,anon,authenticated,goos_api,goos_authz;
create function private.goos_s3_encrypt(p_value jsonb) returns bytea language sql security definer set search_path='' as $$
 select extensions.pgp_sym_encrypt(p_value::text,encode(key_bytes,'hex'),'cipher-algo=aes256,compress-algo=1') from private.s3_keys where id=1;
$$;
create function private.goos_s3_decrypt(p_value bytea) returns jsonb language sql security definer set search_path='' as $$
 select extensions.pgp_sym_decrypt(p_value,encode(key_bytes,'hex'))::jsonb from private.s3_keys where id=1;
$$;
revoke all on function private.goos_s3_encrypt(jsonb),private.goos_s3_decrypt(bytea) from public,anon,authenticated;
grant execute on function private.goos_s3_encrypt(jsonb),private.goos_s3_decrypt(bytea) to goos_api,goos_authz;

create table app.applications(
 id uuid primary key default gen_random_uuid(),subject_id uuid not null references app.subjects(id),opportunity_id uuid not null,organization_id uuid not null,
 revision_id uuid not null,actor_id uuid not null references app.accounts(id),cycle_no integer not null check(cycle_no>0),
 state text not null default 'submitted' check(state in('submitted','under_review','needs_information','accepted','declined','waitlisted','completed','withdrawn')),
 version integer not null default 1 check(version>0),job_stage text not null default 'none' check(job_stage in('none','review','interview','offer','offer_accepted','started','completed','declined')),
 capacity_reserved boolean not null default false,receipt_code uuid not null unique default gen_random_uuid(),
 submitted_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(subject_id,opportunity_id,cycle_no),unique(id,subject_id,organization_id),unique(id,organization_id),
 foreign key(opportunity_id,organization_id) references app.opportunities(id,organization_id),
 foreign key(revision_id,opportunity_id) references app.opportunity_revisions(id,opportunity_id)
);
create unique index s3_one_active_application on app.applications(subject_id,opportunity_id) where state not in('withdrawn','declined','completed');
create table app.cases(
 id uuid primary key default gen_random_uuid(),application_id uuid not null unique,subject_id uuid not null,organization_id uuid not null,
 state text not null default 'open' check(state in('open','triaged','in_progress','awaiting_external','resolved','closed','cancelled')),
 priority text not null default 'normal' check(priority in('normal','urgent')),due_at timestamptz,timezone text not null default 'UTC',
 resolution_code text check(resolution_code in('service_recorded','not_proceeding','user_withdrew','administrative')),
 version integer not null default 1 check(version>0),updated_at timestamptz not null default now(),
 unique(id,organization_id),foreign key(application_id,subject_id,organization_id) references app.applications(id,subject_id,organization_id)
);
create table app.case_assignments(
 id uuid primary key default gen_random_uuid(),case_id uuid not null,organization_id uuid not null,membership_id uuid not null,
 assigned_by uuid not null references app.accounts(id),starts_at timestamptz not null default now(),ends_at timestamptz,
 foreign key(case_id,organization_id) references app.cases(id,organization_id),
 check(ends_at is null or ends_at>=starts_at)
);
alter table app.org_memberships add constraint s3_membership_org unique(id,organization_id);
alter table app.case_assignments add constraint s3_assignment_tenant foreign key(membership_id,organization_id) references app.org_memberships(id,organization_id);
create unique index s3_one_assignee on app.case_assignments(case_id) where ends_at is null;
create table private.s3_consents(
 id uuid primary key default gen_random_uuid(),subject_id uuid not null references app.subjects(id),actor_id uuid not null references app.accounts(id),
 recipient_org_id uuid not null references app.organizations(id),notice_id uuid not null,notice_purpose text not null default 'application' check(notice_purpose='application'),
 purpose text not null check(purpose in('application','additional_information')),fields text[] not null,package_hash text not null,
 evidence_method text not null check(evidence_method in('self_confirmed','delegate_readback')),created_at timestamptz not null default now(),
 foreign key(notice_id,notice_purpose) references app.notice_versions(id,purpose)
);
create table private.application_packages(
 application_id uuid primary key references app.applications(id),encrypted_payload bytea not null,key_id integer not null default 1 references private.s3_keys(id),
 content_hash text not null,fields text[] not null,consent_id uuid not null unique references private.s3_consents(id),created_at timestamptz not null default now()
);
create table app.application_info_requests(
 id uuid primary key default gen_random_uuid(),application_id uuid not null references app.applications(id),fields text[] not null,
 reason_code text not null check(reason_code in('clarify_skills','confirm_availability','confirm_contact','other_fields')),
 status text not null default 'open' check(status in('open','answered','cancelled')),created_by uuid not null references app.accounts(id),created_at timestamptz not null default now()
);
create unique index s3_one_open_request on app.application_info_requests(application_id) where status='open';
create table private.application_responses(
 id uuid primary key default gen_random_uuid(),application_id uuid not null references app.applications(id),request_id uuid not null unique references app.application_info_requests(id),
 encrypted_payload bytea not null,key_id integer not null default 1 references private.s3_keys(id),content_hash text not null,fields text[] not null,
 consent_id uuid not null unique references private.s3_consents(id),created_at timestamptz not null default now(),unique(id,application_id)
);
create table app.resource_shares(
 id uuid primary key default gen_random_uuid(),application_id uuid not null references app.applications(id),response_id uuid,
 subject_id uuid not null,recipient_org_id uuid not null,consent_id uuid not null unique references private.s3_consents(id),
 status text not null default 'active' check(status in('active','revoked')),expires_at timestamptz not null default now()+interval '30 days',revoked_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(application_id,subject_id,recipient_org_id) references app.applications(id,subject_id,organization_id),
 foreign key(response_id,application_id) references private.application_responses(id,application_id)
);
create unique index s3_original_share on app.resource_shares(application_id) where response_id is null;
create table app.resource_share_fields(share_id uuid not null references app.resource_shares(id),field_code text not null,primary key(share_id,field_code));
create table private.s3_previews(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references app.accounts(id),subject_id uuid not null references app.subjects(id),
 opportunity_id uuid not null references app.opportunities(id),revision_id uuid not null references app.opportunity_revisions(id),organization_id uuid not null references app.organizations(id),
 notice_id uuid not null references app.notice_versions(id),fields text[] not null,encrypted_payload bytea not null,content_hash text not null,
 subject_version integer not null,assessment_version integer,application_id uuid references app.applications(id),request_id uuid references app.application_info_requests(id),
 application_version integer,kind text not null check(kind in('application','response')),expires_at timestamptz not null default now()+interval '15 minutes',
 consumed_at timestamptz,created_at timestamptz not null default now()
);
create table private.idempotency_records(
 actor_id uuid not null references app.accounts(id),route text not null,key text not null,request_hash text not null,
 application_id uuid not null references app.applications(id),receipt jsonb not null,expires_at timestamptz not null default now()+interval '24 hours',
 primary key(actor_id,route,key)
);
create table app.application_events(
 id uuid primary key default gen_random_uuid(),application_id uuid not null references app.applications(id),actor_id uuid not null references app.accounts(id),
 from_state text,to_state text not null,reason_code text not null,created_at timestamptz not null default now()
);
create table app.case_events(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references app.cases(id),actor_id uuid not null references app.accounts(id),
 action text not null,reason_code text not null,created_at timestamptz not null default now()
);
create table private.case_notes(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references app.cases(id),author_id uuid not null references app.accounts(id),
 visibility text not null check(visibility in('beneficiary_shared','internal')),encrypted_body bytea not null,key_id integer not null default 1 references private.s3_keys(id),
 supersedes_id uuid references private.case_notes(id),created_at timestamptz not null default now(),unique(supersedes_id)
);
create table private.s3_withdrawals(application_id uuid primary key references app.applications(id),subject_id uuid not null references app.subjects(id),actor_id uuid not null references app.accounts(id),created_at timestamptz not null default now());
create table app.notification_preferences(
 account_id uuid primary key references app.accounts(id),in_app boolean not null default true,email boolean not null default false,
 timezone text not null default 'UTC',version integer not null default 1 check(version>0)
);
create table private.outbox(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references app.accounts(id),case_id uuid references app.cases(id),organization_id uuid references app.organizations(id),
 kind text not null check(kind in('application.updated','case.updated','followup.due')),channel text not null check(channel in('in_app','email')),
 dedupe_key text not null unique,status text not null default 'pending' check(status in('pending','inflight','delivered','cancelled','dead')),
 attempts integer not null default 0 check(attempts between 0 and 5),available_at timestamptz not null default now(),lease_id uuid,lease_until timestamptz,
 last_error_code text check(last_error_code in('transport_unavailable','smtp_rejected','lease_expired','worker_failed')),
 delivered_at timestamptz,created_at timestamptz not null default now()
);
create table app.automation_rules(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references app.organizations(id),
 kind text not null default 'followup_due' check(kind='followup_due'),minutes_before integer not null default 0 check(minutes_before between 0 and 10080),
 timezone text not null default 'UTC',enabled boolean not null default false,version integer not null default 1 check(version>0),
 created_by uuid not null references app.accounts(id),updated_at timestamptz not null default now()
);
create index s3_application_subject on app.applications(subject_id,submitted_at desc,id);
create index s3_case_queue on app.cases(organization_id,updated_at desc,id);
create index s3_assignment_member on app.case_assignments(membership_id) where ends_at is null;
create index s3_share_active on app.resource_shares(application_id,expires_at) where status='active';
create index s3_preview_actor on private.s3_previews(actor_id,created_at);
create index s3_outbox_dispatch on private.outbox(channel,available_at) where status in('pending','inflight');

-- Predicate role เห็น metadata ที่จำเป็นผ่าน RLS; ไม่ให้สิทธิ์นี้แก่ user roles
create function private.goos_s3_routing(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and private.goos_has_org_role(p_org,array['owner','admin','supervisor']);
$$;
create function private.goos_s3_supervisor(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and private.goos_has_org_role(p_org,array['supervisor']);
$$;
create function private.goos_s3_progress(p_app uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.applications a where a.id=p_app and private.goos_can_subject(a.subject_id,'progress:read'));
$$;
create function private.goos_s3_work(p_app uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and exists(select 1 from app.applications a join app.cases c on c.application_id=a.id
 join app.case_assignments ca on ca.case_id=c.id and ca.ends_at is null join app.org_memberships m on m.id=ca.membership_id and m.status='active' and m.account_id=private.goos_uid()
 join app.organizations o on o.id=a.organization_id and o.status='verified' and o.verification_expires_at>now()
 join app.opportunity_revisions r on r.id=a.revision_id
 where a.id=p_app and a.state<>'withdrawn' and exists(select 1 from app.resource_shares s where s.application_id=a.id and s.response_id is null and s.status='active' and s.expires_at>now())
 and exists(select 1 from app.org_member_roles mr where mr.membership_id=m.id and mr.role_code=case when r.category='jobs' then 'recruiter' else 'caseworker' end));
$$;
create function private.goos_s3_visible(p_app uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_s3_progress(p_app) or private.goos_s3_work(p_app) or exists(select 1 from app.applications a where a.id=p_app and a.actor_id=private.goos_uid() and private.goos_can_subject(a.subject_id,'application:submit')) or exists(select 1 from app.applications a where a.id=p_app and private.goos_s3_routing(a.organization_id));
$$;
create function private.goos_s3_fields(p_fields text[]) returns boolean language sql immutable set search_path='' as $$
 select p_fields is not null and cardinality(p_fields) between 1 and 7 and array_position(p_fields,null) is null and p_fields<@array['display_alias','country_code','coarse_region','preferred_language','available_hours_week','skills','contact_email']::text[];
$$;
create function private.goos_s3_payload(p_subject uuid,p_fields text[],p_skills jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s app.subjects;a app.assessments;v jsonb;v_email text;begin
 if not private.goos_can_subject(p_subject,'application:prepare') or not private.goos_s3_fields(p_fields) then raise exception 'not_found' using errcode='P0002';end if;
 select * into strict s from app.subjects where id=p_subject;select * into a from app.assessments where subject_id=p_subject and confirmed_at is not null;
 if p_skills is null or jsonb_typeof(p_skills)<>'array' or jsonb_array_length(p_skills)>10 or exists(select 1 from jsonb_array_elements(p_skills)x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 60) then raise exception 'invalid_skills' using errcode='22023';end if;
 if 'skills'=any(p_fields) and jsonb_array_length(p_skills)=0 then raise exception 'missing_skills' using errcode='22023';end if;
 if 'contact_email'=any(p_fields) then
  if s.safe_contact<>'email' then raise exception 'contact_not_enabled' using errcode='22023';end if;
  select u.email into v_email from auth.users u where u.id=s.account_id and u.email_confirmed_at is not null;
 end if;
 v:=jsonb_build_object('display_alias',s.display_alias,'country_code',s.country_code,'coarse_region',s.coarse_region,'preferred_language',a.preferred_language,'available_hours_week',a.available_hours_week,'skills',p_skills,'contact_email',v_email);
 if exists(select 1 from unnest(p_fields) f where v->f='null'::jsonb) then raise exception 'field_not_available' using errcode='22023';end if;
 return(select jsonb_object_agg(f,v->f) from(select distinct unnest(p_fields)f) fields);
end $$;
-- Payload helper อ่าน verified email แบบแคบ ไม่เปิด arbitrary email lookup
revoke all on function private.goos_s3_payload(uuid,text[],jsonb) from public,anon,authenticated;
grant execute on function private.goos_s3_payload(uuid,text[],jsonb) to goos_api;

-- RLS ทุกตาราง: authz metadata role ไม่คืน table data แก่ browser
DO $$declare t text;begin
 foreach t in array array['applications','cases','case_assignments','application_info_requests','resource_shares','resource_share_fields','application_events','case_events','notification_preferences','automation_rules'] loop
 execute format('alter table app.%I enable row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated',t);
 execute format('create policy s3_authz_read on app.%I for select to goos_authz using(true)',t);
 execute format('grant select on app.%I to goos_authz',t);
 end loop;
 foreach t in array array['s3_previews','s3_consents','application_packages','application_responses','idempotency_records','case_notes','s3_withdrawals','outbox'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 execute format('create policy s3_authz_read on private.%I for select to goos_authz using(true)',t);
 execute format('grant select on private.%I to goos_authz',t);
 end loop;
end $$;
create policy s3_application_api on app.applications to goos_api using(private.goos_s3_visible(id)) with check(private.goos_actor_active());
create policy s3_case_api on app.cases to goos_api using(private.goos_s3_visible(application_id)) with check(private.goos_s3_visible(application_id));
create policy s3_assignment_api on app.case_assignments to goos_api using(exists(select 1 from app.cases c where c.id=case_id)) with check(private.goos_s3_supervisor(organization_id));
create policy s3_info_api on app.application_info_requests to goos_api using(private.goos_s3_visible(application_id)) with check(private.goos_s3_work(application_id));
create policy s3_share_api on app.resource_shares to goos_api using(private.goos_s3_visible(application_id)) with check(private.goos_can_subject(subject_id,'application:submit'));
create policy s3_fields_api on app.resource_share_fields to goos_api using(exists(select 1 from app.resource_shares s where s.id=share_id)) with check(exists(select 1 from app.resource_shares s where s.id=share_id));
create policy s3_appevent_api on app.application_events to goos_api using(private.goos_s3_visible(application_id)) with check(actor_id=private.goos_uid() and private.goos_s3_visible(application_id));
create policy s3_caseevent_api on app.case_events to goos_api using(exists(select 1 from app.cases c where c.id=case_id)) with check(actor_id=private.goos_uid() and exists(select 1 from app.cases c where c.id=case_id));
create policy s3_pref_api on app.notification_preferences to goos_api using(private.goos_actor_active() and account_id=private.goos_uid()) with check(private.goos_actor_active() and account_id=private.goos_uid());
create policy s3_rules_api on app.automation_rules to goos_api using(private.goos_s3_routing(organization_id)) with check(private.goos_s3_supervisor(organization_id));
create policy s3_preview_api on private.s3_previews to goos_api using(actor_id=private.goos_uid() and private.goos_can_subject(subject_id,'application:prepare')) with check(actor_id=private.goos_uid() and private.goos_can_subject(subject_id,'application:prepare'));
create policy s3_consent_api on private.s3_consents to goos_api using(private.goos_can_subject(subject_id,'progress:read') or(actor_id=private.goos_uid() and private.goos_can_subject(subject_id,'application:submit'))) with check(actor_id=private.goos_uid() and private.goos_can_subject(subject_id,'application:submit'));
create policy s3_package_api on private.application_packages to goos_api using(private.goos_s3_progress(application_id) or private.goos_s3_work(application_id)) with check(private.goos_s3_visible(application_id));
create policy s3_response_api on private.application_responses to goos_api using(private.goos_s3_progress(application_id) or private.goos_s3_work(application_id)) with check(private.goos_s3_progress(application_id) or exists(select 1 from app.applications a where a.id=application_id and private.goos_can_subject(a.subject_id,'application:submit')));
create policy s3_idempotency_api on private.idempotency_records to goos_api using(actor_id=private.goos_uid() and private.goos_actor_active()) with check(actor_id=private.goos_uid() and private.goos_actor_active());
create policy s3_note_api on private.case_notes to goos_api using(exists(select 1 from app.cases c join app.applications a on a.id=c.application_id join app.opportunity_revisions r on r.id=a.revision_id where c.id=case_id and ((visibility='beneficiary_shared' and private.goos_s3_progress(a.id)) or(private.goos_s3_work(a.id) and(r.category<>'jobs' or visibility='beneficiary_shared'))))) with check(author_id=private.goos_uid() and exists(select 1 from app.cases c join app.applications a on a.id=c.application_id join app.opportunity_revisions r on r.id=a.revision_id where c.id=case_id and private.goos_s3_work(a.id) and r.category<>'jobs'));
create policy s3_withdraw_api on private.s3_withdrawals to goos_api using(private.goos_can_subject(subject_id,'progress:read')) with check(actor_id=private.goos_uid() and private.goos_can_subject(subject_id,'application:submit'));
-- outbox writes ผ่าน trigger/function ของ operator เท่านั้น; API role ไม่ได้อ่าน recipient list/raw jobs
create policy s3_outbox_ops on private.outbox for select to goos_api using(private.goos_platform_admin() or private.goos_s3_routing(organization_id));
grant select,insert,update on app.applications,app.cases,app.case_assignments,app.application_info_requests,app.resource_shares,app.notification_preferences,app.automation_rules,private.s3_previews to goos_api;
grant select,insert on app.application_events,app.case_events,app.resource_share_fields,private.s3_consents,private.application_packages,private.application_responses,private.idempotency_records,private.case_notes,private.s3_withdrawals to goos_api;
grant select on private.outbox to goos_api;
grant update(filled_count) on app.opportunities to goos_api;
-- authenticated submitter อาจไม่มี profile:read; ให้ API เห็นเฉพาะ subject ที่มี explicit application authority
create policy s3_subject_api on app.subjects for select to goos_api using(private.goos_can_subject(id,'application:prepare'));
grant create on schema private to goos_authz;
DO $$declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=any(array['goos_s3_routing','goos_s3_supervisor','goos_s3_progress','goos_s3_work','goos_s3_visible','goos_s3_fields']) loop
 execute format('alter function %s owner to goos_authz',f.sig);execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to goos_api',f.sig);
 end loop;
end $$;
revoke create on schema private from goos_authz;
DO $$declare name text;begin
 foreach name in array array['private.s3_consents','private.application_packages','private.application_responses','private.case_notes','private.s3_withdrawals','private.idempotency_records','app.application_events','app.case_events','app.resource_share_fields'] loop
 execute format('create trigger s3_immutable before update or delete or truncate on %s for each statement execute function private.goos_audit_immutable()',name);
 end loop;
end $$;

create policy s3_historical_revision on app.opportunity_revisions for select to goos_api using(exists(select 1 from app.applications a where a.revision_id=opportunity_revisions.id and private.goos_s3_visible(a.id)));
create policy s3_application_listing on app.opportunities for select to goos_api using(exists(select 1 from app.applications a where a.opportunity_id=opportunities.id and private.goos_s3_visible(a.id)));
