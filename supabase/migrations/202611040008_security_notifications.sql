-- In-app notices only. External delivery is intentionally not configured.
alter table app.notifications drop constraint notifications_kind_check;
alter table app.notifications add constraint notifications_kind_check check(kind in ('admin.granted','admin.revoked','admin.changed','invitation.created','membership.revoked','security.password_changed'));
create function private.goos_domain_notice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='org_invitations' then perform private.goos_notify(new.recipient_account_id,'invitation.created');
 elsif tg_table_name='org_memberships' and old.status is distinct from new.status and new.status='revoked' then perform private.goos_notify(new.account_id,'membership.revoked');end if;
 return null;
end $$;
revoke all on function private.goos_domain_notice() from public,anon,authenticated,goos_api,goos_authz;
create trigger goos_invitation_notice after insert on app.org_invitations for each row execute function private.goos_domain_notice();
create trigger goos_membership_notice after update of status on app.org_memberships for each row execute function private.goos_domain_notice();
create or replace function public.goos_manage_admin(p_target uuid,p_grant boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_recipient uuid;begin
 if not private.goos_platform_admin() or p_target=private.goos_uid() or p_grant is null then raise exception 'not_found' using errcode='P0002';end if;
 perform 1 from private.platform_role_grants order by id for update;
 if not p_grant and private.goos_is_owner(p_target) then raise exception 'protected_owner' using errcode='23514';end if;
 if not private.goos_recipient_active(p_target) then raise exception 'not_found' using errcode='P0002';end if;
 if p_grant then insert into private.platform_role_grants(account_id,role_code,granted_by) values(p_target,'platform_admin',private.goos_uid());
 else
  update private.platform_role_grants set revoked_at=now() where account_id=p_target and revoked_at is null;
  if not found then raise exception 'state_conflict' using errcode='40001';end if;
 end if;
 perform private.goos_notify(p_target,case when p_grant then 'admin.granted' else 'admin.revoked' end);
 for v_recipient in select account_id from private.platform_role_grants where revoked_at is null and account_id<>p_target and account_id<>private.goos_uid() and (expires_at is null or expires_at>now()) loop perform private.goos_notify(v_recipient,'admin.changed');end loop;
 perform private.goos_audit(case when p_grant then 'admin.granted' else 'admin.revoked' end,p_target);
end $$;
