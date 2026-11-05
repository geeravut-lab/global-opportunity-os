-- User-context RPC: no actor/recipient privilege from request body
create function public.goos_s3_notices(p_locale text,p_purpose text default 'application') returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version_label,'body',body,'hash',content_hash,'environment',environment)),'[]') from app.notice_versions where locale=p_locale and purpose=p_purpose and p_purpose in('application','application_delegation') and private.goos_actor_active();
$$;
create function public.goos_s3_delegate(p_subject uuid,p_delegate uuid,p_scopes text[],p_expires timestamptz,p_notice uuid,p_confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();begin
 if not private.goos_owns_subject(p_subject) then raise exception 'not_found' using errcode='P0002';end if;
 if p_confirmed is distinct from true or p_delegate is null or p_delegate=private.goos_uid() or not private.goos_recipient_active(p_delegate) or p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days'
 or p_scopes is null or cardinality(p_scopes) not between 1 and 3 or array_position(p_scopes,null) is not null or not(p_scopes<@array['application:prepare','application:submit','progress:read']::text[]) or('application:submit'=any(p_scopes) and not('application:prepare'=any(p_scopes)))
 or not exists(select 1 from app.notice_versions where id=p_notice and purpose='application_delegation') then raise exception 'invalid_input' using errcode='22023';end if;
 if exists(select 1 from app.delegations where subject_id=p_subject and delegate_account_id=p_delegate and status='active' and expires_at>now()) then raise exception 'existing_delegation_revoke_first' using errcode='40001';end if;
 update app.delegations set status='revoked',revoked_at=now(),version=version+1 where subject_id=p_subject and delegate_account_id=p_delegate and status='active';
 insert into app.delegations(id,subject_id,delegate_account_id,granted_by,expires_at) values(v_id,p_subject,p_delegate,private.goos_uid(),p_expires);
 insert into app.delegation_scopes select v_id,f from(select distinct unnest(p_scopes) f) scopes;
 insert into private.consent_events(subject_id,actor_id,recipient_account_id,delegation_id,purpose,notice_version_id,action,scopes) values(p_subject,private.goos_uid(),p_delegate,v_id,'application_delegation',p_notice,'granted',p_scopes);
 perform private.goos_audit('application.delegation',v_id);return v_id;
end $$;
create function public.goos_s3_subjects() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'own',s.account_id=private.goos_uid(),'can_prepare',private.goos_can_subject(s.id,'application:prepare'),'can_submit',private.goos_can_subject(s.id,'application:submit'),'can_progress',private.goos_can_subject(s.id,'progress:read'))),'[]') from app.subjects s
 where private.goos_owns_subject(s.id) or private.goos_can_subject(s.id,'application:prepare') or private.goos_can_subject(s.id,'progress:read');
