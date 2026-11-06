-- C-35: immutable operational policy, named staff readiness and bounded rollout.
create table private.policy_versions(
 id uuid primary key default gen_random_uuid(),version integer not null default 1,
 state text not null default 'draft' check(state in('draft','published','retired')),
 definition jsonb not null,content_hash text not null,created_by uuid not null references app.accounts(id),
 created_at timestamptz not null default now(),published_by uuid references app.accounts(id),published_at timestamptz
);
create table private.policy_current(singleton boolean primary key default true check(singleton),policy_id uuid references private.policy_versions(id));
insert into private.policy_current values(true,null);
alter table private.s4_release add column mode text not null default 'owner_preview' check(mode in('off','owner_preview','enabled','synthetic'));
alter table private.policy_versions enable row level security;
alter table private.policy_current enable row level security;
revoke all on private.policy_versions,private.policy_current from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;

create function private.goos_policy_valid(d jsonb,p_publish boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;begin
 if jsonb_typeof(d) is distinct from 'object' or d is null or d-'controller_name'-'country_codes'-'privacy_contact'-'service_hours'-'notice_th'-'notice_en'-'legal_review_ack'-'retention'<>'{}'::jsonb then return false;end if;
 foreach k in array array['controller_name','privacy_contact','service_hours','notice_th','notice_en'] loop
  if jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>6000 then return false;end if;
 end loop;
 if jsonb_typeof(d->'country_codes') is distinct from 'array' or jsonb_array_length(d->'country_codes')>20 or exists(select 1 from jsonb_array_elements_text(d->'country_codes')x where x!~'^[A-Z]{2}$') then return false;end if;
 if jsonb_typeof(d->'legal_review_ack') is distinct from 'boolean' or jsonb_typeof(d->'retention') is distinct from 'object' then return false;end if;
 v:=d->'retention';if v-'draft_days'-'case_days'-'audit_days'-'verification_days'-'backup_target_days'-'request_days'-'share_days'<>'{}'::jsonb then return false;end if;
 foreach k in array array['draft_days','case_days','audit_days','verification_days','backup_target_days','request_days','share_days'] loop
  if jsonb_typeof(v->k) is distinct from 'number' or (v->>k)!~'^[0-9]{1,4}$' or (v->>k)::integer not between 1 and 3650 then return false;end if;
 end loop;
 if (v->>'request_days')::integer>30 or (v->>'share_days')::integer>90 then return false;end if;
 if p_publish and(not(d->>'legal_review_ack')::boolean or length(trim(d->>'controller_name'))<2 or length(trim(d->>'service_hours'))<5 or length(trim(d->>'notice_th'))<60 or length(trim(d->>'notice_en'))<60 or jsonb_array_length(d->'country_codes')=0 or (d->>'privacy_contact')!~'^(https://[^[:space:]]+|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+)$') then return false;end if;
 return true;
end $$;
revoke all on function private.goos_policy_valid(jsonb,boolean) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_policy_valid(jsonb,boolean) to goos_api;

create function private.goos_policy_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.policy_current c join private.policy_versions p on p.id=c.policy_id where p.state='published' and private.goos_policy_valid(p.definition,true));
$$;
create function private.goos_policy_roster_ready() returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from unnest(array['impact','privacy','safety']) s where not exists(
 select 1 from private.s4_staff_scopes g join app.accounts a on a.id=g.account_id join auth.users u on u.id=a.id
 where g.scope=s and g.revoked_at is null and g.expires_at>now() and a.status='active' and u.email_confirmed_at is not null
 and exists(select 1 from auth.mfa_factors f where f.user_id=a.id and f.status='verified')));
