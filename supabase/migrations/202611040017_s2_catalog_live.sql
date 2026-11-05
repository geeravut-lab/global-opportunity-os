-- Fingerprint จาก public projection เท่านั้น ไม่ใช้จำนวน draft/review/private events
create function private.goos_s2_catalog_clock() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('digest',md5(coalesce(string_agg(p.id::text||':'||p.approved_revision_id::text||':'||p.version::text||':'||o.display_name||':'||o.verification_expires_at::text,',' order by p.id),'')),
 'next_at',least(min(r.valid_until),min(o.verification_expires_at)))
 from app.opportunities p join app.opportunity_revisions r on r.id=p.approved_revision_id join app.organizations o on o.id=p.organization_id
 where private.goos_s2_public_listing(p.id);
$$;
grant create on schema private to goos_authz;
alter function private.goos_s2_catalog_clock() owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s2_catalog_clock() from public,anon,authenticated;
grant execute on function private.goos_s2_catalog_clock() to goos_api;
create table private.catalog_clock(singleton boolean primary key default true check(singleton),digest text not null);
alter table private.catalog_clock enable row level security;
revoke all on private.catalog_clock from public,anon,authenticated,goos_api,goos_authz;
insert into private.catalog_clock(singleton,digest) values(true,private.goos_s2_catalog_clock()->>'digest');
create function private.goos_s2_public_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare v_old text;v_new text;begin
 select digest into v_old from private.catalog_clock where singleton for update;
 select private.goos_s2_catalog_clock()->>'digest' into v_new;
 if v_old is distinct from v_new then
  update private.catalog_clock set digest=v_new where singleton;
  -- reuse topic สาธารณะของแอปที่ authenticated ฟังได้อยู่แล้ว; payload ว่างเสมอ
  perform private.goos_live_ping('goos:settings');
 end if;return null;
end $$;
revoke all on function private.goos_s2_public_signal() from public,anon,authenticated,goos_api,goos_authz;
create trigger catalog_public_signal after insert or update or delete on app.opportunities for each row execute function private.goos_s2_public_signal();
create trigger org_public_signal after update on app.organizations for each row execute function private.goos_s2_public_signal();
create trigger review_public_signal after insert on private.catalog_reviews for each row execute function private.goos_s2_public_signal();
create or replace function public.goos_live_fingerprint() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision bigint;v_settings app.platform_settings;v_active integer;v_context jsonb;v_invites integer;v_catalog jsonb;begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 select revision into v_revision from private.live_revisions where account_id=private.goos_uid();
 select * into strict v_settings from app.platform_settings where singleton;
 select count(*) into v_active from app.delegations where(delegate_account_id=private.goos_uid() or granted_by=private.goos_uid()) and status='active' and starts_at<=now() and expires_at>now();
 v_context:=public.goos_context();v_invites:=jsonb_array_length(public.goos_my_invitations());v_catalog:=private.goos_s2_catalog_clock();
 return jsonb_build_object('fingerprint',coalesce(v_revision,0)::text||':'||v_settings.version::text||':'||v_active::text||':'||(v_context->>'has_platform_role')||':'||(v_context->>'staff_assured')||':'||v_invites::text||':'||(v_catalog->>'digest'),
 'enabled',coalesce(v_settings.flags->>'live_sync','true')='true','next_catalog_at',v_catalog->'next_at');
end $$;
revoke all on function public.goos_live_fingerprint() from public,anon;
grant execute on function public.goos_live_fingerprint() to authenticated;
