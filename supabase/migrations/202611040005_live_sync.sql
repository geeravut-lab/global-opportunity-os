-- Empty private broadcast signals + authorization-safe polling fingerprint.
create table private.live_revisions(account_id uuid primary key references app.accounts(id),revision bigint not null default 1);
alter table private.live_revisions enable row level security;
create policy live_own on private.live_revisions for select to goos_api using(account_id=private.goos_uid() and private.goos_actor_active());
grant select on private.live_revisions to goos_api;
create function private.goos_live_ping(p_topic text) returns void language plpgsql security definer set search_path='' as $$
begin
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then perform realtime.send('{}'::jsonb,'ping',p_topic,true);end if;
exception when others then null;
end $$;
create function private.goos_live_bump(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_user is null then return;end if;
 insert into private.live_revisions(account_id) select p_user where exists(select 1 from app.accounts where id=p_user)
 on conflict(account_id) do update set revision=private.live_revisions.revision+1;
 perform private.goos_live_ping('goos:u:'||p_user::text);
end $$;
create function private.goos_live_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;v_user uuid;v_subject uuid;v_org uuid;begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op='UPDATE' and to_jsonb(old)=to_jsonb(new) then return null;end if;
 if tg_table_name='platform_settings' then perform private.goos_live_ping('goos:settings');return null;end if;
 if tg_table_name in ('accounts','notifications','platform_role_grants','revoked_sessions') then
  perform private.goos_live_bump(case when tg_table_name='accounts' then (r->>'id')::uuid else (r->>'account_id')::uuid end);
 elsif tg_table_name in ('subjects','delegations') then
  v_subject:=case when tg_table_name='subjects' then (r->>'id')::uuid else (r->>'subject_id')::uuid end;
  for v_user in select account_id from app.subjects where id=v_subject union select delegate_account_id from app.delegations where subject_id=v_subject loop perform private.goos_live_bump(v_user);end loop;
 elsif tg_table_name in ('organizations','org_memberships','org_invitations') then
  v_org:=case when tg_table_name='organizations' then (r->>'id')::uuid else (r->>'organization_id')::uuid end;
  for v_user in select account_id from app.org_memberships where organization_id=v_org union select recipient_account_id from app.org_invitations where organization_id=v_org union select (r->>'account_id')::uuid where r ? 'account_id' loop perform private.goos_live_bump(v_user);end loop;
 end if;
 return null;
end $$;
-- Revision writes are transactional; optional broadcast delivery never breaks domain writes.
do $$ declare t text;begin
 foreach t in array array['accounts','subjects','delegations','organizations','org_memberships','org_invitations','notifications','platform_settings'] loop
  execute format('create trigger goos_live_change after insert or update or delete on app.%I for each row execute function private.goos_live_change()',t);
 end loop;
end $$;
create trigger goos_live_grants after insert or update or delete on private.platform_role_grants for each row execute function private.goos_live_change();
create trigger goos_live_revoked after insert on private.revoked_sessions for each row execute function private.goos_live_change();
revoke all on function private.goos_live_ping(text),private.goos_live_bump(uuid),private.goos_live_change() from public,anon,authenticated,goos_api,goos_authz;

create function private.goos_live_listen(p_topic text) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and (p_topic='goos:u:'||private.goos_uid()::text or p_topic='goos:settings');
$$;
grant create on schema private to goos_authz;
alter function private.goos_live_listen(text) owner to goos_authz;
revoke all on function private.goos_live_listen(text) from public,anon;
grant execute on function private.goos_live_listen(text) to authenticated;
grant usage on schema private to authenticated;
-- USAGE alone grants no table access or EXECUTE on the other private functions.
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'create policy goos_live_listen on realtime.messages for select to authenticated using(extension=''broadcast'' and private.goos_live_listen(realtime.topic()))';
 end if;
end $$;
revoke create on schema private from goos_authz;

create function public.goos_live_fingerprint() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision bigint;v_settings app.platform_settings;v_active integer;begin
 if not private.goos_actor_active() then raise exception 'not_authenticated' using errcode='28000';end if;
 select revision into v_revision from private.live_revisions where account_id=private.goos_uid();
 select * into strict v_settings from app.platform_settings where singleton;
 select count(*) into v_active from app.delegations where (delegate_account_id=private.goos_uid() or granted_by=private.goos_uid()) and status='active' and expires_at>now();
 return jsonb_build_object('fingerprint',coalesce(v_revision,0)::text||':'||v_settings.version::text||':'||v_active::text,'enabled',coalesce(v_settings.flags->>'live_sync','true')='true');
end $$;
grant create on schema public to goos_api;
alter function public.goos_live_fingerprint() owner to goos_api;
revoke all on function public.goos_live_fingerprint() from public,anon;
grant execute on function public.goos_live_fingerprint() to authenticated;
revoke create on schema public from goos_api;