$$;
create function public.goos_s3_availability(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p app.opportunities;r app.opportunity_revisions;begin
 if not private.goos_s2_public_listing(p_id) then raise exception 'not_found' using errcode='P0002';end if;
 select * into strict p from app.opportunities where id=p_id;select * into strict r from app.opportunity_revisions where id=p.approved_revision_id;
 return jsonb_build_object('accepting',r.capacity is null or p.filled_count<r.capacity,'remaining',case when r.capacity is null then null else greatest(0,r.capacity-p.filled_count) end,'revision_id',r.id);
end $$;
create function public.goos_s3_preview(p_subject uuid,p_opportunity uuid,p_fields text[],p_skills jsonb,p_notice uuid,p_application uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p app.opportunities;r app.opportunity_revisions;s app.subjects;a app.applications;q app.application_info_requests;v_payload jsonb;v_package jsonb;v_hash text;v_id uuid:=gen_random_uuid();v_fields text[];v_assessment integer;begin
 if not private.goos_can_subject(p_subject,'application:prepare') then raise exception 'not_found' using errcode='P0002';end if;
 if not private.goos_s3_fields(p_fields) or not exists(select 1 from app.notice_versions where id=p_notice and purpose='application') then raise exception 'invalid_input' using errcode='22023';end if;
 if(select count(*) from private.s3_previews where actor_id=private.goos_uid() and created_at>now()-interval '1 day')>=100 then raise exception 'preview_limit' using errcode='22023';end if;
 select array_agg(distinct f order by f) into v_fields from unnest(p_fields)f;
 select * into strict s from app.subjects where id=p_subject;
 if p_application is null then
  if not private.goos_s2_public_listing(p_opportunity) then raise exception 'opportunity_changed' using errcode='40001';end if;
  select * into strict p from app.opportunities where id=p_opportunity;select * into strict r from app.opportunity_revisions where id=p.approved_revision_id;
  if r.capacity is not null and p.filled_count>=r.capacity then raise exception 'capacity_conflict' using errcode='40001';end if;
 else
  select * into a from app.applications where id=p_application and subject_id=p_subject;
  if not found or a.state<>'needs_information' or not exists(select 1 from app.resource_shares sh where sh.application_id=a.id and sh.response_id is null and sh.status='active' and sh.expires_at>now()) then raise exception 'not_found' using errcode='P0002';end if;
  select * into q from app.application_info_requests where application_id=a.id and status='open';
  if not found or not(v_fields<@q.fields) then raise exception 'invalid_fields' using errcode='22023';end if;
  select * into strict p from app.opportunities where id=a.opportunity_id;select * into strict r from app.opportunity_revisions where id=a.revision_id;
 end if;
 if not exists(select 1 from app.organizations where id=p.organization_id and status='verified' and verification_expires_at>now()) then raise exception 'organization_changed' using errcode='40001';end if;
 v_payload:=private.goos_s3_payload(p_subject,v_fields,p_skills);
 select version into v_assessment from app.assessments where subject_id=p_subject and confirmed_at is not null;
 v_package:=jsonb_build_object('recipient',jsonb_build_object('id',p.organization_id,'name',(select display_name from app.organizations where id=p.organization_id)),
 'purpose',case when p_application is null then 'application' else 'additional_information' end,'fields',to_jsonb(v_fields),'values',v_payload,
 'opportunity',jsonb_build_object('id',p.id,'revision_id',r.id,'title_th',r.title_th,'title_en',r.title_en,'category',r.category,'job_pay_min',r.job_pay_min,'job_pay_max',r.job_pay_max,'currency',r.currency,'job_pay_unit',r.job_pay_unit,'job_contract',r.job_contract),
 'notice_id',p_notice,'notice_hash',(select content_hash from app.notice_versions where id=p_notice),'subject_version',s.version,'assessment_version',v_assessment);
 v_hash:=encode(sha256(convert_to(v_package::text,'UTF8')),'hex');
 insert into private.s3_previews(id,actor_id,subject_id,opportunity_id,revision_id,organization_id,notice_id,fields,encrypted_payload,content_hash,subject_version,assessment_version,application_id,request_id,application_version,kind)
 values(v_id,private.goos_uid(),p_subject,p.id,r.id,p.organization_id,p_notice,v_fields,private.goos_s3_encrypt(v_package),v_hash,s.version,v_assessment,a.id,q.id,a.version,case when p_application is null then 'application' else 'response' end);
 perform private.goos_audit('application.preview',v_id);
 return jsonb_build_object('id',v_id,'hash',v_hash,'expires_at',now()+interval '15 minutes','package',v_package,'readback_required',not private.goos_owns_subject(p_subject));
end $$;
create function public.goos_s3_submit(p_preview uuid,p_hash text,p_notice uuid,p_confirmed boolean,p_readback boolean,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.s3_previews;p app.opportunities;r app.opportunity_revisions;a app.applications;v_existing private.idempotency_records;v_request_hash text;v_consent uuid;v_share uuid;v_response uuid;v_case uuid;v_receipt jsonb;v_current_assessment integer;begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_key is null or p_key!~'^[A-Za-z0-9_-]{8,80}$' or p_confirmed is distinct from true or p_readback is null then raise exception 'invalid_input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(private.goos_uid()::text||':s3.submit:'||p_key,0));
 v_request_hash:=encode(sha256(convert_to(jsonb_build_array(p_preview,p_hash,p_notice,p_confirmed,p_readback)::text,'UTF8')),'hex');
 select * into v_existing from private.idempotency_records where actor_id=private.goos_uid() and route='s3.submit' and key=p_key;
 if found then
  if v_existing.request_hash<>v_request_hash or v_existing.expires_at<=now() then raise exception 'idempotency_conflict' using errcode='40001';end if;
  select * into a from app.applications where id=v_existing.application_id;
  if not found or not private.goos_can_subject(a.subject_id,'application:submit') then raise exception 'not_found' using errcode='P0002';end if;
  return v_existing.receipt;
 end if;
 select * into v from private.s3_previews where id=p_preview;
 if not found or v.actor_id<>private.goos_uid() or not private.goos_can_subject(v.subject_id,'application:prepare') or not private.goos_can_subject(v.subject_id,'application:submit') then raise exception 'not_found' using errcode='P0002';end if;
 -- ทุก mutation ของ application ล็อก opportunity ก่อน application เพื่อใช้ capacity barrier เดียวกัน
 select * into strict p from app.opportunities where id=v.opportunity_id for update;
 select * into strict v from private.s3_previews where id=p_preview for update;
 if v.consumed_at is not null or v.expires_at<=now() or v.content_hash is distinct from p_hash or v.notice_id is distinct from p_notice or(not private.goos_owns_subject(v.subject_id) and p_readback is distinct from true) then raise exception 'preview_changed' using errcode='40001';end if;
 select version into v_current_assessment from app.assessments where subject_id=v.subject_id and confirmed_at is not null;
 if v.subject_version is distinct from(select version from app.subjects where id=v.subject_id) or v.assessment_version is distinct from v_current_assessment or not exists(select 1 from app.organizations where id=v.organization_id and status='verified' and verification_expires_at>now()) then raise exception 'preview_changed' using errcode='40001';end if;
 select * into strict r from app.opportunity_revisions where id=v.revision_id;
 if v.kind='application' then
  if not private.goos_s2_public_listing(p.id) or p.approved_revision_id is distinct from v.revision_id or(r.capacity is not null and p.filled_count>=r.capacity) then raise exception 'opportunity_changed' using errcode='40001';end if;
  if exists(select 1 from app.applications where subject_id=v.subject_id and opportunity_id=p.id and state not in('withdrawn','declined','completed')) then raise exception 'active_application_exists' using errcode='40001';end if;
 else
  select * into a from app.applications where id=v.application_id for update;
  if a.version is distinct from v.application_version or a.state<>'needs_information' or not exists(select 1 from app.application_info_requests where id=v.request_id and status='open') or not exists(select 1 from app.resource_shares where application_id=a.id and response_id is null and status='active' and expires_at>now()) then raise exception 'response_changed' using errcode='40001';end if;
 end if;
 insert into private.s3_consents(subject_id,actor_id,recipient_org_id,notice_id,purpose,fields,package_hash,evidence_method)
 values(v.subject_id,private.goos_uid(),v.organization_id,v.notice_id,case when v.kind='application' then 'application' else 'additional_information' end,v.fields,v.content_hash,case when private.goos_owns_subject(v.subject_id) then 'self_confirmed' else 'delegate_readback' end) returning id into v_consent;
 if v.kind='application' then
  insert into app.applications(subject_id,opportunity_id,organization_id,revision_id,actor_id,cycle_no,job_stage)
  values(v.subject_id,p.id,p.organization_id,r.id,private.goos_uid(),coalesce((select max(cycle_no) from app.applications where subject_id=v.subject_id and opportunity_id=p.id),0)+1,case when r.category='jobs' then 'review' else 'none' end) returning * into a;
  insert into private.application_packages(application_id,encrypted_payload,content_hash,fields,consent_id) values(a.id,v.encrypted_payload,v.content_hash,v.fields,v_consent);
  insert into app.cases(application_id,subject_id,organization_id) values(a.id,a.subject_id,a.organization_id) returning id into v_case;
 else
  insert into private.application_responses(application_id,request_id,encrypted_payload,content_hash,fields,consent_id) values(a.id,v.request_id,v.encrypted_payload,v.content_hash,v.fields,v_consent) returning id into v_response;
  update app.application_info_requests set status='answered' where id=v.request_id;
  update app.applications set state='under_review',version=version+1,updated_at=now() where id=a.id returning * into a;
  select id into v_case from app.cases where application_id=a.id;
 end if;
 insert into app.resource_shares(application_id,response_id,subject_id,recipient_org_id,consent_id) values(a.id,v_response,a.subject_id,a.organization_id,v_consent) returning id into v_share;
 insert into app.resource_share_fields select v_share,f from unnest(v.fields)f;
 insert into app.application_events(application_id,actor_id,from_state,to_state,reason_code) values(a.id,private.goos_uid(),case when v.kind='response' then 'needs_information' else null end,a.state,case when v.kind='response' then 'information_provided' else 'submitted' end);
 update private.s3_previews set consumed_at=now() where id=v.id;
 perform private.goos_s3_emit(v_case,'application.updated',a.id::text||':'||a.version::text);
 perform private.goos_audit('application.submitted',a.id,a.organization_id);
 v_receipt:=jsonb_build_object('id',a.id,'case_id',v_case,'state',a.state,'version',a.version,'submitted_at',a.submitted_at,'receipt_code',a.receipt_code,'shared_fields',v.fields,'package_hash',v.content_hash);
 insert into private.idempotency_records(actor_id,route,key,request_hash,application_id,receipt) values(private.goos_uid(),'s3.submit',p_key,v_request_hash,a.id,v_receipt);
 return v_receipt;
end $$;

create function public.goos_s3_list(p_org uuid default null,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_page is null or p_page not between 1 and 100 then raise exception 'invalid_page' using errcode='22023';end if;
 if p_org is not null and not(private.goos_s3_routing(p_org) or private.goos_has_org_role(p_org,array['caseworker','recruiter']) and private.goos_staff_assured()) then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(data order by submitted_at desc,id),'[]') from(
 select a.id,a.submitted_at,jsonb_build_object('id',a.id,'case_id',c.id,'organization_id',a.organization_id,'state',a.state,'version',a.version,'case_state',c.state,'case_version',c.version,'due_at',c.due_at,'timezone',c.timezone,'job_stage',a.job_stage,'title_th',r.title_th,'title_en',r.title_en,'can_work',private.goos_s3_work(a.id),'can_progress',private.goos_s3_progress(a.id),'can_route',private.goos_s3_routing(a.organization_id)) data
 from app.applications a join app.cases c on c.application_id=a.id join app.opportunity_revisions r on r.id=a.revision_id
 where case when p_org is null then private.goos_s3_progress(a.id) else a.organization_id=p_org and(private.goos_s3_routing(p_org) or private.goos_s3_work(a.id)) end
 order by a.submitted_at desc,a.id limit 20 offset(p_page-1)*20) rows);
end $$;
create function public.goos_s3_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a app.applications;c app.cases;v_payload jsonb;begin
 if not(private.goos_s3_progress(p_id) or private.goos_s3_work(p_id)) then raise exception 'not_found' using errcode='P0002';end if;
 select * into strict a from app.applications where id=p_id;select * into strict c from app.cases where application_id=p_id;
 select private.goos_s3_decrypt(encrypted_payload) into v_payload from private.application_packages where application_id=p_id;
 return jsonb_build_object('id',a.id,'state',a.state,'version',a.version,'job_stage',a.job_stage,'receipt_code',a.receipt_code,'case',jsonb_build_object('id',c.id,'state',c.state,'version',c.version,'priority',c.priority,'due_at',c.due_at,'timezone',c.timezone,'resolution_code',c.resolution_code),
 'package',v_payload,'can_work',private.goos_s3_work(a.id),'can_submit',private.goos_can_subject(a.subject_id,'application:submit'),'own',private.goos_owns_subject(a.subject_id),
 'responses',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'package',private.goos_s3_decrypt(v.encrypted_payload),'hash',v.content_hash,'created_at',v.created_at) order by v.created_at),'[]') from private.application_responses v where v.application_id=a.id and(private.goos_s3_progress(a.id) or exists(select 1 from app.resource_shares sh where sh.response_id=v.id and sh.status='active' and sh.expires_at>now()))),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'fields',fields,'status',status,'reason_code',reason_code,'created_at',created_at) order by created_at),'[]') from app.application_info_requests where application_id=a.id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('state',to_state,'reason_code',reason_code,'created_at',created_at) order by created_at),'[]') from app.application_events where application_id=a.id),
 'notes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'visibility',visibility,'body',private.goos_s3_decrypt(encrypted_body)->>'body','supersedes_id',supersedes_id,'own',author_id=private.goos_uid(),'created_at',created_at) order by created_at),'[]') from private.case_notes where case_id=c.id));
