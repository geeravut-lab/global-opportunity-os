# คู่มือกู้ MFA และโอน platform owner

ขอบเขต C-23: คู่มือปฏิบัติงาน ไม่ได้ถอด MFA หรือเปลี่ยน owner จริงในรอบนี้
Email Recovery/SMTP เลื่อนตาม C-24; คู่มือนี้ไม่ใช้ email OTP หรือ Confirm email Off เป็นหลักฐานตัวบุคคล
เส้นทางปกติยังบังคับ current session + active platform grant + verified TOTP + aal2 ที่ตรวจจาก Auth/DB

## ข้อมูลที่ต้องมีต่อเหตุการณ์

บันทึก case ID, ประเภท lost device/compromised account/planned transfer, target account UUID,
ผู้ร้องขอ ผู้ตรวจสอบอิสระ ช่องทางยืนยันเดิมที่เชื่อถือได้ ผู้ดำเนินการ control plane เวลาเริ่ม/สิ้นสุด
เก็บหลักฐานในพื้นที่จำกัดสิทธิ์ ไม่ใส่ password, access/refresh token, QR, TOTP secret หรือรหัส OTP ลง ticket/แชต/Git
การรู้ email หรือ UUID ไม่เพียงพอ; auto-confirm ของ Supabase ไม่ได้พิสูจน์การครอบครอง mailbox
ยังไม่มีผู้รับผิดชอบ/ช่องทางยืนยันอิสระที่ owner รับรอง ต้องกำหนดใน operational roster ก่อน real-user launch ไม่แต่งชื่อคนหรือ SLA แทนเจ้าของ

## A. ยังเข้า Authenticator/อุปกรณ์เดิมได้

1. ใช้ browser/session ที่เชื่อถือได้ เปิด `/th/account/security` และ step up TOTP ให้สำเร็จ
2. ตรวจว่าบัญชีที่กำลังดำเนินการเป็น UUID ของตนเอง; ตั้ง Authenticator บนอุปกรณ์ใหม่โดยไม่แชร์ QR ให้เจ้าหน้าที่
3. ยืนยัน TOTP ใหม่ให้ provider ระบุ factor verified ก่อนถอด factor เดิม; UI ปัจจุบันยกเลิกได้เฉพาะ enrollment ที่ยังไม่ verified การลบ verified factor ใช้ขั้น operator ที่ตรวจกรณีแล้ว
4. เพิกถอน sessions เดิม แล้ว login/step-up ใหม่ ทดสอบ `/th/admin/branding` และตรวจว่าคำขอจาก session เก่าถูกปฏิเสธ
5. บันทึกเฉพาะ factor ID/status/เวลาและหลักฐานผลตรวจ ห้ามเก็บ secret; จบกรณีเมื่ออุปกรณ์ใหม่ใช้ได้จริง

## B. ไม่มี MFA เดิม แต่ยังควบคุมบัญชี Google/ตัวตนเดิมได้

1. ตรวจตัวตนผ่านช่องทางที่ตกลงไว้และหลักฐาน control plane ของ Supabase; ใช้ผู้ตรวจสอบอิสระ ไม่อาศัยเพียงชื่อ/email หรือคำขอในแชต
2. หากสงสัย credentials ถูกขโมย ให้ควบคุม Google/Email provider ก่อนเปิดการเข้าถึงกลับ ระหว่างเหตุการณ์ suspend app account และเพิกถอน sessions
3. operator ใช้ Project ที่ถูกต้อง เก็บ UUID ปัจจุบัน/expected state และสำรอง metadata ก่อนแก้ ไม่เปลี่ยน `platform_owner` เพื่อแก้ปัญหา factor
4. เพิกถอนทุก session ของ target ใน `private.revoked_sessions` เพื่อให้ app ปฏิเสธ JWT เก่าแม้ยังไม่หมดอายุ เก็บรายการนี้ใน ledger สำหรับ replay หลัง restore
5. ใช้ Supabase Auth Admin MFA API ลบเฉพาะ factor ที่สูญหายของ target ที่ตรวจแล้ว เช่น SDK server-only `admin.auth.admin.mfa.deleteFactor({ userId, id: factorId })` ตรวจผลและอ่านกลับว่า factor ถูกถอดจริง
6. หลังยืนยันตัวตนและควบคุม credentials แล้ว จึงคืนสถานะ active ให้ target และให้เจ้าของ login ใหม่ด้วย provider เดิม ตั้ง/ยืนยัน TOTP ใหม่ด้วยตัวเอง
7. ตรวจ session ปัจจุบัน aal2 + verified factor + UUID เดิม และเปิด admin page ได้; JWT ของ session เดิมต้องยังถูกปฏิเสธหลัง factor ใหม่ verified
8. บันทึก operator/action/target/เวลา/ผล deny tests ใน incident record และ control-plane audit ไม่ปลอม actor เป็นผู้ใช้ที่ไม่ได้กระทำเอง

