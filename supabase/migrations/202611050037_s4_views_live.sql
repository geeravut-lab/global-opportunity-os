create table private.s4_release(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into private.s4_release values(true,false);alter table private.s4_release enable row level security;
revoke all on private.s4_release from public,anon,authenticated,goos_api,goos_authz,goos_worker;
create function private.goos_s4_enabled() returns boolean language sql stable security definer set search_path='' as $$select enabled from private.s4_release where singleton;$$;
revoke all on function private.goos_s4_enabled() from public,anon,authenticated,goos_worker;
grant execute on function private.goos_s4_enabled() to goos_api,goos_authz;
create function private.goos_s4_card(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r private.s4_referrals;o private.s4_outcomes;p private.s4_privacy;s private.s4_reports;v jsonb;begin
 if not private.goos_s4_visible(p_kind,p_id) then return null;end if;
 if p_kind='referrals' then
  select * into strict r from private.s4_referrals where id=p_id;
  v:=jsonb_build_object('state',case when r.state in('proposed','pending') and r.expires_at<=now() then 'expired' else r.state end,'version',r.version,'created_at',r.created_at,'title',(select display_name from app.organizations where id=r.recipient_org_id),'purpose',r.purpose,'can_consent',private.goos_owns_subject(r.subject_id) and r.state='proposed' and r.expires_at>now(),'can_revoke',private.goos_owns_subject(r.subject_id) and (r.share_active or r.state='proposed'),'can_accept',private.goos_s3_routing(r.recipient_org_id) and r.state='pending' and private.goos_s4_valid(r.id),'recipient_org_id',r.recipient_org_id,'share_active',r.share_active and r.share_expires_at>now(),'expires_at',r.expires_at);
 elsif p_kind='outcomes' then
  select * into strict o from private.s4_outcomes where id=p_id;
  v:=jsonb_build_object('state',o.state,'version',o.version,'created_at',o.created_at,'title',o.kind,'tier',o.tier,'confirmed',o.confirmed,'period_start',o.period_start,'period_end',o.period_end,'case_id',case when private.goos_s4_outcome(o.id,true) then coalesce(o.source_case_id,o.referral_case_id) end,'own',private.goos_owns_subject(o.subject_id),'reporter',o.reporter_id=private.goos_uid(),'can_review',o.reviewer_id=private.goos_uid() and o.review_expires_at>now() and private.goos_s4_scope('impact') and o.reporter_id<>private.goos_uid(),'can_assign',private.goos_platform_admin());
 elsif p_kind='privacy' then
  select * into strict p from private.s4_privacy where id=p_id;
  v:=jsonb_build_object('state',p.state,'version',p.version,'created_at',p.created_at,'title',p.kind,'own',private.goos_owns_subject(p.subject_id),'can_review',p.officer_id=private.goos_uid() and p.assignment_expires_at>now() and private.goos_s4_scope('privacy'),'can_assign',private.goos_platform_admin(),'identity_verified',p.identity_verified_at is not null,'hold',p.hold_code,'can_export',private.goos_owns_subject(p.subject_id) and p.kind in('access','export') and p.state='approved' and p.identity_verified_at is not null);
 else
  select * into strict s from private.s4_reports where id=p_id;
  v:=jsonb_build_object('state',s.state,'version',s.version,'created_at',s.created_at,'title',s.kind,'own',s.reporter_id=private.goos_uid(),'can_review',s.officer_id=private.goos_uid() and s.assignment_expires_at>now() and private.goos_s4_scope('safety'),'can_assign',private.goos_platform_admin(),'appeal_of',s.appeal_of);
 end if;
 return v||jsonb_build_object('id',p_id,'kind',p_kind,'can_view',private.goos_s4_visible(p_kind,p_id,true));
end $$;
create function public.goos_s4_list(p_kind text,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_kind is null or p_kind not in('referrals','outcomes','privacy','reports') or p_page is null or p_page not between 1 and 100 then raise exception 'invalid_input' using errcode='22023';end if;
 return(select coalesce(jsonb_agg(data order by created_at desc,id),'[]') from(select id,created_at,private.goos_s4_card(p_kind,id) data from(
 select id,created_at from private.s4_referrals where p_kind='referrals' union all select id,created_at from private.s4_outcomes where p_kind='outcomes' union all select id,created_at from private.s4_privacy where p_kind='privacy' union all select id,created_at from private.s4_reports where p_kind='reports') all_items where private.goos_s4_visible(p_kind,id) order by created_at desc,id limit 20 offset(p_page-1)*20) rows);
end $$;
create function public.goos_s4_detail(p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.s4_referrals;c private.s4_cases;o private.s4_outcomes;p private.s4_privacy;s private.s4_reports;v jsonb:='{}';begin
 if not private.goos_s4_visible(p_kind,p_id,true) then raise exception 'not_found' using errcode='P0002';end if;
 if p_kind='referrals' then
  select * into strict r from private.s4_referrals where id=p_id;select * into c from private.s4_cases where referral_id=r.id;
  v:=jsonb_build_object('package',case when private.goos_owns_subject(r.subject_id) or private.goos_s4_work(c.id) then(select private.goos_s3_decrypt(encrypted_payload) from private.s4_packages where referral_id=r.id) end,
   'case',case when c.id is not null then jsonb_build_object('id',c.id,'state',c.state,'version',c.version,'can_work',private.goos_s4_work(c.id),'can_assign',private.goos_s3_routing(c.organization_id)) end,
   'notes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'body',private.goos_s3_decrypt(encrypted_body)->>'body','visibility',visibility,'supersedes_id',supersedes_id) order by created_at),'[]') from private.s4_notes where case_id=c.id),
   'source_application',case when private.goos_owns_subject(r.subject_id) or private.goos_s4_source(r.source_case_id) then(select application_id from app.cases where id=r.source_case_id) end);
 elsif p_kind='outcomes' then
  select * into strict o from private.s4_outcomes where id=p_id;
  v:=jsonb_build_object('body',private.goos_s3_decrypt(o.encrypted_body)->>'body','occurred_at',o.occurred_at,'corrects_id',o.corrects_id,'evidence',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'hash',content_hash) order by created_at),'[]') from private.s4_evidence where outcome_id=o.id));
 elsif p_kind='privacy' then select * into strict p from private.s4_privacy where id=p_id;v:=jsonb_build_object('body',private.goos_s3_decrypt(p.encrypted_body)->>'body');
 else select * into strict s from private.s4_reports where id=p_id;v:=jsonb_build_object('body',private.goos_s3_decrypt(s.encrypted_body)->>'body');end if;
 perform private.goos_audit('s4.'||p_kind||'.read',p_id);
 return v||jsonb_build_object('row',private.goos_s4_card(p_kind,p_id),'events',(select coalesce(jsonb_agg(jsonb_build_object('action',action,'created_at',created_at) order by created_at),'[]') from private.s4_events where kind=p_kind and resource_id=p_id));