end $$;
create function public.goos_s3_transition(p_id uuid,p_action text,p_version integer,p_reason text,p_fields text[] default '{}') returns void language plpgsql security definer set search_path='' as $$
declare a app.applications;p app.opportunities;r app.opportunity_revisions;v_state text;c app.cases;begin
 select * into a from app.applications where id=p_id;
 if not found or not(private.goos_can_subject(a.subject_id,'application:submit') and p_action in('withdraw','accept_offer') or private.goos_s3_work(a.id)) then raise exception 'not_found' using errcode='P0002';end if;
 select * into strict p from app.opportunities where id=a.opportunity_id for update;select * into strict a from app.applications where id=p_id for update;
 select * into strict r from app.opportunity_revisions where id=a.revision_id;select * into strict c from app.cases where application_id=a.id for update;
 if p_version is distinct from a.version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_reason is null or p_reason not in('user_requested','reviewed','criteria_not_met','capacity_waitlist','information_needed','service_recorded','interview_scheduled','offer_made','offer_accepted','started','completed') then raise exception 'invalid_reason' using errcode='22023';end if;
 if p_action='withdraw' then
  if not private.goos_can_subject(a.subject_id,'application:submit') then raise exception 'not_found' using errcode='P0002';end if;
  if a.state in('withdrawn','declined','completed') then raise exception 'state_conflict' using errcode='40001';end if;
  update app.resource_shares set status='revoked',revoked_at=now() where application_id=a.id and status='active';
  update app.application_info_requests set status='cancelled' where application_id=a.id and status='open';
  if a.capacity_reserved and a.job_stage not in('started','completed') and c.state not in('in_progress','resolved','closed') then update app.opportunities set filled_count=greatest(0,filled_count-1) where id=p.id;a.capacity_reserved:=false;end if;
  update app.applications set state='withdrawn',capacity_reserved=a.capacity_reserved,version=version+1,updated_at=now() where id=a.id;
  update app.cases set state=case when state in('closed','resolved') then state else 'cancelled' end,resolution_code='user_withdrew',version=version+1,updated_at=now() where id=c.id;
  insert into private.s3_withdrawals(application_id,subject_id,actor_id) values(a.id,a.subject_id,private.goos_uid()) on conflict do nothing;
  v_state:='withdrawn';
 elsif p_action='accept_offer' then
  if not private.goos_can_subject(a.subject_id,'application:submit') or r.category<>'jobs' or a.job_stage<>'offer' or a.state<>'under_review' then raise exception 'not_found' using errcode='P0002';end if;
  if not private.goos_s2_public_listing(p.id) or p.approved_revision_id<>a.revision_id or(r.capacity is not null and p.filled_count>=r.capacity) then raise exception 'capacity_or_listing_conflict' using errcode='40001';end if;
  update app.opportunities set filled_count=filled_count+1 where id=p.id;
  update app.applications set state='accepted',job_stage='offer_accepted',capacity_reserved=true,version=version+1,updated_at=now() where id=a.id;v_state:='accepted';
 else
  if not private.goos_s3_work(a.id) then raise exception 'not_found' using errcode='P0002';end if;
  if p_action='start_review' and a.state in('submitted','waitlisted') then v_state:='under_review';
  elsif p_action='request_info' and a.state='under_review' then
   if not private.goos_s3_fields(p_fields) then raise exception 'invalid_fields' using errcode='22023';end if;
   insert into app.application_info_requests(application_id,fields,reason_code,created_by) values(a.id,p_fields,'other_fields',private.goos_uid());v_state:='needs_information';
  elsif p_action='waitlist' and a.state='under_review' then v_state:='waitlisted';
  elsif p_action='decline' and a.state='under_review' then v_state:='declined';
  elsif p_action='accept' and a.state='under_review' and r.category<>'jobs' then
   if not private.goos_s2_public_listing(p.id) or p.approved_revision_id<>a.revision_id or(r.capacity is not null and p.filled_count>=r.capacity) then raise exception 'capacity_or_listing_conflict' using errcode='40001';end if;
   update app.opportunities set filled_count=filled_count+1 where id=p.id;a.capacity_reserved:=true;v_state:='accepted';
  elsif p_action='complete' and a.state='accepted' and r.category<>'jobs' then
   if c.state<>'resolved' then raise exception 'case_not_resolved' using errcode='40001';end if;v_state:='completed';
  elsif p_action='interview' and r.category='jobs' and a.state='under_review' and a.job_stage='review' then a.job_stage:='interview';v_state:=a.state;
  elsif p_action='offer' and r.category='jobs' and a.state='under_review' and a.job_stage in('review','interview') then a.job_stage:='offer';v_state:=a.state;
  elsif p_action='job_started' and r.category='jobs' and a.state='accepted' and a.job_stage='offer_accepted' then a.job_stage:='started';v_state:=a.state;
  elsif p_action='job_completed' and r.category='jobs' and a.state='accepted' and a.job_stage='started' then a.job_stage:='completed';v_state:='completed';
  else raise exception 'invalid_transition' using errcode='40001';end if;
  update app.applications set state=v_state,job_stage=case when v_state='declined' and r.category='jobs' then 'declined' else a.job_stage end,capacity_reserved=a.capacity_reserved,version=version+1,updated_at=now() where id=a.id;
 end if;
 insert into app.application_events(application_id,actor_id,from_state,to_state,reason_code) values(a.id,private.goos_uid(),a.state,v_state,p_reason);
 perform private.goos_s3_emit(c.id,'application.updated',a.id::text||':'||(a.version+1)::text);
 perform private.goos_audit('application.'||p_action,a.id,a.organization_id);