ไม่มีการปิด MFA ทั้งแพลตฟอร์ม ไม่ใช้ service_role ใน browser ไม่แก้ JWT claims และไม่สร้าง fake verified owner
หากยืนยันตัวตนไม่ได้ ให้คงสถานะปฏิเสธสิทธิ์และส่งต่อผู้รับผิดชอบที่ระบุไว้ ไม่แก้ protected owner โดยเดา

## C. Planned owner transfer

1. ต้องมีคำสั่งที่ระบุ old/new account UUID และ case ID ชัดเจน ผู้รับเป็นบัญชีจริงที่ active; ไม่สร้างบัญชีหรือยืนยัน email แทนบุคคล
2. owner เดิมที่ผ่าน MFA เพิ่มผู้รับเป็น platform admin ผ่าน `/th/admin/admins` ตาม flow ปกติซึ่งมี audit แล้วให้ผู้รับ login/ตั้ง MFA/เปิด admin page ด้วยตนเอง
3. ผู้ตรวจสอบยืนยัน old owner acknowledgement และ new owner acknowledgement แยกกัน operator ตรวจ Project/ref และอ่าน singleton owner แบบ read-only ก่อนทำ transaction
4. ใช้ transaction พร้อม row lock ที่ `private.platform_owner`; ตรวจ owner เดิมตรง expected UUID, ผู้รับ active, มี active platform_admin grant, verified TOTP และ session aal2 ที่เพิ่งทดสอบ
5. เปลี่ยน singleton owner เพียงหนึ่งแถวและตรวจ row count=1; บันทึก operator identity/action/old/new UUID/case ID ในช่องทาง audit ที่ถูกต้อง หากเงื่อนไขใดไม่ตรงให้ rollback
6. ทดสอบผู้รับยังเป็น protected owner ถอนสิทธิ์ตน/owner ไม่ได้; ทดสอบเพิ่ม/ถอนผู้ดูแล fixture และ privileged writes ด้วย MFA
7. เก็บ grant เดิมไว้จนยืนยันผลแล้ว จากนั้นถอนสิทธิ์/เพิกถอน sessions ของผู้ส่งตามขอบเขต case ที่อนุมัติ ไม่ถอนสมาชิกองค์กรหรือสิทธิ์อื่นเหมารวม

ยังไม่มี owner-transfer RPC หรือหน้าโอน owner สำหรับ browser; ห้ามให้ UI role switch หรือ `user_metadata.role` ทำหน้าที่นี้
การสร้างกฎผู้ตรวจสอบอิสระเป็น operational decision ที่ยังต้องระบุคนจริง ไม่ถือว่าเอกสารนี้แต่งตั้งผู้ตรวจสอบแล้ว

## Query ตรวจ metadata สำหรับ operator

ใช้ SQL Editor/Management API ที่มีสิทธิ์ ห้ามเปิด query นี้ให้ผู้ใช้ทั่วไป และอ่านเฉพาะ target ของเหตุการณ์

```sql
select p.account_id as current_owner,
       a.status as account_status,
       exists(select 1 from auth.users u
              where u.id=p.account_id and u.email_confirmed_at is not null)
         as provider_confirmed,
       exists(select 1 from auth.mfa_factors f
              where f.user_id=p.account_id and f.status='verified'
                and f.factor_type='totp') as has_verified_totp
from private.platform_owner p
join app.accounts a on a.id=p.account_id;
```

provider_confirmed เป็นสถานะใน Auth ไม่ใช่หลักฐาน mailbox เมื่อปิด Confirm email
metadata เพียงอย่างเดียวไม่แทนการยืนยันตัวบุคคล/step-up ในการโอนสิทธิ์

## เกณฑ์ซ้อมและการตรวจรับ

- ซ้อมด้วย fixture/stack แยก: JWT เก่าหลัง revoke deny, factor unverified ไม่ให้ privileged write, verified factor ใหม่ใช้งานได้
- ตรวจ expected-owner mismatch, target ไม่ active/ไม่มี MFA/ไม่มี admin grant และการถอน protected owner ต้องถูกปฏิเสธ
- ผลจริงของ owner ปัจจุบัน Google/MFA/admin access ผ่านแล้วตาม PLATFORM_REPORT_TH; ไม่ถือว่าได้ซ้อมสูญหายหรือโอน owner จริง
- รอบ C-23 ซ้อมบัญชีสมมติใน validation stack แล้ว: ลบ verified factor ผ่าน Auth Admin, session aal2 เดิมหมด assurance ใน DB และ polling fingerprint เปลี่ยน จากนั้น enroll/verify factor ใหม่สำเร็จ; ไม่แตะ factor ของ owner จริง
- คู่มือนี้ยังต้องเจ้าของระบุคน/ช่องทางตรวจสอบก่อนใช้งาน incident จริง; Email Recovery/SMTP อยู่ gate ก่อน production launch ตาม C-24
