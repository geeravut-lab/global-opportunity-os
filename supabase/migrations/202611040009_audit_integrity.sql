-- Audit identifiers survive account/org deletion without retaining email/profile contents.
alter table private.audit_events drop constraint audit_events_actor_id_fkey;
alter table private.audit_events drop constraint audit_events_organization_id_fkey;
create function private.goos_audit_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'audit_append_only' using errcode='42501';end $$;
revoke all on function private.goos_audit_immutable() from public,anon,authenticated,goos_api,goos_authz;
create trigger goos_audit_immutable before update or delete or truncate on private.audit_events for each statement execute function private.goos_audit_immutable();
create function public.goos_export_audit() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;begin
 if not private.goos_platform_admin() then raise exception 'not_found' using errcode='P0002';end if;
 v_rows:=public.goos_audit_events();perform private.goos_audit('audit.exported',null);return v_rows;
end $$;
grant create on schema public to goos_api;
alter function public.goos_export_audit() owner to goos_api;
revoke all on function public.goos_export_audit() from public,anon;
grant execute on function public.goos_export_audit() to authenticated;
revoke create on schema public from goos_api;
