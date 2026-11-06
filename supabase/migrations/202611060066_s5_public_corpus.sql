-- S5 ปิด default; ใช้เฉพาะ revision สาธารณะที่มี independent catalog review
create table private.s5_release(singleton boolean primary key default true check(singleton),navigator boolean not null default false,impact boolean not null default false);
insert into private.s5_release(singleton) values(true);
create table private.navigator_documents(
 id uuid primary key default gen_random_uuid(),listing_id uuid not null references app.opportunities(id),revision_id uuid not null references app.opportunity_revisions(id),
 locale text not null check(locale in('th','en')),title text not null,quote text not null,source_url text not null,content_hash text not null,
 reviewed_at timestamptz not null,review_id uuid not null references private.catalog_reviews(id),expires_at timestamptz not null,indexed_at timestamptz not null default now(),
 unique(listing_id,revision_id,locale),check(length(quote)<=2800),check(content_hash~'^[a-f0-9]{64}$')
);
create trigger navigator_document_immutable before update or delete or truncate on private.navigator_documents for each statement execute function private.goos_audit_immutable();
create table private.navigator_usage(account_id uuid primary key references app.accounts(id),window_at timestamptz not null default now(),requests integer not null default 1);
alter table private.s5_release enable row level security;
alter table private.navigator_documents enable row level security;
alter table private.navigator_usage enable row level security;
revoke all on private.s5_release,private.navigator_documents,private.navigator_usage from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create function private.goos_s5_sources(p_filter jsonb,p_locale text,p_confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;doc private.navigator_documents;review private.catalog_reviews;result jsonb:='[]';r integer;
begin
 if not private.goos_actor_active() or p_confirmed is distinct from true or not(select navigator from private.s5_release where singleton) then raise exception 'not_found' using errcode='P0002';end if;
 if p_locale is null or p_locale not in('th','en') or jsonb_typeof(p_filter) is distinct from 'object' or (p_filter-array['category','country','language','remote','free'])<>'{}' then raise exception 'invalid_input' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(p_filter) e where jsonb_typeof(e.value)<>'string') or (p_filter?'category' and p_filter->>'category' not in('jobs','skills','access','community')) or (p_filter?'country' and p_filter->>'country' !~ '^[A-Z]{2}$') or (p_filter?'language' and p_filter->>'language' not in('th','en')) or (p_filter?'remote' and p_filter->>'remote'<>'true') or (p_filter?'free' and p_filter->>'free'<>'true') then raise exception 'invalid_input' using errcode='22023';end if;
 insert into private.navigator_usage(account_id) values(private.goos_uid()) on conflict(account_id) do update set window_at=case when private.navigator_usage.window_at<now()-interval '1 hour' then now() else private.navigator_usage.window_at end,requests=case when private.navigator_usage.window_at<now()-interval '1 hour' then 1 else private.navigator_usage.requests+1 end returning requests into r;
 if r>30 then raise exception 'budget_exhausted' using errcode='54000';end if;
 for item in select jsonb_build_object('id',p.id,'revision_id',r.id,'title_th',r.title_th,'title_en',r.title_en,'description_th',r.description_th,'description_en',r.description_en,'source_url',r.source_url,'valid_until',r.valid_until,'organization_expires_at',o.verification_expires_at)
 from app.opportunities p join app.opportunity_revisions r on r.id=p.approved_revision_id and r.opportunity_id=p.id join app.organizations o on o.id=p.organization_id
 where p.state='published' and o.status='verified' and o.verification_expires_at>now() and r.valid_until>now()
 and exists(select 1 from private.catalog_reviews cr where cr.opportunity_id=p.id and cr.revision_id=r.id and cr.decision='publish' and cr.actor_id<>r.created_by)
 and(not(p_filter?'category') or r.category=p_filter->>'category') and(not(p_filter?'country') or r.country_code=p_filter->>'country')
 and(not(p_filter?'language') or p_filter->>'language'=any(r.languages)) and(not(p_filter?'remote') or r.remote) and(not(p_filter?'free') or r.cost_amount=0)
 order by r.created_at desc,p.id limit 20 loop
  if coalesce(item->>('title_'||p_locale),'')||' '||coalesce(item->>('description_'||p_locale),'') ~* 'ignore[[:space:]]+(all[[:space:]]+)?(previous|prior)|system[[:space:]]*prompt|developer[[:space:]]*message|ลืมคำสั่ง|เพิกเฉย.*คำสั่ง' then continue;end if;
  select * into review from private.catalog_reviews where revision_id=(item->>'revision_id')::uuid and decision='publish' order by occurred_at desc limit 1;
  if review.id is null or not private.goos_s2_public_listing((item->>'id')::uuid) then continue;end if;
  insert into private.navigator_documents(listing_id,revision_id,locale,title,quote,source_url,content_hash,reviewed_at,review_id,expires_at)
  values((item->>'id')::uuid,(item->>'revision_id')::uuid,p_locale,item->>('title_'||p_locale),left(item->>('description_'||p_locale),2800),item->>'source_url',encode(sha256(convert_to(jsonb_build_object('revision',item->>'revision_id','locale',p_locale,'title',item->>('title_'||p_locale),'quote',item->>('description_'||p_locale),'url',item->>'source_url')::text,'UTF8')),'hex'),review.occurred_at,review.id,least((item->>'valid_until')::timestamptz,(item->>'organization_expires_at')::timestamptz)) on conflict(listing_id,revision_id,locale) do nothing;
  select * into doc from private.navigator_documents where listing_id=(item->>'id')::uuid and revision_id=(item->>'revision_id')::uuid and locale=p_locale;
  result:=result||jsonb_build_array(jsonb_build_object('id',doc.id,'listing_id',doc.listing_id,'revision_id',doc.revision_id,'title',doc.title,'quote',doc.quote,'url',doc.source_url,'hash',doc.content_hash,'locale',doc.locale,'expires_at',doc.expires_at,'reviewed_at',doc.reviewed_at));
 end loop;
 return result;
