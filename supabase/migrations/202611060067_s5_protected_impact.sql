create table private.impact_grants(id uuid primary key default gen_random_uuid(),account_id uuid not null references app.accounts(id),organization_id uuid references app.organizations(id),granted_by uuid not null references app.accounts(id),expires_at timestamptz not null,revoked_at timestamptz,check(account_id<>granted_by));
create unique index impact_active_grant on private.impact_grants(account_id,coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)) where revoked_at is null;
create table private.impact_snapshots(id uuid primary key default gen_random_uuid(),scope_key text not null,month date not null,metric_version integer not null default 1 check(metric_version=1),payload jsonb not null,fingerprint text not null,created_at timestamptz not null default now(),invalidated_at timestamptz,unique(scope_key,month,metric_version));
create table private.impact_snapshot_members(snapshot_id uuid not null references private.impact_snapshots(id),subject_id uuid not null references app.subjects(id),primary key(snapshot_id,subject_id));
alter table private.impact_grants enable row level security;
alter table private.impact_snapshots enable row level security;
alter table private.impact_snapshot_members enable row level security;
revoke all on private.impact_grants,private.impact_snapshots,private.impact_snapshot_members from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create function private.goos_impact_access(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_staff_assured() and exists(select 1 from private.impact_grants g where g.account_id=private.goos_uid() and g.organization_id is not distinct from p_org and g.revoked_at is null and g.expires_at>now()) and ((p_org is null and exists(select 1 from private.s4_staff_scopes g where g.account_id=private.goos_uid() and g.scope='impact' and g.revoked_at is null and g.expires_at>now())) or p_org is not null and exists(select 1 from app.organizations o where o.id=p_org and o.status='verified' and o.verification_expires_at>now()) and private.goos_has_org_role(p_org,array['owner','admin','supervisor']::text[]));
$$;
create function private.goos_impact_grant(p_account uuid,p_org uuid,p_expires timestamptz,p_grant boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() or p_account=private.goos_uid() or not exists(select 1 from app.accounts where id=p_account) then raise exception 'not_found' using errcode='P0002';end if;
 if p_grant is null or p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days' then raise exception 'invalid_input' using errcode='22023';end if;
 if p_grant and (not private.goos_recipient_active(p_account) or not exists(select 1 from auth.users where id=p_account and email_confirmed_at is not null) or not exists(select 1 from auth.mfa_factors where user_id=p_account and status='verified') or case when p_org is null then not exists(select 1 from private.s4_staff_scopes where account_id=p_account and scope='impact' and revoked_at is null and expires_at>now()) else not exists(select 1 from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id join app.organizations o on o.id=m.organization_id where m.account_id=p_account and m.organization_id=p_org and m.status='active' and r.role_code in('owner','admin','supervisor') and o.status='verified' and o.verification_expires_at>now()) end) then raise exception 'report_recipient_not_ready' using errcode='22023';end if;
 update private.impact_grants set revoked_at=now() where account_id=p_account and organization_id is not distinct from p_org and revoked_at is null;
 if p_grant then insert into private.impact_grants(account_id,organization_id,granted_by,expires_at) values(p_account,p_org,private.goos_uid(),p_expires);end if;
 perform private.goos_audit('impact.report.grant.changed',p_account);
end $$;
-- ผู้สนับสนุนภายนอกยังไม่มี grants หรือ contract; ไม่มี public/global report
create function private.goos_impact_scopes() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_staff_assured() or not(select impact from private.s5_release where singleton) then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('organization_id',g.organization_id,'name',coalesce(o.display_name,'Opp4All'),'expires_at',g.expires_at)),'[]') from private.impact_grants g left join app.organizations o on o.id=g.organization_id where g.account_id=private.goos_uid() and private.goos_impact_access(g.organization_id) and g.revoked_at is null and g.expires_at>now());
end $$;
create function private.goos_impact_report(p_org uuid,p_month date) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.impact_snapshots;v_fingerprint text;v_payload jsonb;v_members uuid[];v_key text:=coalesce(p_org::text,'platform');v_total integer;v_small boolean;
begin
 if not(select impact from private.s5_release where singleton) or not private.goos_impact_access(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 if p_month is null or extract(day from p_month)<>1 or p_month>=date_trunc('month',now() at time zone 'UTC')::date or p_month<date_trunc('month',now() at time zone 'UTC')::date-interval '24 months' then raise exception 'closed_month_required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('impact:'||v_key||':'||p_month::text,0));
 select * into s from private.impact_snapshots where scope_key=v_key and month=p_month and metric_version=1 for update;
 if s.invalidated_at is not null then return jsonb_build_object('state','invalidated','month',p_month,'metric_version',1,'reason','source_changed_no_reissue');end if;
 with eligible as materialized(
 select o.id,o.subject_id,o.organization_id,o.kind,o.version from private.s4_outcomes o
 join app.subjects u on u.id=o.subject_id and u.status='active' and u.age_band='adult'
 join app.accounts a on a.id=u.account_id and a.status='active' and a.auth_user_id is not null
 where (p_org is null or o.organization_id=p_org) and o.tier='L2' and o.state='verified' and o.reviewed_by is not null and o.reviewed_by<>o.reporter_id
 and o.occurred_at>=(p_month::timestamp at time zone 'UTC') and o.occurred_at<((p_month+interval '1 month')::timestamp at time zone 'UTC')
 and private.goos_s4_case_active(o.source_case_id,o.referral_case_id)
 and private.goos_s4_independent(o.reviewed_by,o.subject_id,o.organization_id)
 ), counts as(select k,count(distinct e.subject_id)::int n from unnest(array['service_delivered','job_started','skills_completed']) k left join eligible e on e.kind=k group by k),
 -- ตรวจทุก exact membership pattern และทุกองค์กรเพื่อไม่ให้ใช้ total/overlap/complement หาคนกลุ่มเล็ก
 patterns as(select subject_id,string_agg(distinct organization_id::text||':'||kind,',' order by organization_id::text||':'||kind) pattern from eligible group by subject_id),
 protected as(select count(*)::int n from patterns group by pattern union all select count(distinct subject_id)::int from eligible group by organization_id)
 select encode(sha256(convert_to(coalesce((select string_agg(id::text||':'||version::text,',' order by id) from eligible),''),'UTF8')),'hex'),
 coalesce((select array_agg(distinct subject_id) from eligible),'{}'::uuid[]),
 (select count(distinct subject_id)::int from eligible),
 exists(select 1 from counts where n between 1 and 9) or exists(select 1 from protected where n between 1 and 9),
 (select jsonb_object_agg(k,n) from counts) into v_fingerprint,v_members,v_total,v_small,v_payload;
 if s.id is not null then
  if s.fingerprint<>v_fingerprint then update private.impact_snapshots set invalidated_at=now() where id=s.id;return jsonb_build_object('state','invalidated','month',p_month,'metric_version',1,'reason','source_changed_no_reissue');end if;
  return s.payload;
 end if;
 if v_small or v_total between 1 and 9 then v_payload:=jsonb_build_object('service_delivered',null,'job_started',null,'skills_completed',null);v_total:=null;v_small:=true;end if;
 v_payload:=jsonb_build_object('state','available','scope',v_key,'month',p_month,'metric_version',1,'minimum_group',10,'suppressed',v_small,'people_total',v_total,'counts',v_payload,'measure','distinct_people_with_current_independently_verified_L2_outcomes','additive',false,'causal_claim',false,'privacy_model','fixed_cohort_k10_suppression_not_differential_privacy');
 insert into private.impact_snapshots(scope_key,month,payload,fingerprint) values(v_key,p_month,v_payload,v_fingerprint) returning * into s;
 insert into private.impact_snapshot_members(snapshot_id,subject_id) select s.id,unnest(v_members);
 return v_payload;
end $$;
create function public.goos_impact_grant(p_account uuid,p_org uuid,p_expires timestamptz,p_grant boolean) returns void language sql security definer set search_path='' as $$select private.goos_impact_grant(p_account,p_org,p_expires,p_grant);$$;
create function public.goos_impact_scopes() returns jsonb language sql security definer set search_path='' as $$select private.goos_impact_scopes();$$;
create function public.goos_impact_report(p_org uuid,p_month date) returns jsonb language sql security definer set search_path='' as $$select private.goos_impact_report(p_org,p_month);$$;
grant create on schema public to goos_api;
alter function public.goos_impact_grant(uuid,uuid,timestamptz,boolean) owner to goos_api;
alter function public.goos_impact_scopes() owner to goos_api;
alter function public.goos_impact_report(uuid,date) owner to goos_api;
revoke create on schema public from goos_api;
DO $$declare f record;begin
 for f in select p.oid::regprocedure sig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in('goos_impact_access','goos_impact_grant','goos_impact_scopes','goos_impact_report') and n.nspname in('private','public') loop
 execute format('revoke all on function %s from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter',f.sig);
 if f.nspname='public' then execute format('grant execute on function %s to authenticated',f.sig);elsif f.sig::text not like '%goos_impact_access%' then execute format('grant execute on function %s to goos_api',f.sig);end if;
 end loop;
end $$;
notify pgrst,'reload schema';

create function private.goos_impact_admin() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 return jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name)),'[]') from app.organizations where status='verified' and verification_expires_at>now()),'grants',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'account',account_id,'organization',organization_id,'expires',expires_at)),'[]') from private.impact_grants where revoked_at is null and expires_at>now()));
end $$;
create function public.goos_impact_admin() returns jsonb language sql security definer set search_path='' as $$select private.goos_impact_admin();$$;
grant create on schema public to goos_api;
alter function public.goos_impact_admin() owner to goos_api;
revoke create on schema public from goos_api;
revoke all on function private.goos_impact_admin(),public.goos_impact_admin() from public,anon,authenticated,goos_authz,goos_worker,goos_reporter;
grant execute on function private.goos_impact_admin() to goos_api;
grant execute on function public.goos_impact_admin() to authenticated;
create function private.goos_impact_snapshot_immutable() returns trigger language plpgsql set search_path='' as $$begin
 if (new.scope_key,new.month,new.metric_version,new.payload,new.fingerprint,new.created_at) is distinct from(old.scope_key,old.month,old.metric_version,old.payload,old.fingerprint,old.created_at) or old.invalidated_at is not null and new.invalidated_at is distinct from old.invalidated_at then raise exception 'immutable_snapshot' using errcode='42501';end if;return new;
