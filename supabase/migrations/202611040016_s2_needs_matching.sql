-- Notice สำหรับ assessment แยกจาก profile; เป็น development wording ไม่ใช่นโยบายที่รับรองแล้ว
alter table app.notice_versions add column purpose text not null default 'profile' check(purpose in('profile','assessment'));
alter table app.notice_versions add constraint notice_id_purpose unique(id,purpose);
insert into app.notice_versions(id,locale,version_label,body,content_hash,environment,purpose) values
('00000000-0000-4000-8000-000000000101','th','dev-s2-needs-2026-11-05','ข้อมูลสมมติสำหรับทดสอบเท่านั้น คุณเลือกข้ามเป้าหมาย ประเทศ พื้นที่ ภาษา การเข้าร่วมออนไลน์ และเวลาที่สะดวกได้ เมื่อยืนยันจะบันทึกคำตอบในบัญชีของคุณเพื่อแสดงคำแนะนำด้วยกฎ คุณแก้ไขหรือยกเลิกการยืนยันได้ ไม่มีการส่งคำตอบให้องค์กรหรือสมัครบริการ การใช้งานข้อมูลจริงต้องมีนโยบายและระยะเก็บข้อมูลที่รับรองก่อน','pending','development','assessment'),
('00000000-0000-4000-8000-000000000102','en','dev-s2-needs-2026-11-05','Synthetic testing only. Goals, country, area, language, online participation and available hours are optional. Confirming saves your answers in your account for rule-based suggestions. You may edit or unconfirm them. No answers are shared with organizations and no application is submitted. Real data requires approved privacy and retention policies.','pending','development','assessment');
update app.notice_versions set content_hash=encode(sha256(convert_to(body,'UTF8')),'hex') where purpose='assessment';
create trigger notice_immutable before update or delete or truncate on app.notice_versions for each statement execute function private.goos_audit_immutable();
create or replace function public.goos_notices(p_locale text) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version_label,'body',body,'hash',content_hash,'environment',environment)),'[]') from app.notice_versions where locale=p_locale and purpose='profile';
$$;
create function public.goos_s2_notices(p_locale text) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version_label,'body',body,'hash',content_hash,'environment',environment)),'[]') from app.notice_versions where locale=p_locale and purpose='assessment';
$$;
do $$declare signature text;definition text;replacement text;begin
 foreach signature in array array['public.goos_create_profile(text,text,text,uuid,boolean)','public.goos_create_delegation(uuid,uuid,text[],timestamptz,uuid,boolean)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  replacement:=replace(definition,'where id=p_notice_id and environment=''development''','where id=p_notice_id and purpose=''profile'' and environment=''development''');
  if replacement=definition then raise exception 'notice guard source mismatch';end if;execute replacement;
 end loop;
end $$;
-- Assessment เป็นของ subject เจ้าของเท่านั้น ไม่สืบทอด profile delegation ไปข้อมูลใหม่
create table app.assessments (
 subject_id uuid primary key references app.subjects(id),schema_version integer not null default 1 check(schema_version=1),
 goals text[] not null default '{}' check(cardinality(goals)<=4 and goals<@array['jobs','skills','access','community']::text[]),
 country_code text check(country_code ~ '^[A-Z]{2}$'),coarse_region text check(length(coarse_region)<=80),
 preferred_language text check(preferred_language in('th','en')),remote_ok boolean,
 available_hours_week integer check(available_hours_week between 0 and 168),
 confirmed_at timestamptz,notice_id uuid not null,notice_purpose text not null default 'assessment' check(notice_purpose='assessment'),
 foreign key(notice_id,notice_purpose) references app.notice_versions(id,purpose),
 version integer not null default 1 check(version>0),updated_at timestamptz not null default now()
);
create table private.assessment_consents (
 id uuid primary key default gen_random_uuid(),subject_id uuid not null,actor_id uuid not null,
 notice_id uuid not null,notice_purpose text not null default 'assessment' check(notice_purpose='assessment'),
 assessment_version integer not null check(assessment_version>0),action text not null check(action in('confirmed','drafted')),
 occurred_at timestamptz not null default now(),foreign key(notice_id,notice_purpose) references app.notice_versions(id,purpose)
);
alter table private.assessment_consents enable row level security;
create policy assessment_consent_own on private.assessment_consents to goos_api using(private.goos_owns_subject(subject_id)) with check(private.goos_owns_subject(subject_id) and actor_id=private.goos_uid());
grant select,insert on private.assessment_consents to goos_api;
revoke all on private.assessment_consents from public,anon,authenticated;
create trigger assessment_consent_immutable before update or delete or truncate on private.assessment_consents for each statement execute function private.goos_audit_immutable();
create function public.goos_s2_assessment_events() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('version',assessment_version,'action',action,'notice_id',notice_id,'occurred_at',occurred_at) order by assessment_version desc),'[]') from (select * from private.assessment_consents where private.goos_owns_subject(subject_id) order by assessment_version desc limit 20) own_events;
$$;
create table app.bookmarks (
 subject_id uuid not null references app.subjects(id),opportunity_id uuid not null references app.opportunities(id),
 created_at timestamptz not null default now(),primary key(subject_id,opportunity_id)
);
alter table app.assessments enable row level security;
alter table app.bookmarks enable row level security;
create policy assessment_own on app.assessments to goos_api using(private.goos_owns_subject(subject_id)) with check(private.goos_owns_subject(subject_id));
create policy bookmark_own on app.bookmarks to goos_api using(private.goos_owns_subject(subject_id)) with check(private.goos_owns_subject(subject_id));
grant select,insert,update on app.assessments to goos_api;
grant select,insert,delete on app.bookmarks to goos_api;
revoke all on app.assessments,app.bookmarks from public,anon,authenticated;

