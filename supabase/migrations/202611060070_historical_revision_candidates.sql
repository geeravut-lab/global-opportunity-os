-- metadata ของ revision เก่าที่ผู้ใช้ยังมีสิทธิ์ใน application; ไม่คืน payload และไม่ขยาย actor predicates
create index s3_application_revision_candidates on app.applications(revision_id,id);
create index s3_application_opportunity_candidates on app.applications(opportunity_id,id);
create index s3_listing_preview_candidates on private.s3_previews(opportunity_id,actor_id,expires_at);
create function private.goos_s3_revision_visible(p_revision uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.goos_actor_active() and exists(select 1 from app.applications a where a.revision_id=p_revision and private.goos_s3_visible(a.id));
$$;
revoke all on function private.goos_s3_revision_visible(uuid) from public,anon,authenticated,goos_authz,goos_worker,goos_reporter;
grant execute on function private.goos_s3_revision_visible(uuid) to goos_api;
alter policy s3_historical_revision on app.opportunity_revisions using(private.goos_s3_revision_visible(id));
notify pgrst,'reload schema';