end $$;
create function public.goos_s4_sources() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from(
 select c.id,'source' type,private.goos_owns_subject(c.subject_id) own,coalesce(r.title_th,'') title_th,coalesce(r.title_en,'') title_en from app.cases c join app.applications a on a.id=c.application_id join app.opportunity_revisions r on r.id=a.revision_id where private.goos_owns_subject(c.subject_id) or private.goos_s4_source(c.id)
 union all select c.id,'destination',private.goos_owns_subject(c.subject_id),o.display_name,o.display_name from private.s4_cases c join app.organizations o on o.id=c.organization_id where private.goos_owns_subject(c.subject_id) or private.goos_s4_work(c.id)) x;
$$;
create function private.goos_s4_staff_list() returns jsonb language sql stable security definer set search_path='' as $$
 select case when private.goos_platform_admin() then(select coalesce(jsonb_agg(jsonb_build_object('account',g.account_id,'scope',g.scope,'expires_at',g.expires_at,'name',coalesce(s.display_alias,g.account_id::text))),'[]') from private.s4_staff_scopes g left join app.subjects s on s.account_id=g.account_id where g.revoked_at is null and g.expires_at>now()) else '[]'::jsonb end;
$$;
create function public.goos_s4_staff() returns jsonb language sql security definer set search_path='' as $$select private.goos_s4_staff_list();$$;
create function private.goos_s4_clock() returns text language sql stable security definer set search_path='' as $$
 select case when private.goos_s4_enabled() and private.goos_actor_active() then md5(coalesce((select string_agg(data,',' order by data) from(
 select private.goos_s4_card('referrals',id)::text data from private.s4_referrals where private.goos_s4_referral(id)
 union all select private.goos_s4_card('outcomes',id)::text from private.s4_outcomes where private.goos_s4_outcome(id)
 union all select private.goos_s4_card('privacy',id)::text from private.s4_privacy where private.goos_s4_privacy(id)
 union all select private.goos_s4_card('reports',id)::text from private.s4_reports where private.goos_s4_report(id)
 union all select c.id::text||':'||c.version::text||':'||private.goos_s4_work(c.id)::text from private.s4_cases c where private.goos_s4_referral(c.referral_id,true)
 union all select e.id::text||':'||e.status from private.s4_evidence e where private.goos_s4_outcome(e.outcome_id,true)
 union all select n.id::text from private.s4_notes n join private.s4_cases c on c.id=n.case_id where private.goos_s4_work(c.id) or n.visibility='beneficiary_shared' and private.goos_owns_subject(c.subject_id)
 union all select id::text||':'||status from private.s4_cessations where private.goos_owns_subject(subject_id) or private.goos_s3_routing(recipient_org_id)
 ) x),'')) else '' end;
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_card(text,uuid) owner to goos_authz;
alter function private.goos_s4_staff_list() owner to goos_authz;
alter function private.goos_s4_clock() owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_card(text,uuid),private.goos_s4_staff_list(),private.goos_s4_clock() from public,anon,authenticated,goos_worker;
grant execute on function private.goos_s4_card(text,uuid),private.goos_s4_staff_list(),private.goos_s4_clock() to goos_api;
-- Keep old S1/S2/S3 clocks and append S4; no PII in the fingerprint.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('public.goos_live_fingerprint()'::regprocedure);
 r:=replace(d,$s$(v_s3->>'digest'),$s$,$s$(v_s3->>'digest')||':'||private.goos_s4_clock(),$s$);
 if r=d then raise exception 'S4 live fingerprint source mismatch';end if;execute r;
