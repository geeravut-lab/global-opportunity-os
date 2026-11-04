-- Keep private schema inaccessible to the browser; Realtime policy uses a narrow public boolean wrapper.
revoke usage on schema private from authenticated;
revoke execute on function private.goos_live_listen(text) from authenticated;
grant execute on function private.goos_live_listen(text) to goos_api;
create function public.goos_live_authorized(p_topic text) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_live_listen(p_topic);
$$;
grant create on schema public to goos_api;
alter function public.goos_live_authorized(text) owner to goos_api;
revoke all on function public.goos_live_authorized(text) from public,anon;
grant execute on function public.goos_live_authorized(text) to authenticated;
revoke create on schema public from goos_api;
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'drop policy if exists goos_live_listen on realtime.messages';
  execute 'create policy goos_live_listen on realtime.messages for select to authenticated using(extension=''broadcast'' and public.goos_live_authorized(realtime.topic()))';
 end if;
end $$;
