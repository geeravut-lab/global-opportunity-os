create function public.goos_s4_privacy_create(p_kind text,p_body text,p_confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare v_subject uuid;v_version integer;v_id uuid:=gen_random_uuid();begin
 select id,version into v_subject,v_version from app.subjects where account_id=private.goos_uid() and private.goos_owns_subject(id);
 if v_subject is null then raise exception 'not_found' using errcode='P0002';end if;
 if p_kind is null or p_kind not in('access','export','correct','delete') or p_body is null or length(trim(p_body)) not between 1 and 2000 or p_confirmed is distinct from true then raise exception 'invalid_input' using errcode='22023';end if;
 if(select count(*) from private.s4_privacy where requester_id=private.goos_uid() and created_at>now()-interval '1 day')>=10 then raise exception 'request_limit' using errcode='22023';end if;
 insert into private.s4_privacy(id,subject_id,requester_id,kind,encrypted_body,profile_version) values(v_id,v_subject,private.goos_uid(),p_kind,private.goos_s3_encrypt(jsonb_build_object('body',trim(p_body))),v_version);
 insert into private.s4_events(kind,resource_id,actor_id,action) values('privacy',v_id,private.goos_uid(),'submitted');perform private.goos_audit('privacy.requested',v_id);return v_id;
end $$;
create function public.goos_s4_privacy_action(p_id uuid,p_action text,p_version integer,p_reason text default null) returns void language plpgsql security definer set search_path='' as $$
declare p private.s4_privacy;r record;begin
 select * into p from private.s4_privacy where id=p_id for update;
 if not found or not private.goos_s4_privacy(p.id,true) then raise exception 'not_found' using errcode='P0002';end if;
 if p.version is distinct from p_version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_action='stop_sharing' then
  if not private.goos_owns_subject(p.subject_id) then raise exception 'not_found' using errcode='P0002';end if;
  for r in select a.id,a.version,a.organization_id from app.applications a where a.subject_id=p.subject_id and exists(select 1 from app.resource_shares s where s.application_id=a.id and s.status='active') order by a.id loop
   perform public.goos_s3_transition(r.id,'revoke_share',r.version,'user_requested',array[]::text[]);
   insert into private.s4_cessations(subject_id,resource_kind,resource_id,recipient_org_id) values(p.subject_id,'application',r.id,r.organization_id) on conflict do nothing;
  end loop;
  for r in select id,version from private.s4_referrals where subject_id=p.subject_id and share_active order by id loop perform public.goos_s4_referral_action(r.id,'revoke',r.version,null);end loop;
 elsif p_action='complete_correction' then
  if not private.goos_owns_subject(p.subject_id) or p.kind<>'correct' or p.state<>'approved' or p.profile_version>=(select version from app.subjects where id=p.subject_id) then raise exception 'correction_not_applied' using errcode='40001';end if;
  update private.s4_privacy set state='completed' where id=p.id;
 else
  if p.officer_id is distinct from private.goos_uid() or p.assignment_expires_at<=now() or not private.goos_s4_scope('privacy') then raise exception 'not_found' using errcode='P0002';end if;
  if p_action='verify_identity' then
   if p_reason is null or p_reason not in('authenticated_session_review','assisted_verified') or p.state<>'submitted' then raise exception 'invalid_input' using errcode='22023';end if;
   update private.s4_privacy set identity_verified_at=now(),identity_reason=p_reason,state='in_review' where id=p.id;
  elsif p_action='hold' then
   if p_reason is null or p_reason not in('active_investigation','legal_obligation') or p.identity_verified_at is null then raise exception 'invalid_input' using errcode='22023';end if;
   update private.s4_privacy set hold_code=p_reason,state='on_hold' where id=p.id;
  elsif p_action='release_hold' then
   if p.hold_code is null then raise exception 'invalid_transition' using errcode='40001';end if;
   update private.s4_privacy set hold_code=null,state='in_review' where id=p.id;
  elsif p_action='approve' then
   if p.identity_verified_at is null or p.hold_code is not null or p.state<>'in_review' then raise exception 'identity_or_hold_conflict' using errcode='40001';end if;
   update private.s4_privacy set state=case when kind='delete' then 'awaiting_policy' else 'approved' end where id=p.id;
  elsif p_action='decline' then
   if p.identity_verified_at is null or p.state not in('in_review','on_hold') then raise exception 'invalid_transition' using errcode='40001';end if;
   update private.s4_privacy set state='declined' where id=p.id;
  else raise exception 'policy_required_no_purge' using errcode='22023';end if;
 end if;
 update private.s4_privacy set version=version+1 where id=p.id;
 insert into private.s4_events(kind,resource_id,actor_id,action) values('privacy',p.id,private.goos_uid(),p_action);perform private.goos_audit('privacy.'||p_action,p.id);
end $$;
create function public.goos_s4_export(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.s4_privacy;v jsonb;begin
 select * into p from private.s4_privacy where id=p_id;
 if not found or not private.goos_owns_subject(p.subject_id) or p.kind not in('access','export') or p.state<>'approved' or p.identity_verified_at is null then raise exception 'not_found' using errcode='P0002';end if;
 v:=jsonb_build_object('schema_version',1,'generated_at',now(),'subject',(select jsonb_build_object('display_alias',display_alias,'country_code',country_code,'coarse_region',coarse_region,'age_band',age_band,'safe_contact',safe_contact,'version',version) from app.subjects where id=p.subject_id),
 'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'state',a.state,'organization_id',a.organization_id,'package',private.goos_s3_decrypt(k.encrypted_payload))),'[]') from app.applications a join private.application_packages k on k.application_id=a.id where a.subject_id=p.subject_id),
 'referrals',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'state',r.state,'share_active',r.share_active,'recipient_org_id',r.recipient_org_id,'package',private.goos_s3_decrypt(k.encrypted_payload))),'[]') from private.s4_referrals r left join private.s4_packages k on k.referral_id=r.id where r.subject_id=p.subject_id),
 'cessations',(select coalesce(jsonb_agg(jsonb_build_object('resource_kind',resource_kind,'resource_id',resource_id,'recipient_org_id',recipient_org_id,'status',status)),'[]') from private.s4_cessations where subject_id=p.subject_id),
 'outcomes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'tier',tier,'state',state,'confirmed',confirmed,'corrects_id',corrects_id,'version',version)),'[]') from private.s4_outcomes where subject_id=p.subject_id));
 perform private.goos_audit('privacy.exported',p.id);return v;