end $$;
revoke all on function private.goos_impact_snapshot_immutable() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create trigger impact_snapshot_immutable before update on private.impact_snapshots for each row execute function private.goos_impact_snapshot_immutable();
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_purge_scrub(uuid,uuid,uuid)'::regprocedure);
 r:=replace(d,'delete from app.bookmarks','delete from private.navigator_usage where account_id=p_account;update private.impact_snapshots set invalidated_at=now() where invalidated_at is null and id in(select snapshot_id from private.impact_snapshot_members where subject_id=p_subject);delete from app.bookmarks');if r=d then raise exception 'S5 purge invalidation source mismatch';end if;execute r;
end $$;
notify pgrst,'reload schema';
-- Private revision signals only; no case contents or report counts enter Realtime messages.
create function private.goos_s5_report_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;v_org uuid;u uuid;begin
 if not(select impact from private.s5_release where singleton) and tg_table_name<>'s5_release' then return null;end if;
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name in('s4_outcomes','org_memberships') then v_org:=(r->>'organization_id')::uuid;elsif tg_table_name='organizations' then v_org:=(r->>'id')::uuid;end if;
 for u in select distinct g.account_id from private.impact_grants g join app.accounts a on a.id=g.account_id and a.status='active' where g.revoked_at is null and g.expires_at>now() and(v_org is null or g.organization_id is null or g.organization_id=v_org) order by g.account_id loop perform private.goos_live_bump(u);end loop;
 if tg_table_name='impact_grants' then perform private.goos_live_bump((r->>'account_id')::uuid);end if;
 return null;
end $$;
revoke all on function private.goos_s5_report_signal() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
DO $$declare t text;begin foreach t in array array['private.s5_release','private.impact_grants','private.s4_outcomes','app.resource_shares','app.subjects','app.accounts','app.organizations','app.org_memberships'] loop execute format('create trigger s5_report_signal after insert or update or delete on %s for each row execute function private.goos_s5_report_signal()',t);end loop;end $$;
create function private.goos_s5_tick() returns integer language plpgsql security definer set search_path='' as $$declare n integer;begin
 if not(select navigator from private.s5_release where singleton) then return 0;end if;
 delete from private.navigator_usage where window_at<now()-interval '1 day';get diagnostics n=row_count;return n;
end $$;
revoke all on function private.goos_s5_tick() from public,anon,authenticated,goos_api,goos_authz,goos_reporter;
grant execute on function private.goos_s5_tick() to goos_worker;
notify pgrst,'reload schema';
