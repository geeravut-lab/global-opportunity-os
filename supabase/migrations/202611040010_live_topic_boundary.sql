-- Other existing Realtime policies cannot broaden access to the goos: namespace.
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'create policy goos_live_namespace_guard on realtime.messages as restrictive for select to authenticated using(extension<>''broadcast'' or realtime.topic() not like ''goos:%'' or public.goos_live_authorized(realtime.topic()))';
 end if;
end $$;
