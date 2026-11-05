-- Generic triggers must not bind table-specific OLD fields before checking the source table.
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s4_signal()'::regprocedure);
 r:=replace(replace(d,'old.membership_id is distinct from new.membership_id',$s$(to_jsonb(old)->>'membership_id') is distinct from (to_jsonb(new)->>'membership_id')$s$),'id=old.membership_id',$s$id=(to_jsonb(old)->>'membership_id')::uuid$s$);if r=d then raise exception 'S4 trigger source mismatch';end if;execute r;
end $$;
drop policy s4_api on private.s4_staff_scopes;
create policy s4_scope_read on private.s4_staff_scopes for select to goos_api using(private.goos_platform_admin() or account_id=private.goos_uid());
create policy s4_scope_insert on private.s4_staff_scopes for insert to goos_api with check(private.goos_platform_admin() and account_id<>private.goos_uid() and granted_by=private.goos_uid());
create policy s4_scope_revoke on private.s4_staff_scopes for update to goos_api using(private.goos_platform_admin()) with check(private.goos_platform_admin() and account_id<>private.goos_uid());
notify pgrst,'reload schema';
