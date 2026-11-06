-- จำกัด child-row candidates ของ S3 ก่อนตรวจ RLS เดิม ไม่เพิ่มสิทธิ์หรือแก้ payload/consent
create index s3_note_case_recent on private.case_notes(case_id,created_at,id);
create index s3_response_application_recent on private.application_responses(application_id,created_at,id);
create index s3_request_application_recent on app.application_info_requests(application_id,created_at,id);
create index s3_application_event_recent on app.application_events(application_id,created_at,id);
create index s3_case_event_recent on app.case_events(case_id,created_at,id);
create index s3_active_response_share on app.resource_shares(response_id,expires_at) where response_id is not null and status='active';
