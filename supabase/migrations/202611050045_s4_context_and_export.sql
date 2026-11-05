-- Minimal scoped staff labels; no staff email or public beneficiary directory.
create function private.goos_s4_team(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.goos_s4_enabled() or not private.goos_s3_routing(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'account_id',m.account_id,'name',coalesce(s.display_alias,m.account_id::text),'roles',(select jsonb_agg(role_code) from app.org_member_roles where membership_id=m.id))),'[]') from app.org_memberships m left join app.subjects s on s.account_id=m.account_id where m.organization_id=p_org and m.status='active');
end $$;
grant create on schema private to goos_authz;
alter function private.goos_s4_team(uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_team(uuid) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_team(uuid) to goos_api;
create function public.goos_s4_team(p_org uuid) returns jsonb language sql security definer set search_path='' as $$select private.goos_s4_team(p_org);$$;
grant create on schema public to goos_api;
alter function public.goos_s4_team(uuid) owner to goos_api;
revoke create on schema public from goos_api;
revoke all on function public.goos_s4_team(uuid) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function public.goos_s4_team(uuid) to authenticated;
create or replace function public.goos_s4_sources() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_s4_enabled() then raise exception 's4_not_enabled' using errcode='42501';end if;
 return(select coalesce(jsonb_agg(x),'[]') from(
 select c.id,'source' type,private.goos_owns_subject(c.subject_id) own,r.title_th,r.title_en,c.organization_id,coalesce(o.display_name,r.title_en) organization_name from app.cases c join app.applications a on a.id=c.application_id join app.opportunity_revisions r on r.id=a.revision_id left join app.organizations o on o.id=c.organization_id where private.goos_owns_subject(c.subject_id) or private.goos_s4_source(c.id)
 union all select c.id,'destination',private.goos_owns_subject(c.subject_id),coalesce(o.display_name,''),coalesce(o.display_name,''),c.organization_id,coalesce(o.display_name,'') from private.s4_cases c left join app.organizations o on o.id=c.organization_id where private.goos_owns_subject(c.subject_id) or private.goos_s4_work(c.id))x);
end $$;
-- Extend the approved owner's export with owned data only, keeping internal notes/keys/auth rows out.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_s4_export(uuid)'::regprocedure);
 r:=replace(d,$s$perform private.goos_audit('privacy.exported',p.id);return v;$s$,$s$
 v:=v||jsonb_build_object(
 'assessment',(select to_jsonb(a)-'subject_id' from app.assessments a where subject_id=p.subject_id),
 'bookmarks',(select coalesce(jsonb_agg(jsonb_build_object('opportunity_id',opportunity_id,'created_at',created_at)),'[]') from app.bookmarks where subject_id=p.subject_id),
 'notification_preferences',(select jsonb_build_object('in_app',in_app,'email',email,'timezone',timezone) from app.notification_preferences where account_id=private.goos_uid()),
 'consent_history',(select coalesce(jsonb_agg(jsonb_build_object('purpose',purpose,'action',action,'notice_id',notice_version_id,'scopes',scopes,'occurred_at',occurred_at)),'[]') from private.consent_events where subject_id=p.subject_id),
 'additional_information',(select coalesce(jsonb_agg(jsonb_build_object('application_id',r.application_id,'package',private.goos_s3_decrypt(r.encrypted_payload))),'[]') from private.application_responses r join app.applications a on a.id=r.application_id where a.subject_id=p.subject_id),
 'shared_notes',(select coalesce(jsonb_agg(x),'[]') from(
  select n.id,private.goos_s3_decrypt(n.encrypted_body)->>'body' body,n.created_at from private.case_notes n join app.cases c on c.id=n.case_id where c.subject_id=p.subject_id and n.visibility='beneficiary_shared'
  union all select n.id,private.goos_s3_decrypt(n.encrypted_body)->>'body',n.created_at from private.s4_notes n join private.s4_cases c on c.id=n.case_id where c.subject_id=p.subject_id and n.visibility='beneficiary_shared')x),
 'privacy_requests',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'body',private.goos_s3_decrypt(encrypted_body)->>'body','created_at',created_at)),'[]') from private.s4_privacy where subject_id=p.subject_id),
 'my_reports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'body',private.goos_s3_decrypt(encrypted_body)->>'body','appeal_of',appeal_of,'created_at',created_at)),'[]') from private.s4_reports where reporter_id=private.goos_uid()));
 perform private.goos_audit('privacy.exported',p.id);return v;
 $s$);if r=d then raise exception 'S4 export extension source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_s4_scope(text)'::regprocedure);
 r:=replace(d,$s$select private.goos_staff_assured() and exists$s$,$s$select private.goos_staff_assured() and exists(select 1 from app.subjects where account_id=private.goos_uid() and age_band='adult' and status='active') and exists$s$);if r=d then raise exception 'S4 staff adult predicate mismatch';end if;execute r;
end $$;
-- Anonymous audit uses nullable actors in the append-only S4 event ledger.
create or replace function private.goos_s4_guest_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into private.s4_events(kind,resource_id,actor_id,action) values('reports',new.id,null,'anonymous.submitted');return null;end $$;
notify pgrst,'reload schema';
