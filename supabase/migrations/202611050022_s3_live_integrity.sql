-- ไม่มี payload เคสใน Broadcast: ปลุกเฉพาะผู้ที่มีสิทธิ์ปัจจุบัน
create function private.goos_s3_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare a app.applications;v_app uuid;u uuid;v_old uuid;v_row jsonb;begin
 v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='applications' then v_app:=(v_row->>'id')::uuid;
 elsif tg_table_name='cases' then v_app:=(v_row->>'application_id')::uuid;
 elsif tg_table_name='case_assignments' or tg_table_name='case_notes' then select application_id into v_app from app.cases where id=(v_row->>'case_id')::uuid;
 else v_app:=(v_row->>'application_id')::uuid;end if;
 select * into a from app.applications where id=v_app;
 if a.id is null then return null;end if;
 for u in select distinct id from(
  select account_id id from app.subjects where id=a.subject_id and not(tg_table_name='case_notes' and v_row->>'visibility'='internal')
  union select d.delegate_account_id from app.delegations d join app.delegation_scopes sc on sc.delegation_id=d.id where d.subject_id=a.subject_id and sc.scope='progress:read' and d.status='active' and d.starts_at<=now() and d.expires_at>now() and not(tg_table_name='case_notes' and v_row->>'visibility'='internal')
  union select m.account_id from app.case_assignments ca join app.cases c on c.id=ca.case_id join app.org_memberships m on m.id=ca.membership_id where c.application_id=a.id and ca.ends_at is null and m.status='active'
  union select m.account_id from app.org_memberships m join app.org_member_roles r on r.membership_id=m.id where m.organization_id=a.organization_id and m.status='active' and r.role_code in('owner','admin','supervisor') and tg_table_name<>'case_notes'
 ) recipients where id is not null order by id loop perform private.goos_live_bump(u);end loop;
 -- ผู้ถูก reassign ได้ signal สุดท้ายเพื่อปิดหน้าที่ค้าง; ไม่รับกิจกรรมครั้งถัดไป
 if tg_table_name='case_assignments' and tg_op='UPDATE' then select account_id into v_old from app.org_memberships where id=old.membership_id;if v_old is not null then perform private.goos_live_bump(v_old);end if;end if;
 return null;
end $$;
revoke all on function private.goos_s3_signal() from public,anon,authenticated,goos_api,goos_authz,goos_worker;
DO $$declare t text;begin
 foreach t in array array['applications','cases','case_assignments','resource_shares','application_info_requests'] loop
 execute format('create trigger s3_live after insert or update on app.%I for each row execute function private.goos_s3_signal()',t);
 end loop;
end $$;
create trigger s3_note_live after insert on private.case_notes for each row execute function private.goos_s3_signal();
-- published catalog digest ไม่เปลี่ยนจาก private workflow หรือ filled_count; availability อ่าน barrier จริง
create function private.goos_s3_capacity_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.capacity is not null and new.capacity<(select filled_count from app.opportunities where id=new.opportunity_id) then raise exception 'capacity_below_committed' using errcode='40001';end if;
 return new;
end $$;
revoke all on function private.goos_s3_capacity_guard() from public,anon,authenticated,goos_api,goos_authz,goos_worker;
create trigger s3_capacity_guard before insert on app.opportunity_revisions for each row execute function private.goos_s3_capacity_guard();
-- Direct table DML/public worker calls ไม่มี grant แม้ user ปลอม role metadata
revoke all on all tables in schema app,private from anon,authenticated;
notify pgrst,'reload schema';
