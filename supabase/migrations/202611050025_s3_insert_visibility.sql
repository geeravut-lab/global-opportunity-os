-- INSERT RETURNING ต้องตัดสิน ownership จากแถวใหม่ ไม่ lookup id ผ่าน STABLE snapshot ของ statement เดียวกัน
alter policy s3_application_api on app.applications using(
 private.goos_can_subject(subject_id,'progress:read') or(actor_id=private.goos_uid() and private.goos_can_subject(subject_id,'application:submit'))
 or private.goos_s3_work(id) or private.goos_s3_routing(organization_id)) with check(private.goos_actor_active());
notify pgrst,'reload schema';
