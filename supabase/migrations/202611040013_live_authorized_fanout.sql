-- จำกัดสัญญาณให้ผู้ที่ยังมีสิทธิ์ พร้อมส่งการถอนสิทธิ์ให้ผู้ได้รับผลครั้งสุดท้าย
-- ไม่แก้ payload ไม่เปิด table grants และไม่เปลี่ยน migration ที่ใช้แล้ว
create or replace function private.goos_live_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 r jsonb; previous jsonb := '{}'::jsonb;
 v_user uuid; v_subject uuid; v_org uuid; v_member uuid;
 affected uuid[] := '{}'; recipients uuid[] := '{}';
begin
 r := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op<>'INSERT' then previous:=to_jsonb(old); end if;
 if tg_op='UPDATE' and previous=r then return null; end if;
 if tg_table_name='platform_settings' then
  perform private.goos_live_ping('goos:settings'); return null;
 elsif tg_table_name in ('accounts','notifications','platform_role_grants','revoked_sessions') then
  recipients:=array[
   (r->>case when tg_table_name='accounts' then 'id' else 'account_id' end)::uuid,
   (previous->>case when tg_table_name='accounts' then 'id' else 'account_id' end)::uuid];
 elsif tg_table_name='subjects' then
  v_subject:=(r->>'id')::uuid;
  select array_agg(distinct u) into recipients from (
   select (r->>'account_id')::uuid u
   union select (previous->>'account_id')::uuid
   union select d.delegate_account_id from app.delegations d
    where d.subject_id=v_subject and d.status='active'
     and d.starts_at<=now() and d.expires_at>now()
     and (r->>'status'='active' or previous->>'status'='active')
  ) authorized;
 elsif tg_table_name='delegations' then
  -- การแก้ grant แจ้งเจ้าของและผู้รับ grant นั้น ไม่ส่งให้ผู้ช่วยอื่น
  recipients:=array[(r->>'granted_by')::uuid,(r->>'delegate_account_id')::uuid,
   (previous->>'granted_by')::uuid,(previous->>'delegate_account_id')::uuid];
 elsif tg_table_name in ('organizations','org_memberships','org_member_roles','org_invitations') then
  if tg_table_name='org_member_roles' then
   v_member:=(r->>'membership_id')::uuid;
   select organization_id,array[account_id] into v_org,affected
    from app.org_memberships where id=v_member;
  elsif tg_table_name='organizations' then v_org:=(r->>'id')::uuid;
  else
   v_org:=(r->>'organization_id')::uuid;
   affected:=case when tg_table_name='org_memberships'
    then array[(r->>'account_id')::uuid,(previous->>'account_id')::uuid]
    else array[(r->>'recipient_account_id')::uuid,(previous->>'recipient_account_id')::uuid] end;
  end if;
  select array_agg(distinct u) into recipients from (
   select unnest(affected) u
   union select m.account_id from app.org_memberships m
    where m.organization_id=v_org and m.status='active'
     and (tg_table_name='organizations' or exists(
      select 1 from app.org_member_roles roles where roles.membership_id=m.id and roles.role_code in ('owner','admin')))
   union select i.recipient_account_id from app.org_invitations i
    where i.organization_id=v_org and i.status='pending' and i.expires_at>now()
     and (tg_table_name='organizations' or
      tg_table_name in ('org_memberships','org_member_roles') and i.invited_by=any(affected))
  ) authorized;
 end if;
 -- ลำดับ lock คงที่ ลด deadlock เมื่อ transaction แจ้งผู้รับหลายคน
 for v_user in select distinct u from unnest(recipients) u where u is not null order by u
 loop perform private.goos_live_bump(v_user); end loop;
 return null;
end $$;
revoke all on function private.goos_live_change() from public,anon,authenticated,goos_api,goos_authz;
create trigger goos_live_roles after insert or update or delete on app.org_member_roles
 for each row execute function private.goos_live_change();

-- polling ตรวจ MFA/platform grant/invitation ที่หมดอายุได้แม้ไม่มี mutation trigger
create or replace function public.goos_live_fingerprint() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_revision bigint; v_settings app.platform_settings; v_active integer; v_context jsonb; v_invites integer;
begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 select revision into v_revision from private.live_revisions where account_id=private.goos_uid();
 select * into strict v_settings from app.platform_settings where singleton;
 select count(*) into v_active from app.delegations
  where (delegate_account_id=private.goos_uid() or granted_by=private.goos_uid())
   and status='active' and starts_at<=now() and expires_at>now();
 v_context:=public.goos_context();
 v_invites:=jsonb_array_length(public.goos_my_invitations());
 return jsonb_build_object('fingerprint',coalesce(v_revision,0)::text||':'||v_settings.version::text||':'||v_active::text
  ||':'||(v_context->>'has_platform_role')||':'||(v_context->>'staff_assured')||':'||v_invites::text,
  'enabled',coalesce(v_settings.flags->>'live_sync','true')='true');
end $$;
revoke all on function public.goos_live_fingerprint() from public,anon;
grant execute on function public.goos_live_fingerprint() to authenticated;
