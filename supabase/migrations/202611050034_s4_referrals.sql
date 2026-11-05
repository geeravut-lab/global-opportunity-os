create function public.goos_s4_access(p_kind text,p_id uuid) returns boolean language sql security definer set search_path='' as $$select private.goos_s4_visible(p_kind,p_id,true);$$;
create function public.goos_s4_notice(p_locale text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',id,'body',body,'hash',content_hash,'version',version_label,'environment',environment) from app.notice_versions where locale=p_locale and purpose='referral' and private.goos_actor_active() order by id desc limit 1;
$$;
create function public.goos_s4_propose(p_case uuid,p_opportunity uuid,p_purpose text) returns uuid language plpgsql security definer set search_path='' as $$
declare c app.cases;r app.opportunity_revisions;v uuid;begin
 select * into c from app.cases where id=p_case;
 if not found or not(private.goos_owns_subject(c.subject_id) or private.goos_s4_source(c.id)) then raise exception 'not_found' using errcode='P0002';end if;
 if p_purpose is null or p_purpose not in('service_support','work_support') or c.state='cancelled' or not exists(select 1 from app.subjects s join app.accounts u on u.id=s.account_id where s.id=c.subject_id and s.status='active' and s.age_band='adult' and u.status='active') then raise exception 'invalid_input' using errcode='22023';end if;
 if not private.goos_s2_public_listing(p_opportunity) then raise exception 'listing_changed' using errcode='40001';end if;
 select v.* into strict r from app.opportunity_revisions v join app.opportunities p on p.approved_revision_id=v.id where p.id=p_opportunity;
 if c.organization_id=(select organization_id from app.opportunities where id=p_opportunity) then raise exception 'same_organization' using errcode='22023';end if;
 if(select count(*) from private.s4_referrals where proposed_by=private.goos_uid() and created_at>now()-interval '1 day')>=50 then raise exception 'request_limit' using errcode='22023';end if;
 insert into private.s4_referrals(source_case_id,subject_id,source_org_id,recipient_org_id,opportunity_id,revision_id,proposed_by,purpose)
 select c.id,c.subject_id,c.organization_id,p.organization_id,p.id,r.id,private.goos_uid(),p_purpose from app.opportunities p where p.id=p_opportunity returning id into v;
 insert into private.s4_events(kind,resource_id,actor_id,action) values('referrals',v,private.goos_uid(),'proposed');perform private.goos_audit('referral.proposed',v,c.organization_id);return v;
end $$;
create function public.goos_s4_preview(p_id uuid,p_fields text[],p_skills jsonb,p_notice uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.s4_referrals;s app.subjects;v jsonb;v_id uuid:=gen_random_uuid();v_hash text;v_assessment integer;v_source integer;begin
 select * into r from private.s4_referrals where id=p_id;
 if not found or not private.goos_owns_subject(r.subject_id) then raise exception 'not_found' using errcode='P0002';end if;
 if r.state<>'proposed' or r.expires_at<=now() or not private.goos_s2_public_listing(r.opportunity_id) or r.revision_id is distinct from(select approved_revision_id from app.opportunities where id=r.opportunity_id) then raise exception 'referral_changed' using errcode='40001';end if;
 if not private.goos_s3_fields(p_fields) or not exists(select 1 from app.notice_versions where id=p_notice and purpose='referral') then raise exception 'invalid_input' using errcode='22023';end if;
 if(select count(*) from private.s4_previews where actor_id=private.goos_uid() and expires_at>now()-interval '1 day')>=100 then raise exception 'preview_limit' using errcode='22023';end if;
 select * into strict s from app.subjects where id=r.subject_id;select version into v_assessment from app.assessments where subject_id=r.subject_id and confirmed_at is not null;
 select version into v_source from app.applications where id=(select application_id from app.cases where id=r.source_case_id);
 v:=jsonb_build_object('recipient',jsonb_build_object('id',r.recipient_org_id,'name',(select display_name from app.organizations where id=r.recipient_org_id)), 'purpose',r.purpose,'fields',(select jsonb_agg(f order by f) from(select distinct unnest(p_fields)f)x),'values',private.goos_s3_payload(r.subject_id,p_fields,p_skills),
 'notice_id',p_notice,'notice_hash',(select content_hash from app.notice_versions where id=p_notice),'referral_id',r.id,'revision_id',r.revision_id,'subject_version',s.version,'assessment_version',v_assessment,'request_expires_at',r.expires_at,'share_expires_at',now()+interval '30 days');
 v_hash:=encode(sha256(convert_to(v::text,'UTF8')),'hex');
 insert into private.s4_previews(id,referral_id,actor_id,encrypted_payload,content_hash,notice_id,subject_version,assessment_version,referral_version,source_version) values(v_id,r.id,private.goos_uid(),private.goos_s3_encrypt(v),v_hash,p_notice,s.version,v_assessment,r.version,v_source);
 perform private.goos_audit('referral.preview',r.id);return jsonb_build_object('id',v_id,'hash',v_hash,'package',v,'expires_at',now()+interval '15 minutes');
end $$;
create function public.goos_s4_submit(p_preview uuid,p_hash text,p_notice uuid,p_confirmed boolean,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.s4_previews;r private.s4_referrals;i private.s4_idempotency;v_hash text;v jsonb;v_assessment integer;begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_confirmed is distinct from true or p_key is null or p_key!~'^[A-Za-z0-9_-]{8,80}$' then raise exception 'invalid_input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(private.goos_uid()::text||':s4.submit:'||p_key,0));
 v_hash:=encode(sha256(convert_to(jsonb_build_array(p_preview,p_hash,p_notice,p_confirmed)::text,'UTF8')),'hex');
 select * into i from private.s4_idempotency where actor_id=private.goos_uid() and route='referral.submit' and key=p_key;
 if found then if i.request_hash<>v_hash or not private.goos_s4_referral(i.resource_id,true) then raise exception 'idempotency_conflict' using errcode='40001';end if;return i.receipt;end if;
 select * into p from private.s4_previews where id=p_preview and actor_id=private.goos_uid();
 if not found then raise exception 'not_found' using errcode='P0002';end if;
 select * into strict r from private.s4_referrals where id=p.referral_id for update;
 if not private.goos_owns_subject(r.subject_id) then raise exception 'not_found' using errcode='P0002';end if;
 if p.expires_at<=now() or p.consumed_at is not null or p.content_hash is distinct from p_hash or p.notice_id is distinct from p_notice or r.version<>p.referral_version or r.state<>'proposed' or r.expires_at<=now() then raise exception 'preview_changed' using errcode='40001';end if;
 select version into v_assessment from app.assessments where subject_id=r.subject_id and confirmed_at is not null;
 if p.subject_version is distinct from(select version from app.subjects where id=r.subject_id) or p.assessment_version is distinct from v_assessment or p.source_version is distinct from(select version from app.applications where id=(select application_id from app.cases where id=r.source_case_id))
 or not private.goos_s2_public_listing(r.opportunity_id) or r.revision_id is distinct from(select approved_revision_id from app.opportunities where id=r.opportunity_id) then raise exception 'preview_changed' using errcode='40001';end if;
 v:=private.goos_s3_decrypt(p.encrypted_payload);
 insert into private.s4_packages(referral_id,actor_id,notice_id,encrypted_payload,content_hash,fields) values(r.id,private.goos_uid(),p.notice_id,p.encrypted_payload,p.content_hash,array(select jsonb_array_elements_text(v->'fields')));
 update private.s4_referrals set state='pending',share_active=true,share_expires_at=(v->>'share_expires_at')::timestamptz,version=version+1,updated_at=now() where id=r.id;
 update private.s4_previews set consumed_at=now() where id=p.id;
 insert into private.s4_events(kind,resource_id,actor_id,action) values('referrals',r.id,private.goos_uid(),'consented');perform private.goos_audit('referral.consented',r.id,r.recipient_org_id);
 v:=jsonb_build_object('id',r.id,'state','pending','version',r.version+1,'hash',p.content_hash);
 insert into private.s4_idempotency values(private.goos_uid(),'referral.submit',p_key,v_hash,r.id,v,now());return v;
end $$;
create function public.goos_s4_referral_action(p_id uuid,p_action text,p_version integer,p_member uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.s4_referrals;v_case uuid;begin
 select * into r from private.s4_referrals where id=p_id for update;
 if not found or not private.goos_s4_referral(r.id) then raise exception 'not_found' using errcode='P0002';end if;
 if p_action='accept' and r.state='accepted' and private.goos_s3_routing(r.recipient_org_id) then
  select id into v_case from private.s4_cases where referral_id=r.id and membership_id=p_member; if v_case is null then raise exception 'state_conflict' using errcode='40001';end if;return jsonb_build_object('id',r.id,'case_id',v_case,'version',r.version);end if;
 if p_version is distinct from r.version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_action in('cancel','revoke') then
  if not private.goos_owns_subject(r.subject_id) then raise exception 'not_found' using errcode='P0002';end if;
  if p_action='cancel' and r.state not in('proposed','pending') then raise exception 'invalid_transition' using errcode='40001';end if;
  update private.s4_referrals set state=case when state in('proposed','pending') then 'cancelled' else state end,share_active=false,version=version+1,updated_at=now() where id=r.id;
  insert into private.s4_withdrawals values(r.id,r.subject_id,private.goos_uid(),now()) on conflict do nothing;
  if r.share_active then insert into private.s4_cessations(subject_id,resource_kind,resource_id,recipient_org_id) values(r.subject_id,'referral',r.id,r.recipient_org_id) on conflict do nothing;end if;
 elsif p_action in('accept','decline') then
  if not private.goos_s3_routing(r.recipient_org_id) then raise exception 'not_found' using errcode='P0002';end if;
  if r.state<>'pending' or not private.goos_s4_valid(r.id) or not private.goos_s2_public_listing(r.opportunity_id) or r.revision_id is distinct from(select approved_revision_id from app.opportunities where id=r.opportunity_id) then raise exception 'referral_changed' using errcode='40001';end if;
  if p_action='accept' then
   if not private.goos_s4_member(p_member,r.recipient_org_id) then raise exception 'invalid_assignee' using errcode='22023';end if;
   insert into private.s4_cases(referral_id,subject_id,organization_id,membership_id) values(r.id,r.subject_id,r.recipient_org_id,p_member) returning id into v_case;
  end if;
  update private.s4_referrals set state=case when p_action='accept' then 'accepted' else 'declined' end,share_active=p_action='accept',version=version+1,updated_at=now() where id=r.id;
 elsif p_action='expire' then
  if not private.goos_owns_subject(r.subject_id) or r.expires_at>now() or r.state not in('proposed','pending') then raise exception 'invalid_transition' using errcode='40001';end if;
  update private.s4_referrals set state='expired',share_active=false,version=version+1,updated_at=now() where id=r.id;
 else raise exception 'invalid_input' using errcode='22023';end if;
 insert into private.s4_events(kind,resource_id,actor_id,action) values('referrals',r.id,private.goos_uid(),p_action);perform private.goos_audit('referral.'||p_action,r.id,r.recipient_org_id);
 return jsonb_build_object('id',r.id,'case_id',v_case,'version',r.version+1);
end $$;
create function public.goos_s4_case_action(p_id uuid,p_action text,p_version integer,p_member uuid default null,p_body text default null,p_visibility text default null,p_supersedes uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare c private.s4_cases;begin
 select * into c from private.s4_cases where id=p_id for update;
 if not found or not(private.goos_s4_work(c.id) or p_action='assign' and private.goos_s3_routing(c.organization_id)) then raise exception 'not_found' using errcode='P0002';end if;
 if c.version is distinct from p_version then raise exception 'state_conflict' using errcode='40001';end if;
 if p_action='assign' then
  if not private.goos_s3_routing(c.organization_id) or not private.goos_s4_member(p_member,c.organization_id) then raise exception 'not_found' using errcode='P0002';end if;
  update private.s4_cases set membership_id=p_member where id=c.id;
 elsif p_action='note' then
  if p_body is null or length(trim(p_body)) not between 1 and 2000 or p_visibility is null or p_visibility not in('internal','beneficiary_shared') then raise exception 'invalid_input' using errcode='22023';end if;
  if p_supersedes is not null and not exists(select 1 from private.s4_notes where id=p_supersedes and case_id=c.id and author_id=private.goos_uid() and visibility=p_visibility) then raise exception 'not_found' using errcode='P0002';end if;
  insert into private.s4_notes(case_id,author_id,visibility,encrypted_body,supersedes_id) values(c.id,private.goos_uid(),p_visibility,private.goos_s3_encrypt(jsonb_build_object('body',trim(p_body))),p_supersedes);
 else
  if not((p_action='start' and c.state='open') or(p_action='resolve' and c.state='in_progress') or(p_action='close' and c.state='resolved')) then raise exception 'invalid_transition' using errcode='40001';end if;
  update private.s4_cases set state=case p_action when 'start' then 'in_progress' when 'resolve' then 'resolved' else 'closed' end where id=c.id;
 end if;
 if p_action<>'note' or p_visibility='beneficiary_shared' then update private.s4_cases set version=version+1,updated_at=now() where id=c.id;end if;
 -- Internal notes do not publish subject/source-visible events.
 if p_action<>'note' or p_visibility='beneficiary_shared' then insert into private.s4_events(kind,resource_id,actor_id,action) values('referrals',c.referral_id,private.goos_uid(),'case.'||p_action);end if;
 perform private.goos_audit('referral.case.'||p_action,c.id,c.organization_id);
end $$;
