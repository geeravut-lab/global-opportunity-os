-- Consent ณ เวลา enqueue และ delivery: การ opt-in ภายหลังไม่ทำให้อีเมลเก่าที่ไม่เคยยินยอมถูกส่ง
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s3_emit(uuid,text,text)'::regprocedure);
 r:=replace(d,$s$insert into private.outbox(account_id,case_id,organization_id,kind,channel,dedupe_key)$s$,$s$if coalesce((private.goos_s3_email_target(u,channel_name)->>'enabled')::boolean,false) then\n    insert into private.outbox(account_id,case_id,organization_id,kind,channel,dedupe_key)$s$);
 r:=replace(r,$s$on conflict(dedupe_key) do nothing;$s$,$s$on conflict(dedupe_key) do nothing;end if;$s$);r:=replace(r,E'\\n',E'\n');if r=d then raise exception 'enqueue consent source mismatch';end if;execute r;
 d:=pg_get_functiondef('private.goos_s3_ack(uuid,uuid,boolean,text)'::regprocedure);
 r:=replace(d,$s$if j.status='delivered' and p_ok then return;end if;$s$,$s$if j.status='cancelled' or(j.status='delivered' and p_ok) then return;end if;$s$);if r=d then raise exception 'ack consent source mismatch';end if;execute r;
end $$;
create or replace function private.goos_s3_preference_signal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update private.outbox set status='cancelled' where account_id=new.account_id and status in('pending','inflight') and(channel='email' and not new.email or channel='in_app' and not new.in_app);
 perform private.goos_live_bump(new.account_id);return null;
end $$;
create function private.goos_s3_contact_stop() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.safe_contact<>'email' or new.status<>'active' then update private.outbox set status='cancelled' where account_id=new.account_id and channel='email' and status in('pending','inflight');end if;return null;end $$;
revoke all on function private.goos_s3_contact_stop() from public,anon,authenticated,goos_api,goos_authz,goos_worker;
create trigger s3_safe_email_stop after update of safe_contact,status on app.subjects for each row execute function private.goos_s3_contact_stop();
notify pgrst,'reload schema';
