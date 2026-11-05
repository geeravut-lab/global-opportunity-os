create function public.goos_s4_scope(p_account uuid,p_scope text,p_grant boolean,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() or p_account=private.goos_uid() or not private.goos_recipient_active(p_account) then raise exception 'not_found' using errcode='P0002';end if;
 if p_scope is null or p_scope not in('impact','privacy','safety') or p_grant is null or p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days' then raise exception 'invalid_input' using errcode='22023';end if;
 update private.s4_staff_scopes set revoked_at=now() where account_id=p_account and scope=p_scope and revoked_at is null;
 if p_grant then insert into private.s4_staff_scopes(account_id,scope,granted_by,expires_at) values(p_account,p_scope,private.goos_uid(),p_expires);end if;
 perform private.goos_audit('s4.scope.changed',p_account);
end $$;
create function private.goos_s4_assignee(p_account uuid,p_scope text) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_recipient_active(p_account) and exists(select 1 from private.s4_staff_scopes where account_id=p_account and scope=p_scope and revoked_at is null and expires_at>now()) and exists(select 1 from auth.mfa_factors where user_id=p_account and status='verified');
$$;
create function private.goos_s4_member(p_id uuid,p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id where m.id=p_id and m.organization_id=p_org and m.status='active' and r.role_code='caseworker' and private.goos_recipient_active(m.account_id));
$$;
create function private.goos_s4_independent(p_account uuid,p_subject uuid,p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from app.subjects where id=p_subject and account_id=p_account) and not exists(select 1 from app.org_memberships where account_id=p_account and organization_id=p_org and status='active');
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_assignee(uuid,text) owner to goos_authz;
alter function private.goos_s4_member(uuid,uuid) owner to goos_authz;
alter function private.goos_s4_independent(uuid,uuid,uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_assignee(uuid,text),private.goos_s4_member(uuid,uuid),private.goos_s4_independent(uuid,uuid,uuid) from public,anon,authenticated,goos_worker;
grant execute on function private.goos_s4_assignee(uuid,text),private.goos_s4_member(uuid,uuid),private.goos_s4_independent(uuid,uuid,uuid) to goos_api;
create function public.goos_s4_assign(p_kind text,p_id uuid,p_account uuid,p_expires timestamptz,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare v_scope text;v_version integer;o private.s4_outcomes;r private.s4_reports;begin
 if not private.goos_platform_admin() or p_account=private.goos_uid() then raise exception 'not_found' using errcode='P0002';end if;
 v_scope:=case p_kind when 'outcomes' then 'impact' when 'privacy' then 'privacy' when 'reports' then 'safety' end;
 if v_scope is null or p_expires is null or p_expires<=now() or p_expires>now()+interval '30 days' or not private.goos_s4_assignee(p_account,v_scope) then raise exception 'invalid_input' using errcode='22023';end if;
 if p_kind='outcomes' then
  select * into o from private.s4_outcomes where id=p_id for update;v_version:=o.version;
  if o.reporter_id=p_account or not private.goos_s4_independent(p_account,o.subject_id,o.organization_id) then raise exception 'conflicted_reviewer' using errcode='22023';end if;
 elsif p_kind='privacy' then select version into v_version from private.s4_privacy where id=p_id for update;
 else
  select * into r from private.s4_reports where id=p_id for update;v_version:=r.version;
  if r.accused_id=p_account or r.reporter_id=p_account or not private.goos_s4_independent(p_account,null,r.organization_id) then raise exception 'conflicted_officer' using errcode='22023';end if;
 end if;
 if v_version is null then raise exception 'not_found' using errcode='P0002';end if;
 if v_version is distinct from p_version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_kind='outcomes' then update private.s4_outcomes set reviewer_id=p_account,review_expires_at=p_expires,version=version+1 where id=p_id;
 elsif p_kind='privacy' then update private.s4_privacy set officer_id=p_account,assignment_expires_at=p_expires,version=version+1 where id=p_id;
 else update private.s4_reports set officer_id=p_account,assignment_expires_at=p_expires,version=version+1 where id=p_id;end if;
 -- Assignment is operational metadata, never a body-read grant for the administrator.
 perform private.goos_audit('s4.assignment.changed',p_id);
end $$;
create function public.goos_s4_outcome_create(p_case uuid,p_kind text,p_start date,p_end date,p_occurred timestamptz,p_body text,p_corrects uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_subject uuid;v_org uuid;v_source uuid;v_dest uuid;v_id uuid:=gen_random_uuid();v_old private.s4_outcomes;begin
 select subject_id,organization_id,id into v_subject,v_org,v_source from app.cases where id=p_case;
 if v_source is null then select subject_id,organization_id,id into v_subject,v_org,v_dest from private.s4_cases where id=p_case;end if;
 if v_subject is null or not(private.goos_owns_subject(v_subject) or private.goos_s4_source(v_source) or private.goos_s4_work(v_dest)) then raise exception 'not_found' using errcode='P0002';end if;
 if p_kind is null or p_kind not in('service_delivered','job_started','skills_completed') or p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 or p_end>current_date or p_occurred is null or p_occurred>now() or p_occurred::date not between p_start and p_end or p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'invalid_input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_case::text||':'||p_kind||':'||p_start::text||':'||p_end::text,0));
 if p_corrects is not null then
  select * into v_old from private.s4_outcomes where id=p_corrects for update;
  if not found or v_old.reporter_id<>private.goos_uid() or coalesce(v_old.source_case_id,v_old.referral_case_id)<>p_case or v_old.kind<>p_kind or v_old.period_start<>p_start or v_old.period_end<>p_end or v_old.state='superseded' then raise exception 'not_found' using errcode='P0002';end if;
  update private.s4_outcomes set state='superseded',tier=case when reporter_id=(select account_id from app.subjects where id=subject_id) then 'L0' else 'L1' end,version=version+1 where id=v_old.id;
 end if;
 insert into private.s4_outcomes(id,source_case_id,referral_case_id,subject_id,organization_id,kind,period_start,period_end,occurred_at,reporter_id,tier,encrypted_body,confirmed,corrects_id)
 values(v_id,v_source,v_dest,v_subject,v_org,p_kind,p_start,p_end,p_occurred,private.goos_uid(),case when private.goos_owns_subject(v_subject) then 'L0' else 'L1' end,private.goos_s3_encrypt(jsonb_build_object('body',trim(p_body))),private.goos_owns_subject(v_subject),p_corrects);
 insert into private.s4_events(kind,resource_id,actor_id,action) values('outcomes',v_id,private.goos_uid(),'reported');perform private.goos_audit('outcome.reported',v_id,v_org);return v_id;
end $$;
create function public.goos_s4_outcome_action(p_id uuid,p_action text,p_version integer,p_alternate text default null) returns void language plpgsql security definer set search_path='' as $$
declare o private.s4_outcomes;v_review boolean;begin
 select * into o from private.s4_outcomes where id=p_id for update;
 if not found or not private.goos_s4_outcome(o.id,true) then raise exception 'not_found' using errcode='P0002';end if;
 if o.version is distinct from p_version or o.state='superseded' then raise exception 'state_conflict' using errcode='40001';end if;
 v_review:=o.reviewer_id=private.goos_uid() and o.review_expires_at>now() and private.goos_s4_scope('impact') and o.reporter_id<>private.goos_uid() and private.goos_s4_independent(private.goos_uid(),o.subject_id,o.organization_id);
 if p_action='confirm' then
  if not private.goos_owns_subject(o.subject_id) then raise exception 'not_found' using errcode='P0002';end if;
  update private.s4_outcomes set confirmed=true,version=version+1 where id=o.id;
 elsif p_action='dispute' then
  if not(private.goos_owns_subject(o.subject_id) or v_review) then raise exception 'not_found' using errcode='P0002';end if;
  update private.s4_outcomes set state='disputed',tier=case when private.goos_owns_subject(o.subject_id) and o.reporter_id=private.goos_uid() then 'L0' else 'L1' end,version=version+1 where id=o.id;
 elsif p_action in('verify','reject') then
  if not coalesce(v_review,false) then raise exception 'not_found' using errcode='P0002';end if;
  if p_action='verify' and (not exists(select 1 from private.s4_evidence where outcome_id=o.id and status='clean') or(not o.confirmed and p_alternate is distinct from 'reviewed_documentary_evidence')) then raise exception 'evidence_or_confirmation_required' using errcode='22023';end if;
  if p_alternate is not null and p_alternate<>'reviewed_documentary_evidence' then raise exception 'invalid_input' using errcode='22023';end if;
  update private.s4_outcomes set state=case p_action when 'verify' then 'verified' else 'rejected' end,tier=case p_action when 'verify' then 'L2' else 'L1' end,reviewed_by=private.goos_uid(),alternate_reason=p_alternate,version=version+1 where id=o.id;
 else raise exception 'invalid_input' using errcode='22023';end if;
 insert into private.s4_events(kind,resource_id,actor_id,action) values('outcomes',o.id,private.goos_uid(),p_action);perform private.goos_audit('outcome.'||p_action,o.id,o.organization_id);
end $$;
create function public.goos_s4_evidence(p_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare o private.s4_outcomes;v bytea;v_id uuid;begin
 select * into o from private.s4_outcomes where id=p_id;
 if not found or o.reporter_id<>private.goos_uid() or not private.goos_s4_outcome(o.id,true) or o.state not in('reported','disputed') then raise exception 'not_found' using errcode='P0002';end if;
 if p_body is null or length(p_body)>1398104 or p_body!~'^[A-Za-z0-9+/]+={0,2}$' then raise exception 'invalid_input' using errcode='22023';end if;
 v:=decode(p_body,'base64');if octet_length(v) not between 45 and 1048576 or substring(v from 1 for 8)<>decode('89504e470d0a1a0a','hex') then raise exception 'invalid_png' using errcode='22023';end if;
 if(select count(*) from private.s4_evidence where outcome_id=o.id)>=5 then raise exception 'evidence_limit' using errcode='22023';end if;
 insert into private.s4_evidence(outcome_id,uploaded_by,original_body) values(o.id,private.goos_uid(),v) returning id into v_id;
 perform private.goos_audit('outcome.evidence.quarantined',v_id,o.organization_id);return v_id;
end $$;
create function public.goos_s4_download(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.s4_evidence;begin
 select * into e from private.s4_evidence where id=p_id;
 if not found or e.status<>'clean' or not private.goos_s4_outcome(e.outcome_id,true) then raise exception 'not_found' using errcode='P0002';end if;
 perform private.goos_audit('outcome.evidence.download',e.id);return jsonb_build_object('body',encode(e.safe_body,'base64'),'hash',e.content_hash);
end $$;