end $$;

create function public.goos_s3_assign(p_case uuid,p_member uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare c app.cases;a app.applications;v_kind text;begin
 select * into c from app.cases where id=p_case;
 if not found or not private.goos_s3_supervisor(c.organization_id) then raise exception 'not_found' using errcode='P0002';end if;
 select * into strict a from app.applications where id=c.application_id;
 perform 1 from app.opportunities where id=a.opportunity_id for update;select * into strict c from app.cases where id=p_case for update;
 if c.version is distinct from p_version or c.state in('closed','cancelled') or a.state='withdrawn' then raise exception 'state_conflict' using errcode='40001';end if;
 select case when category='jobs' then 'recruiter' else 'caseworker' end into v_kind from app.opportunity_revisions where id=a.revision_id;
 if not exists(select 1 from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id join app.accounts account on account.id=m.account_id and account.status='active' where m.id=p_member and m.organization_id=c.organization_id and m.status='active' and r.role_code=v_kind) then raise exception 'not_found' using errcode='P0002';end if;
 update app.case_assignments set ends_at=now() where case_id=c.id and ends_at is null;
 insert into app.case_assignments(case_id,organization_id,membership_id,assigned_by) values(c.id,c.organization_id,p_member,private.goos_uid());
 update app.cases set version=version+1,updated_at=now() where id=c.id;
 insert into app.case_events(case_id,actor_id,action,reason_code) values(c.id,private.goos_uid(),'assigned','human_routing');
 perform private.goos_s3_emit(c.id,'case.updated',c.id::text||':'||(c.version+1)::text);
 perform private.goos_audit('case.assigned',c.id,c.organization_id);
end $$;
create function public.goos_s3_case(p_case uuid,p_action text,p_version integer,p_due timestamptz,p_timezone text,p_priority text,p_resolution text) returns void language plpgsql security definer set search_path='' as $$
declare c app.cases;a app.applications;v_state text;begin
 select * into c from app.cases where id=p_case;
 if not found or not(private.goos_s3_work(c.application_id) or private.goos_s3_supervisor(c.organization_id)) then raise exception 'not_found' using errcode='P0002';end if;
 select * into strict a from app.applications where id=c.application_id;perform 1 from app.opportunities where id=a.opportunity_id for update;select * into strict c from app.cases where id=p_case for update;
 if p_version is distinct from c.version or a.state='withdrawn' then raise exception 'state_conflict' using errcode='40001';end if;
 if p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) or p_priority is null or p_priority not in('normal','urgent') then raise exception 'invalid_input' using errcode='22023';end if;
 if p_action in('close','reopen') and not private.goos_s3_supervisor(c.organization_id) then raise exception 'not_found' using errcode='P0002';end if;
 if p_action not in('close','reopen') and not private.goos_s3_work(a.id) then raise exception 'not_found' using errcode='P0002';end if;
 v_state:=case when p_action='schedule' and c.state not in('closed','cancelled') then c.state when p_action='triage' and c.state='open' then 'triaged'
 when p_action='start' and c.state in('triaged','awaiting_external') and a.state='accepted' then 'in_progress'
 when p_action='await_external' and c.state='in_progress' then 'awaiting_external'
 when p_action='resolve' and c.state in('in_progress','awaiting_external') then 'resolved'
 when p_action='close' and c.state='resolved' then 'closed'
 when p_action='reopen' and c.state='closed' then 'in_progress' end;
 if v_state is null then raise exception 'invalid_transition' using errcode='40001';end if;
 if p_resolution is not null and p_resolution not in('service_recorded','not_proceeding','administrative') then raise exception 'invalid_resolution' using errcode='22023';end if;
 if p_action in('resolve','close') and p_resolution is null then raise exception 'resolution_required' using errcode='22023';end if;
 update app.cases set state=v_state,due_at=p_due,timezone=p_timezone,priority=p_priority,resolution_code=coalesce(p_resolution,resolution_code),version=version+1,updated_at=now() where id=c.id;
 insert into app.case_events(case_id,actor_id,action,reason_code) values(c.id,private.goos_uid(),p_action,coalesce(p_resolution,'human_update'));
 perform private.goos_s3_emit(c.id,'case.updated',c.id::text||':'||(c.version+1)::text);
 perform private.goos_audit('case.'||p_action,c.id,c.organization_id);
