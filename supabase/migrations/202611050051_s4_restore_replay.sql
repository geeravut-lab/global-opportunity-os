-- Operator-only trusted withdrawal ledger replay, including recipient cessation metadata.
create or replace function private.goos_s4_replay_withdrawals(p_ledger jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare item jsonb;r private.s4_referrals;v integer:=0;v_actor uuid;v_time timestamptz;begin
 if p_ledger is null or jsonb_typeof(p_ledger)<>'array' or jsonb_array_length(p_ledger)>10000 then raise exception 'invalid_input' using errcode='22023';end if;
 for item in select * from jsonb_array_elements(p_ledger) loop
  v_actor:=(item->>'actor_id')::uuid;v_time:=(item->>'created_at')::timestamptz;
  if v_actor is null or v_time is null then raise exception 'invalid_ledger' using errcode='22023';end if;
  select * into r from private.s4_referrals where id=(item->>'referral_id')::uuid and subject_id=(item->>'subject_id')::uuid for update;
  if not found then raise exception 'invalid_ledger' using errcode='22023';end if;
  if r.share_active then
   update private.s4_referrals set share_active=false,state=case when state='pending' then 'cancelled' else state end,version=version+1,updated_at=now() where id=r.id;
   insert into private.s4_events(kind,resource_id,actor_id,action) values('referrals',r.id,null,'withdrawal.replayed');
   v:=v+1;
  end if;
  insert into private.s4_withdrawals(referral_id,subject_id,actor_id,created_at) values(r.id,r.subject_id,v_actor,v_time) on conflict do nothing;
  insert into private.s4_cessations(subject_id,resource_kind,resource_id,recipient_org_id) values(r.subject_id,'referral',r.id,r.recipient_org_id) on conflict do nothing;
 end loop;return v;
end $$;
revoke all on function private.goos_s4_replay_withdrawals(jsonb) from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
notify pgrst,'reload schema';
