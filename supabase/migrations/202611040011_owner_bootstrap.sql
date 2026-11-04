-- Owner is designated out-of-band by the operator. There is no "first user becomes admin" rule.
create table private.platform_bootstrap(
 singleton boolean primary key default true check(singleton),salt text not null,email_hash text not null check(email_hash~'^[a-f0-9]{64}$'),claimed_at timestamptz
);
alter table private.platform_bootstrap enable row level security;
revoke all on private.platform_bootstrap from public,anon,authenticated,goos_api,goos_authz;
-- Narrow operator-owned boundary: compares only current verified Auth email to the private salted designation.
-- No parameters, no email/secret output; only callable inside the authenticated bootstrap RPC.
create function private.goos_bootstrap_owner() returns void language plpgsql security definer set search_path='' as $$
declare v_designation private.platform_bootstrap;v_id uuid:=private.goos_uid();begin
 if not private.goos_actor_active() then return;end if;
 select * into v_designation from private.platform_bootstrap where singleton for update;
 if not found or v_designation.claimed_at is not null or exists(select 1 from private.platform_owner) then return;end if;
 if not exists(select 1 from auth.users where id=v_id and email_confirmed_at is not null and not is_anonymous and encode(sha256(convert_to(v_designation.salt||lower(email),'UTF8')),'hex')=v_designation.email_hash) then return;end if;
 insert into private.platform_owner(singleton,account_id) values(true,v_id);
 insert into private.platform_role_grants(account_id,role_code,granted_by) values(v_id,'platform_admin',v_id);
 update private.platform_bootstrap set claimed_at=now() where singleton;
 perform private.goos_audit('admin.owner_claimed',v_id);
 perform private.goos_notify(v_id,'admin.granted');
end $$;
revoke all on function private.goos_bootstrap_owner() from public,anon,authenticated,goos_authz;
grant execute on function private.goos_bootstrap_owner() to goos_api;
create or replace function public.goos_bootstrap_account(p_locale text default 'th') returns uuid language plpgsql security definer set search_path='' as $$
declare v_count integer;begin
 if not private.goos_verified_identity() or not private.goos_session_valid() then raise exception 'not_authenticated' using errcode='28000';end if;
 if p_locale not in ('th','en') then raise exception 'invalid_input' using errcode='22023';end if;
 insert into app.accounts(id,locale) values(private.goos_uid(),p_locale) on conflict(id) do nothing;
 get diagnostics v_count=row_count;
 if not private.goos_actor_active() then raise exception 'account_inactive' using errcode='28000';end if;
 if v_count=1 then perform private.goos_audit('account.created',private.goos_uid());end if;
 perform private.goos_bootstrap_owner();return private.goos_uid();
end $$;