end $$;
create function public.goos_s3_note(p_case uuid,p_body text,p_visibility text,p_supersedes uuid,p_version integer) returns uuid language plpgsql security definer set search_path='' as $$
declare c app.cases;v_id uuid;begin
 select * into c from app.cases where id=p_case for update;
 if not found or not private.goos_s3_work(c.application_id) or exists(select 1 from app.applications a join app.opportunity_revisions r on r.id=a.revision_id where a.id=c.application_id and r.category='jobs') then raise exception 'not_found' using errcode='P0002';end if;
 if p_version is distinct from c.version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_body is null or length(trim(p_body)) not between 1 and 2000 or p_visibility is null or p_visibility not in('internal','beneficiary_shared') then raise exception 'invalid_input' using errcode='22023';end if;
 if p_supersedes is not null and not exists(select 1 from private.case_notes where id=p_supersedes and case_id=c.id and author_id=private.goos_uid() and visibility=p_visibility) then raise exception 'not_found' using errcode='P0002';end if;
 insert into private.case_notes(case_id,author_id,visibility,encrypted_body,supersedes_id) values(c.id,private.goos_uid(),p_visibility,private.goos_s3_encrypt(jsonb_build_object('body',trim(p_body))),p_supersedes) returning id into v_id;
 update app.cases set version=version+1,updated_at=now() where id=c.id;
 insert into app.case_events(case_id,actor_id,action,reason_code) values(c.id,private.goos_uid(),'note.added',case when p_visibility='internal' then 'internal_note' else 'shared_note' end);
 if p_visibility='beneficiary_shared' then perform private.goos_s3_emit(c.id,'case.updated',v_id::text);end if;
 perform private.goos_audit('case.note',v_id,c.organization_id);return v_id;