end $$;
create function private.goos_s4_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text;v_id uuid;r private.s4_referrals;v_subject uuid;v_account uuid;v_officer uuid;v_scope text;v_old uuid;begin
 if tg_table_name='s4_referrals' then v_kind:='referrals';v_id:=new.id;
 elsif tg_table_name='s4_cases' or tg_table_name='s4_packages' then v_kind:='referrals';v_id:=new.referral_id;
 elsif tg_table_name='s4_notes' then select referral_id into v_id from private.s4_cases where id=new.case_id;v_kind:='referrals';
 elsif tg_table_name='s4_evidence' then v_kind:='outcomes';v_id:=new.outcome_id;
 elsif tg_table_name='s4_outcomes' then v_kind:='outcomes';v_id:=new.id;
 elsif tg_table_name='s4_privacy' then v_kind:='privacy';v_id:=new.id;
 elsif tg_table_name='s4_reports' then v_kind:='reports';v_id:=new.id;
 elsif tg_table_name='s4_staff_scopes' then perform private.goos_live_bump(new.account_id);return null;
 else select account_id into v_account from app.subjects where id=new.subject_id;perform private.goos_live_bump(v_account);return null;end if;
 if v_kind='referrals' then
  select * into r from private.s4_referrals where id=v_id;
  for v_account in select distinct u from(
   select account_id u from app.subjects where id=r.subject_id and not(tg_table_name='s4_notes' and to_jsonb(new)->>'visibility'='internal')
   union select m.account_id from private.s4_cases c join app.org_memberships m on m.id=c.membership_id where c.referral_id=r.id and m.status='active' and r.share_active and r.share_expires_at>now()
   union select m.account_id from app.case_assignments ca join app.org_memberships m on m.id=ca.membership_id where ca.case_id=r.source_case_id and ca.ends_at is null and m.status='active' and tg_table_name<>'s4_notes'
   union select m.account_id from app.org_memberships m join app.org_member_roles mr on mr.membership_id=m.id where m.organization_id=r.recipient_org_id and m.status='active' and mr.role_code in('owner','admin','supervisor') and r.state<>'proposed' and tg_table_name<>'s4_notes'
  ) x where u is not null order by u loop perform private.goos_live_bump(v_account);end loop;
  if tg_table_name='s4_cases' and tg_op='UPDATE' and old.membership_id is distinct from new.membership_id then select account_id into v_old from app.org_memberships where id=old.membership_id;perform private.goos_live_bump(v_old);end if;
 else
  if v_kind='outcomes' then select subject_id,reviewer_id,'impact' into v_subject,v_officer,v_scope from private.s4_outcomes where id=v_id;
  elsif v_kind='privacy' then select subject_id,officer_id,'privacy' into v_subject,v_officer,v_scope from private.s4_privacy where id=v_id;
  else select reporter_id,officer_id,'safety' into v_account,v_officer,v_scope from private.s4_reports where id=v_id;end if;
  if v_subject is not null then select account_id into v_account from app.subjects where id=v_subject;end if;
  if v_account is not null then perform private.goos_live_bump(v_account);end if;
  if v_officer is not null and exists(select 1 from private.s4_staff_scopes where account_id=v_officer and scope=v_scope and revoked_at is null and expires_at>now()) then perform private.goos_live_bump(v_officer);end if;
  if tg_op='UPDATE' and tg_table_name in('s4_outcomes','s4_privacy','s4_reports') then v_old:=coalesce((to_jsonb(old)->>'reviewer_id')::uuid,(to_jsonb(old)->>'officer_id')::uuid);if v_old is distinct from v_officer and v_old is not null then perform private.goos_live_bump(v_old);end if;end if;
 end if;return null;
end $$;
revoke all on function private.goos_s4_signal() from public,anon,authenticated,goos_api,goos_authz,goos_worker;
DO $$declare t text;f record;d text;begin
 foreach t in array array['s4_referrals','s4_packages','s4_cases','s4_notes','s4_outcomes','s4_evidence','s4_privacy','s4_reports','s4_staff_scopes','s4_cessations'] loop execute format('create trigger s4_live after insert or update on private.%I for each row execute function private.goos_s4_signal()',t);end loop;
 grant create on schema public to goos_api;
 for f in select p.oid::regprocedure sig,p.prolang,p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'goos_s4_%' loop
  if f.prolang=(select oid from pg_language where lanname='plpgsql') then
   d:=pg_get_functiondef(f.oid);d:=regexp_replace(d,'\mbegin\M','begin if not private.goos_s4_enabled() then raise exception ''s4_not_enabled'' using errcode=''42501'';end if;','i');execute d;
  end if;
  execute format('alter function %s owner to goos_api',f.sig);execute format('revoke all on function %s from public,anon,authenticated,goos_worker',f.sig);execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
 revoke create on schema public from goos_api;
end $$;
notify pgrst,'reload schema';
