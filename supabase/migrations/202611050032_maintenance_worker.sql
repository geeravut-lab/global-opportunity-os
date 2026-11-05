-- เครื่องจักรตรวจ PNG เท่านั้น ไม่ให้ worker อ่าน package หรือแก้ธุรกิจ
create policy evidence_machine_read on private.org_evidence for select to goos_worker using(status in('quarantined','clean','rejected'));
create policy evidence_machine_update on private.org_evidence for update to goos_worker using(status='quarantined') with check(status in('clean','rejected') and original_body is null and ((status='clean' and safe_body is not null) or(status='rejected' and safe_body is null)));
grant select(id,original_body,status,created_at),update(status,safe_body,original_body,content_hash,inspection,processed_at) on private.org_evidence to goos_worker;