end $$;
-- Explicit workflow roles; owner/admin ไม่ได้สิทธิ์ package โดยอัตโนมัติ
create function public.goos_s3_role(p_org uuid,p_member uuid,p_role text,p_grant boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_staff_assured() or not private.goos_has_org_role(p_org,array['owner','admin']) or not exists(select 1 from app.org_memberships where id=p_member and organization_id=p_org and status='active') then raise exception 'not_found' using errcode='P0002';end if;
 if p_role is null or p_role not in('caseworker','supervisor','recruiter') or p_grant is null or p_reason is null or length(trim(p_reason)) not between 1 and 200 then raise exception 'invalid_input' using errcode='22023';end if;
 if p_grant then insert into app.org_member_roles(membership_id,role_code) values(p_member,p_role) on conflict do nothing;
 else delete from app.org_member_roles where membership_id=p_member and role_code=p_role;end if;
 perform private.goos_audit('workflow.role.changed',p_member,p_org);
end $$;
-- จำกัด SQL delete role เพิ่มเฉพาะการจัดการ workflow roles
create policy s3_roles_delete on app.org_member_roles for delete to goos_api using(private.goos_staff_assured() and role_code in('caseworker','supervisor','recruiter') and exists(select 1 from app.org_memberships m where m.id=membership_id and private.goos_has_org_role(m.organization_id,array['owner','admin'])));
grant delete on app.org_member_roles to goos_api;

-- freeze public callable ownership/grants ของ S3 เท่านั้น
DO $$declare f record;begin
 grant create on schema public to goos_api;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'goos_s3_%' loop
 execute format('alter function %s owner to goos_api',f.sig);execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
 revoke create on schema public from goos_api;
end $$;
grant execute on function public.goos_s3_availability(uuid) to anon;
