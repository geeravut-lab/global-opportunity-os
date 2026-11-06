-- คง predicate ของ note เดิม แต่ไม่ join ผ่าน RLS ซ้อนกันใน WITH CHECK/USING
-- helpers อ่านเฉพาะ metadata ตาม case UUID และคืน boolean ไม่มี payload/รายชื่อ
create function private.goos_s3_note_readable(p_case uuid,p_visibility text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_app uuid;v_category text;begin
 if not private.goos_actor_active() then return false;end if;
 select c.application_id,r.category into v_app,v_category from app.cases c join app.applications a on a.id=c.application_id join app.opportunity_revisions r on r.id=a.revision_id where c.id=p_case;
 if v_app is null then return false;end if;
 return (p_visibility='beneficiary_shared' and private.goos_s3_progress(v_app)) or (private.goos_s3_work(v_app) and(v_category<>'jobs' or p_visibility='beneficiary_shared'));
end $$;
create function private.goos_s3_note_writable(p_case uuid,p_visibility text,p_author uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_app uuid;v_category text;begin
 if not private.goos_actor_active() or p_author is distinct from private.goos_uid() then return false;end if;
 select c.application_id,r.category into v_app,v_category from app.cases c join app.applications a on a.id=c.application_id join app.opportunity_revisions r on r.id=a.revision_id where c.id=p_case;
 if v_app is null then return false;end if;
 return private.goos_s3_work(v_app) and(v_category<>'jobs' or p_visibility='beneficiary_shared');
end $$;
revoke all on function private.goos_s3_note_readable(uuid,text),private.goos_s3_note_writable(uuid,text,uuid) from public,anon,authenticated,goos_authz,goos_worker,goos_reporter;
grant execute on function private.goos_s3_note_readable(uuid,text),private.goos_s3_note_writable(uuid,text,uuid) to goos_api;
alter policy s3_note_api on private.case_notes using(private.goos_s3_note_readable(case_id,visibility)) with check(private.goos_s3_note_writable(case_id,visibility,author_id));
notify pgrst,'reload schema';
