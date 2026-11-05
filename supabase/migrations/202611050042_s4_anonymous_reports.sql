-- Anonymous safety intake: write-only role, opaque receipt, bounded global budget. No contacts/profile.
create role goos_reporter nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
DO $$begin execute format('grant goos_reporter to %I',current_user);end $$;
grant usage on schema private,extensions to goos_reporter;
create table private.s4_guest_budget(bucket timestamptz primary key,hits integer not null check(hits>0));
alter table private.s4_guest_budget enable row level security;
revoke all on private.s4_guest_budget from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create function private.goos_s4_guest_budget() returns void language plpgsql security definer set search_path='' as $$
declare v integer;begin
 perform pg_advisory_xact_lock(682491142);
 delete from private.s4_guest_budget where bucket<now()-interval '1 day';
 if coalesce((select sum(hits) from private.s4_guest_budget),0)>=100 then raise exception 'report_limit' using errcode='22023';end if;
 insert into private.s4_guest_budget values(date_trunc('minute',now()),1) on conflict(bucket) do update set hits=private.s4_guest_budget.hits+1 returning hits into v;
 if v>10 then raise exception 'report_limit' using errcode='22023';end if;
end $$;
create function private.goos_s4_guest_status(p_id uuid,p_receipt text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
 if not private.goos_s4_enabled() or p_receipt is null or p_receipt!~'^[a-f0-9]{64}$' then raise exception 'not_found' using errcode='P0002';end if;
 select jsonb_build_object('id',id,'state',state,'kind',kind,'created_at',created_at) into v from private.s4_reports where id=p_id and reporter_id is null and receipt_hash=encode(sha256(convert_to(p_receipt,'UTF8')),'hex');
 if v is null then raise exception 'not_found' using errcode='P0002';end if;return v;
end $$;
revoke all on function private.goos_s4_guest_budget(),private.goos_s4_guest_status(uuid,text) from public,anon,authenticated,goos_api,goos_authz,goos_worker;
grant execute on function private.goos_s4_guest_budget(),private.goos_s4_guest_status(uuid,text),private.goos_s3_encrypt(jsonb),private.goos_s4_enabled() to goos_reporter;
grant execute on function private.goos_s4_guest_status(uuid,text) to goos_api;
create policy s4_anonymous_insert on private.s4_reports for insert to goos_reporter with check(reporter_id is null and organization_id is null and accused_id is null and receipt_hash is not null);
grant insert on private.s4_reports to goos_reporter;
create function public.goos_s4_guest_report(p_kind text,p_body text,p_appeal uuid default null,p_receipt text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();v_secret text:=encode(extensions.gen_random_bytes(32),'hex');v_old jsonb;begin
 if not private.goos_s4_enabled() then raise exception 's4_not_enabled' using errcode='42501';end if;
 if p_kind is null or p_kind not in('service','safety') or p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'invalid_input' using errcode='22023';end if;
 if p_appeal is not null then
  v_old:=private.goos_s4_guest_status(p_appeal,p_receipt);
  if v_old->>'state' not in('resolved','dismissed') then raise exception 'invalid_transition' using errcode='40001';end if;
  p_kind:=v_old->>'kind';
 end if;
 perform private.goos_s4_guest_budget();
 insert into private.s4_reports(id,reporter_id,kind,encrypted_body,receipt_hash,appeal_of) values(v_id,null,p_kind,private.goos_s3_encrypt(jsonb_build_object('body',trim(p_body))),encode(sha256(convert_to(v_secret,'UTF8')),'hex'),p_appeal);
 return jsonb_build_object('id',v_id,'receipt',v_secret,'state','submitted');
end $$;
create function public.goos_s4_guest_status(p_id uuid,p_receipt text) returns jsonb language sql security definer set search_path='' as $$select private.goos_s4_guest_status(p_id,p_receipt);$$;
grant create on schema public to goos_reporter;
alter function public.goos_s4_guest_report(text,text,uuid,text) owner to goos_reporter;
revoke create on schema public from goos_reporter;
grant create on schema public to goos_api;
alter function public.goos_s4_guest_status(uuid,text) owner to goos_api;
revoke create on schema public from goos_api;
revoke all on function public.goos_s4_guest_report(text,text,uuid,text),public.goos_s4_guest_status(uuid,text) from public,anon,authenticated,goos_worker;
grant execute on function public.goos_s4_guest_report(text,text,uuid,text),public.goos_s4_guest_status(uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