create function public.goos_s2_assessment() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 return(select to_jsonb(a) from app.assessments a where private.goos_owns_subject(a.subject_id));
end $$;
create function public.goos_s2_save_assessment(p_subject uuid,p_data jsonb,p_notice uuid,p_confirmed boolean,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare v_version integer;begin
 if not private.goos_owns_subject(p_subject) then raise exception 'not_found' using errcode='P0002';end if;
 -- lock เจ้าของ entity แม้ assessment ยังไม่เกิด ป้องกัน concurrent insert/lost update
 perform 1 from app.subjects where id=p_subject for update;
 select version into v_version from app.assessments where subject_id=p_subject;
 if coalesce(v_version,0) is distinct from p_expected_version then raise exception 'state_conflict' using errcode='40001';end if;
 if not exists(select 1 from app.notice_versions where id=p_notice and purpose='assessment') or p_confirmed is null then raise exception 'invalid_notice' using errcode='22023';end if;
 insert into app.assessments(subject_id,goals,country_code,coarse_region,preferred_language,remote_ok,available_hours_week,notice_id,confirmed_at)
 values(p_subject,array(select jsonb_array_elements_text(coalesce(p_data->'goals','[]'))),nullif(p_data->>'country_code',''),nullif(p_data->>'coarse_region',''),nullif(p_data->>'preferred_language',''),(p_data->>'remote_ok')::boolean,(p_data->>'available_hours_week')::integer,p_notice,case when p_confirmed then now() end)
 on conflict(subject_id) do update set goals=excluded.goals,country_code=excluded.country_code,coarse_region=excluded.coarse_region,preferred_language=excluded.preferred_language,remote_ok=excluded.remote_ok,available_hours_week=excluded.available_hours_week,notice_id=excluded.notice_id,confirmed_at=excluded.confirmed_at,version=app.assessments.version+1,updated_at=now();
 select version into v_version from app.assessments where subject_id=p_subject;
 insert into private.assessment_consents(subject_id,actor_id,notice_id,assessment_version,action) values(p_subject,private.goos_uid(),p_notice,v_version,case when p_confirmed then 'confirmed' else 'drafted' end);
 perform private.goos_audit('assessment.saved',p_subject);
end $$;

create function public.goos_s2_bookmark(p_id uuid,p_saved boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_subject uuid;begin
 select id into v_subject from app.subjects where account_id=private.goos_uid() and private.goos_owns_subject(id);
 if v_subject is null then raise exception 'not_found' using errcode='P0002';end if;
 if p_saved is null then raise exception 'invalid_input' using errcode='22023';end if;
 if p_saved then
  if not private.goos_s2_public_listing(p_id) then raise exception 'not_found' using errcode='P0002';end if;
  insert into app.bookmarks(subject_id,opportunity_id) values(v_subject,p_id) on conflict do nothing;
 else delete from app.bookmarks where subject_id=v_subject and opportunity_id=p_id;end if;
 perform private.goos_audit('bookmark.changed',p_id);return;
end $$;
create function public.goos_s2_bookmarks() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',b.opportunity_id,'available',private.goos_s2_public_listing(b.opportunity_id),'created_at',b.created_at,'title_th',case when private.goos_s2_public_listing(b.opportunity_id) then r.title_th end,'title_en',case when private.goos_s2_public_listing(b.opportunity_id) then r.title_en end) order by b.created_at desc),'[]') from app.bookmarks b left join app.opportunities p on p.id=b.opportunity_id left join app.opportunity_revisions r on r.id=p.approved_revision_id where private.goos_owns_subject(b.subject_id));
end $$;
create function private.goos_s2_evaluate(p_rules jsonb,p_answers jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb;actual jsonb;v_pass boolean;v_unknown boolean:=false;v_failed boolean:=false;reasons jsonb:='[]';v_status text;begin
 if p_rules is null or jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)>15 then raise exception 'invalid_rule' using errcode='22023';end if;
 for r in select distinct value from jsonb_array_elements(p_rules) order by value loop
  if not private.goos_s2_rules_valid(jsonb_build_array(r)) then raise exception 'invalid_rule' using errcode='22023';end if;
  actual:=p_answers->(r->>'field');
  if actual is null or actual='null'::jsonb or actual='""'::jsonb then v_status:='unknown';v_unknown:=true;
  else
   v_pass:=case r->>'op' when 'eq' then actual=r->'value' when 'in' then (r->'value') @> jsonb_build_array(actual)
    when 'gte' then (actual#>>'{}')::numeric >= (r->'value'#>>'{}')::numeric
    when 'lte' then (actual#>>'{}')::numeric <= (r->'value'#>>'{}')::numeric end;
   v_status:=case when v_pass then 'eligible' else 'ineligible' end;v_failed:=v_failed or not coalesce(v_pass,false);
  end if;
  reasons:=reasons||jsonb_build_array(jsonb_build_object('field',r->>'field','status',v_status,'op',r->>'op','expected',r->'value'));
 end loop;
 return jsonb_build_object('status',case when v_failed then 'ineligible' when v_unknown then 'unknown' else 'eligible' end,'reasons',reasons,'rule_version',1);
end $$;
revoke all on function private.goos_s2_evaluate(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.goos_s2_evaluate(jsonb,jsonb) to goos_api;
create function public.goos_s2_matches() returns jsonb language plpgsql security definer set search_path='' as $$
declare a app.assessments;v_answers jsonb;begin
 select * into a from app.assessments where private.goos_owns_subject(subject_id) and confirmed_at is not null;
 if not found then raise exception 'confirmed_assessment_required' using errcode='22023';end if;
 v_answers:=jsonb_build_object('country',a.country_code,'region',a.coarse_region,'language',a.preferred_language,'remote',a.remote_ok,'hours',a.available_hours_week,'adult',true);
 return(select coalesce(jsonb_agg(result order by priority desc,id),'[]') from(
 select p.id,case when r.category=any(a.goals) then 1 else 0 end priority,
 jsonb_build_object('id',p.id,'revision_id',r.id,'title_th',r.title_th,'title_en',r.title_en,'category',r.category,'match',private.goos_s2_evaluate(r.rules||jsonb_build_array(jsonb_build_object('field','country','op','eq','value',r.country_code))||case when r.coarse_region<>'' then jsonb_build_array(jsonb_build_object('field','region','op','eq','value',r.coarse_region)) else '[]'::jsonb end||case when r.remote then jsonb_build_array(jsonb_build_object('field','remote','op','eq','value',true)) else '[]'::jsonb end,v_answers)) result
 from app.opportunities p join app.opportunity_revisions r on r.id=p.approved_revision_id where private.goos_s2_public_listing(p.id)
 order by priority desc,p.id limit 100) ranked);
end $$;
create function private.goos_s2_own_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare s uuid;u uuid;r jsonb;begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;s:=(r->>'subject_id')::uuid;
 select account_id into u from app.subjects where id=s;perform private.goos_live_bump(u);return null;
end $$;
revoke all on function private.goos_s2_own_signal() from public,anon,authenticated,goos_api,goos_authz;
create trigger assessment_signal after insert or update on app.assessments for each row execute function private.goos_s2_own_signal();
create trigger bookmarks_signal after insert or delete on app.bookmarks for each row execute function private.goos_s2_own_signal();
do $$declare f record;begin
 grant create on schema public to goos_api;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['goos_s2_assessment_events','goos_s2_notices','goos_s2_assessment','goos_s2_save_assessment','goos_s2_bookmark','goos_s2_bookmarks','goos_s2_matches']) loop
 execute format('alter function %s owner to goos_api',f.sig);execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to authenticated',f.sig);end loop;
 revoke create on schema public from goos_api;
end $$;
