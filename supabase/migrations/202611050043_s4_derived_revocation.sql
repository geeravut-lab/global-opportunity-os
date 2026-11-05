-- New evidence access depends on current source/destination sharing, including reviewer downloads.
create function private.goos_s4_case_active(p_source uuid,p_destination uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_destination is not null then exists(select 1 from private.s4_cases c where c.id=p_destination and private.goos_s4_valid(c.referral_id)) else exists(
 select 1 from app.cases c join app.applications a on a.id=c.application_id join app.organizations o on o.id=a.organization_id where c.id=p_source and a.state<>'withdrawn' and private.goos_s4_person_valid(c.subject_id) and o.status='verified' and o.verification_expires_at>now() and exists(select 1 from app.resource_shares s where s.application_id=a.id and s.response_id is null and s.status='active' and s.expires_at>now())) end;
$$;
grant create on schema private to goos_authz;
alter function private.goos_s4_case_active(uuid,uuid) owner to goos_authz;
revoke create on schema private from goos_authz;
revoke all on function private.goos_s4_case_active(uuid,uuid) from public,anon,authenticated,goos_worker,goos_reporter;
grant execute on function private.goos_s4_case_active(uuid,uuid) to goos_api;
DO $$declare d text;r text;begin
 d:=pg_get_functiondef('private.goos_s4_outcome(uuid,boolean)'::regprocedure);
 r:=replace(d,$s$and private.goos_s4_scope('impact') and o.reporter_id<>$s$,$s$and private.goos_s4_scope('impact') and private.goos_s4_case_active(o.source_case_id,o.referral_case_id) and o.reporter_id<>$s$);if r=d then raise exception 'S4 reviewer scope source mismatch';end if;execute r;
end $$;
create function private.goos_s4_derived_withdrawal() returns trigger language plpgsql security definer set search_path='' as $$
declare r private.s4_referrals;begin
 if new.response_id is not null or new.status<>'revoked' or old.status='revoked' then return null;end if;
 for r in select v.* from private.s4_referrals v join app.cases c on c.id=v.source_case_id where c.application_id=new.application_id and v.share_active order by v.id for update of v loop
  update private.s4_referrals set share_active=false,state=case when state='pending' then 'cancelled' else state end,version=version+1,updated_at=now() where id=r.id;
  if private.goos_uid() is not null then insert into private.s4_withdrawals values(r.id,r.subject_id,private.goos_uid(),now()) on conflict do nothing;end if;
  insert into private.s4_cessations(subject_id,resource_kind,resource_id,recipient_org_id) values(r.subject_id,'referral',r.id,r.recipient_org_id) on conflict do nothing;
 end loop;return null;
end $$;
revoke all on function private.goos_s4_derived_withdrawal() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create trigger s4_source_withdrawal after update on app.resource_shares for each row execute function private.goos_s4_derived_withdrawal();
create function private.goos_s4_guest_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.goos_audit('report.anonymous.submitted',new.id);return null;end $$;
revoke all on function private.goos_s4_guest_audit() from public,anon,authenticated,goos_api,goos_authz,goos_worker,goos_reporter;
create trigger s4_guest_audit after insert on private.s4_reports for each row when(new.reporter_id is null) execute function private.goos_s4_guest_audit();
notify pgrst,'reload schema';
