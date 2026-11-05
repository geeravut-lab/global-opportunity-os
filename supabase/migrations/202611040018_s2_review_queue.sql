-- คิวงานแบ่งหน้าและ metadata batch เพื่อลด N+1 RPC โดยยังตรวจสิทธิ์ปัจจุบันทุกองค์กร
create index org_evidence_lookup on private.org_evidence(organization_id,created_at);
create index organization_queue on app.organizations(updated_at desc,id);
create index listing_queue on app.opportunities(updated_at desc,id);
create index catalog_publish_proof on private.catalog_reviews(revision_id,opportunity_id,occurred_at desc) where decision='publish';
drop function public.goos_s2_orgs(boolean);
create function public.goos_s2_orgs(p_review boolean default false,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_review and not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 if p_page is null or p_page not between 1 and 100 then raise exception 'invalid_page' using errcode='22023';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'display_name',o.display_name,'country_code',o.country_code,
 'status',case when o.status='verified' and o.verification_expires_at<=now() then 'expired' else o.status end,
 'stored_status',o.status,'version',o.version,'verification_expires_at',o.verification_expires_at,
 'can_manage',private.goos_s2_manager(o.id),'can_review',private.goos_s2_reviewer(o.id) and(o.status<>'in_review' or o.assigned_reviewer_id=private.goos_uid()) and(o.status<>'appealed' or private.goos_uid() is distinct from(select actor_id from private.org_review_events where organization_id=o.id and to_status in('rejected','suspended') order by occurred_at desc limit 1))) order by o.updated_at desc,o.id),'[]')
 from(select * from app.organizations source where case when p_review then private.goos_s2_reviewer(source.id) else private.goos_s2_editor(source.id) end order by updated_at desc,id limit 20 offset(p_page-1)*20)o);
end $$;
drop function public.goos_s2_listings(uuid,boolean);
create function public.goos_s2_listings(p_org uuid default null,p_review boolean default false,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_staff_assured() or(p_review and not private.goos_platform_admin()) then raise exception 'not_found' using errcode='P0002';end if;
 if p_page is null or p_page not between 1 and 100 then raise exception 'invalid_page' using errcode='22023';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'organization_id',p.organization_id,'state',p.state,'version',p.version,'revision',to_jsonb(r)-'created_by') order by p.updated_at desc,p.id),'[]')
 from(select * from app.opportunities source where(p_org is null or organization_id=p_org) and case when p_review then private.goos_s2_reviewer(organization_id) else private.goos_s2_editor(organization_id) end order by updated_at desc,id limit 20 offset(p_page-1)*20)p
 join lateral(select * from app.opportunity_revisions where opportunity_id=p.id order by revision_no desc limit 1)r on true);
end $$;
create function public.goos_s2_evidence_batch(p_orgs uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_staff_assured() then raise exception 'mfa_required' using errcode='42501';end if;
 if p_orgs is null or cardinality(p_orgs)>20 then raise exception 'invalid_input' using errcode='22023';end if;
 return(select coalesce(jsonb_object_agg(ids.id,coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'created_at',e.created_at,'inspection',e.inspection) order by e.created_at) from private.org_evidence e where e.organization_id=ids.id),'[]')),'{}') from(select distinct unnest(p_orgs)id)ids where private.goos_s2_manager(ids.id) or private.goos_s2_reviewer(ids.id));
end $$;
grant create on schema public to goos_api;
alter function public.goos_s2_orgs(boolean,integer) owner to goos_api;
alter function public.goos_s2_listings(uuid,boolean,integer) owner to goos_api;
alter function public.goos_s2_evidence_batch(uuid[]) owner to goos_api;
revoke all on function public.goos_s2_orgs(boolean,integer),public.goos_s2_listings(uuid,boolean,integer),public.goos_s2_evidence_batch(uuid[]) from public,anon,authenticated;
grant execute on function public.goos_s2_orgs(boolean,integer),public.goos_s2_listings(uuid,boolean,integer),public.goos_s2_evidence_batch(uuid[]) to authenticated;
revoke create on schema public from goos_api;
notify pgrst,'reload schema';
