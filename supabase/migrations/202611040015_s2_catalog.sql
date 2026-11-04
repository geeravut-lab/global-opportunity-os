-- Approved revision เท่านั้นออก public; ทุก read ตรวจเวลา/องค์กร ไม่พึ่ง cron หรือ cache
create table app.opportunities (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references app.organizations(id),
 state text not null default 'draft' check(state in('draft','in_review','published','changes_requested','paused','archived')),
 approved_revision_id uuid,version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create function private.goos_s2_rules_valid(p_rules jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb;f text;op text;v jsonb;begin
 if p_rules is null or jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)>12 then return false;end if;
 for r in select * from jsonb_array_elements(p_rules) loop
  if jsonb_typeof(r)<>'object' or not(r ?& array['field','op','value']) or (r-array['field','op','value'])<>'{}' then return false;end if;
  f:=r->>'field';op:=r->>'op';v:=r->'value';
  if f in('country','region','language') then
   if op='eq' then if jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 80 then return false;end if;
   elsif op='in' then
    if jsonb_typeof(v)<>'array' or jsonb_array_length(v) not between 1 and 20 then return false;end if;
    if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 80) then return false;end if;
   else return false;end if;
  elsif f in('adult','remote') then if op<>'eq' or jsonb_typeof(v)<>'boolean' then return false;end if;
  elsif f='hours' then if op not in('gte','lte') or jsonb_typeof(v)<>'number' or not((v#>>'{}')::numeric between 0 and 168) then return false;end if;
  else return false;end if;
 end loop;return true;
exception when others then return false;end $$;
revoke all on function private.goos_s2_rules_valid(jsonb) from public,anon,authenticated;
grant execute on function private.goos_s2_rules_valid(jsonb) to goos_api,goos_authz;
create table app.opportunity_revisions (
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references app.opportunities(id),
 revision_no integer not null check(revision_no>0),created_by uuid not null references app.accounts(id),
 title_th text not null check(length(trim(title_th)) between 1 and 160),title_en text not null check(length(trim(title_en)) between 1 and 160),
 description_th text not null check(length(trim(description_th)) between 1 and 2000),description_en text not null check(length(trim(description_en)) between 1 and 2000),
 category text not null check(category in('jobs','skills','access','community')),
 country_code text not null check(country_code ~ '^[A-Z]{2}$'),coarse_region text not null default '' check(length(coarse_region)<=80),
 languages text[] not null check(cardinality(languages) between 1 and 10 and languages<@array['th','en']::text[]),remote boolean not null,
 cost_amount numeric(12,2) not null check(cost_amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),
 accessibility_th text not null check(length(accessibility_th) between 1 and 500),accessibility_en text not null check(length(accessibility_en) between 1 and 500),
 source_url text not null check(source_url ~ '^https://[^/@[:space:]]+(\.[^/@[:space:]]+)(/[^[:space:]]*)?$' and length(source_url)<=500),
 valid_until timestamptz not null,capacity integer check(capacity>=0),
 job_pay_min numeric(12,2),job_pay_max numeric(12,2),job_pay_unit text,job_contract text,
 rule_version integer not null default 1 check(rule_version=1),rules jsonb not null default '[]' check(private.goos_s2_rules_valid(rules)),
 created_at timestamptz not null default now(),unique(opportunity_id,revision_no),unique(id,opportunity_id),
 check(valid_until>created_at),check(category<>'jobs' or cost_amount=0 and job_pay_min is not null and job_pay_max is not null and job_pay_unit is not null and job_contract is not null and job_pay_min>0 and job_pay_max>=job_pay_min and job_pay_unit in('hour','day','month') and length(job_contract) between 1 and 80)
);
alter table app.opportunities add constraint current_revision_same_listing foreign key(approved_revision_id,id) references app.opportunity_revisions(id,opportunity_id);
create table private.catalog_reviews (
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null,revision_id uuid,
 actor_id uuid not null,decision text not null check(decision in('publish','request_changes','pause','archive')),
 reason text not null check(length(trim(reason)) between 1 and 500),occurred_at timestamptz not null default now()
);
create trigger revision_immutable before update or delete or truncate on app.opportunity_revisions for each statement execute function private.goos_audit_immutable();
create trigger catalog_review_immutable before update or delete or truncate on private.catalog_reviews for each statement execute function private.goos_audit_immutable();

create function private.goos_s2_public_listing(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.opportunities p join app.organizations o on o.id=p.organization_id join app.opportunity_revisions r on r.id=p.approved_revision_id and r.opportunity_id=p.id
 where p.id=p_id and p.state='published' and o.status='verified' and o.verification_expires_at>now() and r.valid_until>now() and exists(select 1 from private.catalog_reviews cr where cr.opportunity_id=p.id and cr.revision_id=r.id and cr.decision='publish' and cr.actor_id<>r.created_by));
$$;
alter table app.opportunities enable row level security;
alter table app.opportunity_revisions enable row level security;
alter table private.catalog_reviews enable row level security;
grant select on app.opportunities,app.opportunity_revisions,private.catalog_reviews to goos_authz;
create policy catalog_review_authz on private.catalog_reviews for select to goos_authz using(true);
create policy opportunity_authz on app.opportunities for select to goos_authz using(true);
create policy revision_authz on app.opportunity_revisions for select to goos_authz using(true);
grant create on schema private to goos_authz;
alter function private.goos_s2_public_listing(uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s2_public_listing(uuid) from public,anon,authenticated;
grant execute on function private.goos_s2_public_listing(uuid) to goos_api;
create policy org_public_read on app.organizations for select to goos_api using(status='verified' and verification_expires_at>now());
create policy opportunity_read on app.opportunities for select to goos_api using(private.goos_s2_public_listing(id) or private.goos_s2_editor(organization_id) or private.goos_s2_reviewer(organization_id));
create policy opportunity_insert on app.opportunities for insert to goos_api with check(private.goos_s2_editor(organization_id));
create policy opportunity_update on app.opportunities for update to goos_api using(private.goos_s2_editor(organization_id) or private.goos_s2_reviewer(organization_id)) with check(private.goos_s2_editor(organization_id) or private.goos_s2_reviewer(organization_id));
create policy revision_read on app.opportunity_revisions for select to goos_api using(exists(select 1 from app.opportunities p where p.id=opportunity_id and(p.approved_revision_id=opportunity_revisions.id or private.goos_s2_editor(p.organization_id) or private.goos_s2_reviewer(p.organization_id))));
create policy revision_insert on app.opportunity_revisions for insert to goos_api with check(created_by=private.goos_uid() and exists(select 1 from app.opportunities p where p.id=opportunity_id and private.goos_s2_editor(p.organization_id)));
create policy catalog_review_read on private.catalog_reviews for select to goos_api using(exists(select 1 from app.opportunities p where p.id=opportunity_id and(private.goos_s2_editor(p.organization_id) or private.goos_s2_reviewer(p.organization_id))));
create policy catalog_review_insert on private.catalog_reviews for insert to goos_api with check(actor_id=private.goos_uid() and exists(select 1 from app.opportunities p where p.id=opportunity_id and private.goos_s2_reviewer(p.organization_id)));
grant select,insert,update on app.opportunities to goos_api;
grant select,insert on app.opportunity_revisions,private.catalog_reviews to goos_api;
revoke all on app.opportunities,app.opportunity_revisions,private.catalog_reviews from public,anon,authenticated;
create trigger s2_catalog_signal after insert or update on app.opportunities for each row execute function private.goos_s2_org_signal();

create function public.goos_s2_save_listing(p_org uuid,p_id uuid,p_data jsonb,p_expected_version integer) returns uuid language plpgsql security definer set search_path='' as $$
declare o app.organizations;p app.opportunities;v_id uuid;v_revision integer;begin
 if not private.goos_s2_editor(p_org) then raise exception 'not_found' using errcode='P0002';end if;
 select * into o from app.organizations where id=p_org;
 if not found or o.status<>'verified' or o.verification_expires_at<=now() then raise exception 'organization_not_current' using errcode='22023';end if;
 if p_id is null then
  if p_expected_version is distinct from 0 then raise exception 'state_conflict' using errcode='40001';end if;
  insert into app.opportunities(organization_id) values(p_org) returning id into v_id;
 else
  select * into p from app.opportunities where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'not_found' using errcode='P0002';end if;
  if p.version is distinct from p_expected_version or p.state in('archived','in_review') then raise exception 'state_conflict' using errcode='40001';end if;
  v_id:=p.id;
 end if;
 select coalesce(max(revision_no),0)+1 into v_revision from app.opportunity_revisions where opportunity_id=v_id;
 insert into app.opportunity_revisions(opportunity_id,revision_no,created_by,title_th,title_en,description_th,description_en,category,country_code,coarse_region,languages,remote,cost_amount,currency,accessibility_th,accessibility_en,source_url,valid_until,capacity,job_pay_min,job_pay_max,job_pay_unit,job_contract,rules)
 values(v_id,v_revision,private.goos_uid(),p_data->>'title_th',p_data->>'title_en',p_data->>'description_th',p_data->>'description_en',p_data->>'category',p_data->>'country_code',coalesce(p_data->>'coarse_region',''),
 array(select jsonb_array_elements_text(p_data->'languages')),(p_data->>'remote')::boolean,(p_data->>'cost_amount')::numeric,p_data->>'currency',p_data->>'accessibility_th',p_data->>'accessibility_en',p_data->>'source_url',(p_data->>'valid_until')::timestamptz,(p_data->>'capacity')::integer,(p_data->>'job_pay_min')::numeric,(p_data->>'job_pay_max')::numeric,p_data->>'job_pay_unit',p_data->>'job_contract',coalesce(p_data->'rules','[]'));
 -- Material edit ไม่เปลี่ยน approved snapshot แต่หยุด public จนตรวจ revision ใหม่
 update app.opportunities set state='draft',version=version+1,updated_at=now() where id=v_id;
 perform private.goos_audit('catalog.draft',v_id,p_org);return v_id;
end $$;
create function public.goos_s2_submit_listing(p_id uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare p app.opportunities;begin
 select * into p from app.opportunities where id=p_id for update;
 if not found or not private.goos_s2_editor(p.organization_id) then raise exception 'not_found' using errcode='P0002';end if;
 if p.version is distinct from p_expected_version or p.state not in('draft','changes_requested','paused') then raise exception 'state_conflict' using errcode='40001';end if;
 if not exists(select 1 from app.organizations o where o.id=p.organization_id and o.status='verified' and o.verification_expires_at>now()) then raise exception 'organization_not_current' using errcode='22023';end if;
 update app.opportunities set state='in_review',version=version+1,updated_at=now() where id=p_id;
 perform private.goos_audit('catalog.submitted',p_id,p.organization_id);
end $$;
create function public.goos_s2_review_listing(p_id uuid,p_action text,p_reason text,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare p app.opportunities;r app.opportunity_revisions;v_state text;begin
 select * into p from app.opportunities where id=p_id for update;
 if not found or not private.goos_s2_reviewer(p.organization_id) then raise exception 'not_found' using errcode='P0002';end if;
 if p.version is distinct from p_expected_version then raise exception 'state_conflict' using errcode='40001';end if;
 select * into r from app.opportunity_revisions where opportunity_id=p_id order by revision_no desc limit 1;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid_reason' using errcode='22023';end if;
 v_state:=case when p.state='in_review' and p_action='publish' then 'published' when p.state='in_review' and p_action='request_changes' then 'changes_requested' when p.state='published' and p_action='pause' then 'paused' when p.state in('published','paused','changes_requested','draft') and p_action='archive' then 'archived' end;
 if v_state is null then raise exception 'state_conflict' using errcode='40001';end if;
 if v_state='published' and(r.created_by=private.goos_uid() or r.valid_until<=now() or not exists(select 1 from app.organizations where id=p.organization_id and status='verified' and verification_expires_at>now())) then raise exception 'not_current_or_independent' using errcode='22023';end if;
 update app.opportunities set state=v_state,approved_revision_id=case when v_state='published' then r.id else approved_revision_id end,version=version+1,updated_at=now() where id=p_id;
 insert into private.catalog_reviews(opportunity_id,revision_id,actor_id,decision,reason) values(p_id,r.id,private.goos_uid(),p_action,trim(p_reason));
 perform private.goos_audit('catalog.'||p_action,p_id,p.organization_id);
end $$;
create function public.goos_s2_listings(p_org uuid default null,p_review boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_staff_assured() or (p_review and not private.goos_platform_admin()) then raise exception 'not_found' using errcode='P0002';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'organization_id',p.organization_id,'state',p.state,'version',p.version,'revision',to_jsonb(r)-'created_by') order by p.updated_at desc),'[]')
 from app.opportunities p join lateral(select * from app.opportunity_revisions where opportunity_id=p.id order by revision_no desc limit 1) r on true
 where(p_org is null or p.organization_id=p_org) and case when p_review then private.goos_s2_reviewer(p.organization_id) else private.goos_s2_editor(p.organization_id) end);
end $$;
create function public.goos_s2_catalog(p_filter jsonb default '{}',p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_page integer;v_q text;result jsonb;begin
 v_page:=coalesce((p_filter->>'page')::integer,1);
 if v_page not between 1 and 100 or length(coalesce(p_filter->>'q',''))>100 or length(coalesce(p_filter->>'access',''))>80 or length(coalesce(p_filter->>'region',''))>80 or jsonb_typeof(p_filter)<>'object' then raise exception 'invalid_filter' using errcode='22023';end if;
 v_q:=replace(replace(replace(lower(normalize(coalesce(p_filter->>'q',''),NFKC)),'!','!!'),'%','!%'),'_','!_');
 with visible as (
 select p.id,p.organization_id,p.version,p.approved_revision_id,r.*,o.display_name organization_name,o.verification_expires_at,
 (select max(occurred_at) from private.catalog_reviews cr where cr.revision_id=r.id and cr.decision='publish') reviewed_at
 from app.opportunities p join app.opportunity_revisions r on r.id=p.approved_revision_id join app.organizations o on o.id=p.organization_id
 where private.goos_s2_public_listing(p.id) and(p_id is null or p.id=p_id)
 and lower(normalize(r.title_th||' '||r.title_en||' '||r.description_th||' '||r.description_en,NFKC)) like '%'||v_q||'%' escape '!'
 and(coalesce(p_filter->>'category','')='' or r.category=p_filter->>'category')
 and(coalesce(p_filter->>'country','')='' or r.country_code=p_filter->>'country')
 and(coalesce(p_filter->>'region','')='' or r.coarse_region='' or r.coarse_region=p_filter->>'region')
 and(coalesce(p_filter->>'access','')='' or lower(r.accessibility_th||' '||r.accessibility_en) like '%'||replace(replace(replace(lower(p_filter->>'access'),'!','!!'),'%','!%'),'_','!_')||'%' escape '!')
 and(coalesce(p_filter->>'language','')='' or p_filter->>'language'=any(r.languages))
 and(coalesce(p_filter->>'remote','')='' or r.remote=(p_filter->>'remote')::boolean)
 and(coalesce(p_filter->>'free','')<>'true' or r.cost_amount=0)
 ), page_rows as(select * from visible order by created_at desc,opportunity_id limit 20 offset (v_page-1)*20)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
 'id',opportunity_id,'revision_id',approved_revision_id,'version',version,'synthetic',true,
 'organization_name',organization_name,'organization_expires_at',verification_expires_at,
 'title_th',title_th,'title_en',title_en,'description_th',description_th,'description_en',description_en,
 'category',category,'country_code',country_code,'coarse_region',coarse_region,'languages',languages,'remote',remote,
 'cost_amount',cost_amount,'currency',currency,'capacity',capacity,'accessibility_th',accessibility_th,'accessibility_en',accessibility_en,
 'source_url',source_url,'valid_until',valid_until,'reviewed_at',reviewed_at,'job_pay_min',job_pay_min,'job_pay_max',job_pay_max,'job_pay_unit',job_pay_unit,'job_contract',job_contract,'rule_version',rule_version,'rules',rules)) from page_rows),'[]'),
 'total',(select count(*) from visible),'page',v_page,'has_more',(select count(*) from visible)>v_page*20) into result;
 return result;
end $$;
-- Catalog RPC ภายในอ่าน publish metadata ผ่าน policy เช่นเดียวกับ editor/reviewer โดยไม่เผยเหตุผลใน DTO
create policy catalog_public_metadata on private.catalog_reviews for select to goos_api
 using(decision='publish' and private.goos_s2_public_listing(opportunity_id));

do $$declare f record;begin
 grant create on schema public to goos_api;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['goos_s2_save_listing','goos_s2_submit_listing','goos_s2_review_listing','goos_s2_listings','goos_s2_catalog']) loop
 execute format('alter function %s owner to goos_api',f.sig);execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to authenticated',f.sig);end loop;
 revoke create on schema public from goos_api;
end $$;
grant execute on function public.goos_s2_catalog(jsonb,uuid) to anon;