$$;
create or replace function private.goos_s4_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select enabled and case mode when 'owner_preview' then private.goos_platform_admin() when 'enabled' then private.goos_policy_ready() and private.goos_policy_roster_ready() when 'synthetic' then to_regclass('private.deployment_migrations') is null else false end from private.s4_release where singleton;
$$;
create function private.goos_policy_subject(p_subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when(select mode from private.s4_release where singleton)='enabled' then exists(
 select 1 from app.subjects s join private.policy_current c on true join private.policy_versions p on p.id=c.policy_id where s.id=p_subject and p.state='published' and s.country_code in(select jsonb_array_elements_text(p.definition->'country_codes'))) else true end;
$$;
create function private.goos_policy_ttl(p_key text) returns interval language sql stable security definer set search_path='' as $$
 select make_interval(days=>coalesce((select(p.definition->'retention'->>p_key)::integer from private.policy_current c join private.policy_versions p on p.id=c.policy_id where p.state='published'),case p_key when 'request_days' then 7 else 30 end));
$$;
revoke all on function private.goos_policy_ready(),private.goos_policy_roster_ready(),private.goos_policy_subject(uuid),private.goos_policy_ttl(text) from public,anon,authenticated,goos_reporter,goos_worker;
grant execute on function private.goos_policy_ready(),private.goos_policy_roster_ready(),private.goos_policy_subject(uuid),private.goos_policy_ttl(text) to goos_api,goos_authz;
alter table private.s4_referrals alter column expires_at set default now()+private.goos_policy_ttl('request_days');
alter table app.notice_versions drop constraint notice_versions_environment_check;
alter table app.notice_versions add constraint notice_versions_environment_check check(environment in('development','production'));

create function private.goos_policy_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 return jsonb_build_object('release',(select jsonb_build_object('enabled',enabled,'mode',mode) from private.s4_release where singleton),'policy_ready',private.goos_policy_ready(),'roster_ready',private.goos_policy_roster_ready(),
 'current',(select policy_id from private.policy_current where singleton),'versions',(select coalesce(jsonb_agg(to_jsonb(p) order by created_at desc),'[]') from(select * from private.policy_versions order by created_at desc limit 20)p),
 'roster',(select coalesce(jsonb_agg(jsonb_build_object('account_id',g.account_id,'scope',g.scope,'expires_at',g.expires_at,'active',a.status='active','mfa',exists(select 1 from auth.mfa_factors f where f.user_id=a.id and f.status='verified'))),'[]') from private.s4_staff_scopes g join app.accounts a on a.id=g.account_id where g.revoked_at is null and g.expires_at>now()));
end $$;
create function private.goos_policy_save(p_id uuid,p_version integer,d jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid:=coalesce(p_id,gen_random_uuid());begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 if not private.goos_policy_valid(d,false) then raise exception 'invalid_policy' using errcode='22023';end if;
 if p_id is null then insert into private.policy_versions(id,definition,content_hash,created_by) values(v,d,encode(sha256(convert_to(d::text,'UTF8')),'hex'),private.goos_uid());
 else update private.policy_versions set definition=d,content_hash=encode(sha256(convert_to(d::text,'UTF8')),'hex'),version=version+1 where id=p_id and version=p_version and state='draft';if not found then raise exception 'state_conflict' using errcode='40001';end if;end if;
 perform private.goos_audit('policy.draft.saved',v);return v;
end $$;
create function private.goos_policy_publish(p_id uuid,p_hash text) returns void language plpgsql security definer set search_path='' as $$
declare p private.policy_versions;l text;n uuid;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 perform pg_advisory_xact_lock(682491139);select * into p from private.policy_versions where id=p_id for update;
 if not found or p.state<>'draft' or p.content_hash is distinct from p_hash or not private.goos_policy_valid(p.definition,true) then raise exception 'policy_not_ready' using errcode='22023';end if;
 update private.policy_versions set state='retired' where id=(select policy_id from private.policy_current where singleton);
 update private.policy_versions set state='published',published_by=private.goos_uid(),published_at=now(),version=version+1 where id=p.id;
 update private.policy_current set policy_id=p.id where singleton;
 foreach l in array array['th','en'] loop
  n:=gen_random_uuid();insert into app.notice_versions(id,locale,version_label,body,content_hash,environment,purpose) values(n,l,'policy-'||p.id::text||'-'||l,p.definition->>('notice_'||l),encode(sha256(convert_to(p.definition->>('notice_'||l),'UTF8')),'hex'),'production','referral');
  update private.s4_current_notices set notice_id=n where locale=l;
 end loop;
 perform private.goos_audit('policy.published',p.id);update app.platform_settings set version=version+1 where singleton;
end $$;
create function private.goos_policy_release(p_mode text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 if p_mode is null or p_mode not in('off','owner_preview','enabled') then raise exception 'invalid_input' using errcode='22023';end if;
 if p_mode='enabled' and(not private.goos_policy_ready() or not private.goos_policy_roster_ready()) then raise exception 'policy_roster_not_ready' using errcode='22023';end if;
 update private.s4_release set enabled=p_mode<>'off',mode=p_mode where singleton;
 perform private.goos_audit('policy.release.'||p_mode,null);update app.platform_settings set version=version+1 where singleton;
end $$;
create function private.goos_policy_lookup(p_email text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 if p_email is null or length(p_email)>254 or p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_input' using errcode='22023';end if;
 return(select jsonb_build_object('account_id',a.id,'active',a.status='active','verified',u.email_confirmed_at is not null,'mfa',exists(select 1 from auth.mfa_factors f where f.user_id=a.id and f.status='verified')) from auth.users u join app.accounts a on a.id=u.id where lower(u.email)=lower(trim(p_email)));
end $$;
-- Public wrappers preserve user claims; privileged helpers require current MFA/admin on every call.
create function public.goos_policy_read() returns jsonb language sql security definer set search_path='' as $$select private.goos_policy_read();$$;
create function public.goos_policy_save(p_id uuid,p_version integer,p_definition jsonb) returns uuid language sql security definer set search_path='' as $$select private.goos_policy_save(p_id,p_version,p_definition);$$;
create function public.goos_policy_publish(p_id uuid,p_hash text) returns void language sql security definer set search_path='' as $$select private.goos_policy_publish(p_id,p_hash);$$;
create function public.goos_policy_release(p_mode text) returns void language sql security definer set search_path='' as $$select private.goos_policy_release(p_mode);$$;
create function public.goos_policy_lookup(p_email text) returns jsonb language sql security definer set search_path='' as $$select private.goos_policy_lookup(p_email);$$;
grant create on schema public to goos_api;
DO $$declare f record;d text;r text;begin
 for f in select p.oid::regprocedure sig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.proname in('goos_policy_read','goos_policy_save','goos_policy_publish','goos_policy_release','goos_policy_lookup') loop
  execute format('revoke all on function %s from public,anon,authenticated,goos_worker,goos_reporter',f.sig);
  if f.nspname='public' then execute format('alter function %s owner to goos_api',f.sig);execute format('grant execute on function %s to authenticated',f.sig);else execute format('grant execute on function %s to goos_api',f.sig);end if;
 end loop;
 d:=pg_get_functiondef('private.goos_s4_person_valid(uuid)'::regprocedure);r:=replace(d,'select exists(','select private.goos_policy_subject(p_subject) and exists(');if r=d then raise exception 'Policy person source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_s4_valid(uuid)'::regprocedure);r:=replace(d,'where r.id=p_id and','where r.id=p_id and private.goos_policy_subject(r.subject_id) and');if r=d then raise exception 'Policy referral source mismatch';end if;execute r;
 d:=pg_get_functiondef('public.goos_s4_preview(uuid,text[],jsonb,uuid)'::regprocedure);r:=replace(d,'now()+interval ''30 days''','now()+private.goos_policy_ttl(''share_days'')');if r=d then raise exception 'Policy share TTL source mismatch';end if;execute r;
end $$;
revoke create on schema public from goos_api;
notify pgrst,'reload schema';