end $$;
create function private.goos_s5_resolve(p_ids uuid[],p_locale text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() or not(select navigator from private.s5_release where singleton) then raise exception 'not_found' using errcode='P0002';end if;
 if p_ids is null or cardinality(p_ids)>20 or p_locale is null or p_locale not in('th','en') then raise exception 'invalid_input' using errcode='22023';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'listing_id',d.listing_id,'revision_id',d.revision_id,'title',d.title,'quote',d.quote,'url',d.source_url,'hash',d.content_hash,'locale',d.locale,'expires_at',d.expires_at,'reviewed_at',d.reviewed_at)),'[]') from private.navigator_documents d join app.opportunities o on o.id=d.listing_id and o.approved_revision_id=d.revision_id where d.id=any(p_ids) and d.locale=p_locale and d.expires_at>now() and private.goos_s2_public_listing(d.listing_id));
end $$;
create function public.goos_s5_sources(p_filter jsonb,p_locale text,p_confirmed boolean) returns jsonb language sql security definer set search_path='' as $$select private.goos_s5_sources(p_filter,p_locale,p_confirmed);$$;
create function public.goos_s5_resolve(p_ids uuid[],p_locale text) returns jsonb language sql security definer set search_path='' as $$select private.goos_s5_resolve(p_ids,p_locale);$$;
grant create on schema public to goos_api;
alter function public.goos_s5_sources(jsonb,text,boolean) owner to goos_api;
alter function public.goos_s5_resolve(uuid[],text) owner to goos_api;
revoke create on schema public from goos_api;
revoke all on function private.goos_s5_sources(jsonb,text,boolean),private.goos_s5_resolve(uuid[],text),public.goos_s5_sources(jsonb,text,boolean),public.goos_s5_resolve(uuid[],text) from public,anon,authenticated,goos_authz,goos_worker,goos_reporter;
grant execute on function private.goos_s5_sources(jsonb,text,boolean),private.goos_s5_resolve(uuid[],text) to goos_api;
grant execute on function public.goos_s5_sources(jsonb,text,boolean),public.goos_s5_resolve(uuid[],text) to authenticated;
notify pgrst,'reload schema';
