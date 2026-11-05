-- ผู้ส่งคำขอตอบ request-info และยกเลิก request ของตนได้ โดยไม่ให้สร้างคำถามแทน partner
create policy s3_info_subject_update on app.application_info_requests for update to goos_api
 using(exists(select 1 from app.applications a where a.id=application_id and private.goos_can_subject(a.subject_id,'application:submit')))
 with check(status in('answered','cancelled') and exists(select 1 from app.applications a where a.id=application_id and private.goos_can_subject(a.subject_id,'application:submit')));
-- เจ้าของ preview หมดอายุยังมีสิทธิ์ถึง barrier เพื่อรับ 409; ไม่ขยายไป resource ของผู้อื่น
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s3_listing_transaction(uuid)'::regprocedure);
 r:=replace(d,$s$ and v.expires_at>now()$s$,'');if d=r then raise exception 'barrier source mismatch';end if;execute r;
end $$;
grant select(source_event_id) on app.notifications to goos_worker;
create policy s3_worker_notice_dedupe on app.notifications for select to goos_worker using(source_event_id is not null and exists(select 1 from private.outbox j where j.id=source_event_id));
create or replace function private.goos_s3_tick(p_org uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare v_task record;v_count integer:=0;begin
 for v_task in select c.id,c.version,c.due_at,r.id rule_id,r.version rule_version from app.automation_rules r join app.cases c on c.organization_id=r.organization_id where r.enabled and(p_org is null or r.organization_id=p_org) and c.state not in('closed','cancelled','resolved') and c.due_at<=now()+make_interval(mins=>r.minutes_before) order by c.due_at,c.id limit 100 loop
  perform private.goos_s3_emit(v_task.id,'followup.due',v_task.id::text||':'||v_task.version::text||':'||v_task.rule_id::text||':'||v_task.rule_version::text);v_count:=v_count+1;
 end loop;return v_count;
end $$;
notify pgrst,'reload schema';