end $$;
create function public.goos_s4_cessations() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'resource_kind',resource_kind,'resource_id',resource_id,'recipient_org_id',recipient_org_id,'status',status,'can_ack',private.goos_s3_routing(recipient_org_id)) order by created_at desc),'[]') from(select * from private.s4_cessations order by created_at desc limit 100)x;
$$;
create function public.goos_s4_cessation_ack(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p private.s4_cessations;begin
 select * into p from private.s4_cessations where id=p_id for update;
 if not found or not private.goos_s3_routing(p.recipient_org_id) then raise exception 'not_found' using errcode='P0002';end if;
 update private.s4_cessations set status='acknowledged',acknowledged_by=private.goos_uid() where id=p.id;perform private.goos_audit('privacy.cessation.acknowledged',p.id,p.recipient_org_id);
end $$;
create function public.goos_s4_report_create(p_kind text,p_body text,p_org uuid default null,p_accused uuid default null,p_appeal uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();r private.s4_reports;begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_kind is null or p_kind not in('service','safety') or p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'invalid_input' using errcode='22023';end if;
 if(select count(*) from private.s4_reports where reporter_id=private.goos_uid() and created_at>now()-interval '1 day')>=10 then raise exception 'report_limit' using errcode='22023';end if;
 if p_appeal is not null then
  select * into r from private.s4_reports where id=p_appeal;
  if not found or r.reporter_id<>private.goos_uid() or r.state not in('resolved','dismissed') then raise exception 'not_found' using errcode='P0002';end if;
  p_org:=r.organization_id;p_accused:=r.accused_id;p_kind:=r.kind;
 end if;
 insert into private.s4_reports(id,reporter_id,organization_id,accused_id,kind,encrypted_body,appeal_of) values(v_id,private.goos_uid(),p_org,p_accused,p_kind,private.goos_s3_encrypt(jsonb_build_object('body',trim(p_body))),p_appeal);
 insert into private.s4_events(kind,resource_id,actor_id,action) values('reports',v_id,private.goos_uid(),case when p_appeal is null then 'submitted' else 'appealed' end);perform private.goos_audit('report.submitted',v_id);return v_id;
end $$;
create function public.goos_s4_report_action(p_id uuid,p_action text,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare r private.s4_reports;begin
 select * into r from private.s4_reports where id=p_id for update;
 if not found or not private.goos_s4_report(r.id,true) or r.officer_id is distinct from private.goos_uid() or r.assignment_expires_at<=now() or not private.goos_s4_scope('safety') or r.accused_id=private.goos_uid() or r.reporter_id=private.goos_uid() then raise exception 'not_found' using errcode='P0002';end if;
 if r.version is distinct from p_version then raise exception 'state_conflict' using errcode='40001';end if;
 if not((p_action='review' and r.state='submitted') or(p_action in('resolve','dismiss') and r.state='in_review')) then raise exception 'invalid_transition' using errcode='40001';end if;
 update private.s4_reports set state=case p_action when 'review' then 'in_review' when 'resolve' then 'resolved' else 'dismissed' end,version=version+1 where id=r.id;
 insert into private.s4_events(kind,resource_id,actor_id,action) values('reports',r.id,private.goos_uid(),p_action);perform private.goos_audit('report.'||p_action,r.id);
end $$;
-- Operator-only restore replay; no recipient payload or arbitrary SQL input.
create function private.goos_s4_replay_withdrawals(p_ledger jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb;v integer:=0;begin
 if p_ledger is null or jsonb_typeof(p_ledger)<>'array' or jsonb_array_length(p_ledger)>10000 then raise exception 'invalid_input';end if;
 for item in select * from jsonb_array_elements(p_ledger) loop
  update private.s4_referrals set share_active=false,version=version+1,updated_at=now() where id=(item->>'referral_id')::uuid and subject_id=(item->>'subject_id')::uuid and share_active;
  if found then v:=v+1;end if;
 end loop;return v;
end $$;
revoke all on function private.goos_s4_replay_withdrawals(jsonb) from public,anon,authenticated,goos_api,goos_authz,goos_worker;
