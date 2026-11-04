# ADR-004 — ฐานองค์กร catalog และคำแนะนำใน S2

วันที่5พฤศจิกายน2026 ขอบเขต C-28 และ BP-B-201–203
การเริ่ม S2 ตามคำสั่งล่าสุดเปลี่ยนเงื่อนไขลำดับงานของ C-27 เท่านั้น S1 hosted ยัง blocked ไม่เปลี่ยนเป็นผ่าน
stack เดิม Next.js16/React19/TypeScript/Supabase/PostgreSQL/sharp ตาม lockfile ไม่มี dependency ของแอปเพิ่ม
รายละเอียดด้านล่างเป็นการเลือกทางเทคนิคสำหรับชิ้นงานสมมติ ไม่รับรองนโยบาย production/partner/legal หรือ G/P อื่น

## ขอบเขตที่พัฒนา

| ส่วน | พฤติกรรมและขอบเขตสิทธิ์ |
| --- | --- |
| องค์กร | version/expiry, ส่งตรวจ/เริ่มตรวจ/ขอแก้/ยืนยัน/ปฏิเสธ/ระงับ/อุทธรณ์; ผู้ตรวจมี platform grant+MFA ปัจจุบัน และไม่เป็นผู้สร้างหรือสมาชิกองค์กรนั้นแม้ถูกถอนสมาชิกแล้ว |
| การอุทธรณ์ | ผู้ตัดสินปฏิเสธ/ระงับครั้งก่อนรับอุทธรณ์เองไม่ได้; assigned reviewer และ expected version ป้องกันผู้ตรวจสองคนเขียนทับกัน |
| หลักฐาน | private binary table, upload intent15นาที, PNG≤1MiB, quarantine→clean/rejected, worker decode/re-encode ด้วย sharp; ผู้ใช้ส่งสถานะ clean เองไม่ได้ |
| การอ่านหลักฐาน | user JWT/DB ตรวจสมาชิกและ MFA ทุกครั้ง รวม token เดิมหลังถอนสิทธิ์; ให้เฉพาะภาพที่สร้างใหม่ผ่าน download proxy แบบ attachment/no-store/nosniff/CSP sandbox ไม่เผย original bytes/ชื่อไฟล์สู่ public |
| Catalog | root แยกจาก immutable revisions; independent publish event, organization verification และ expiry ต้องถูกต้องพร้อมกัน; material edit สร้างฉบับใหม่และหยุด public จนตรวจใหม่ |
| ค้นหาสาธารณะ | anon RPC safe DTO, Thai/English normalization, country/area/category/language/accessibility/online/free filters, pagination20ต่อหน้า จำกัด100หน้า; ไม่มี fallback รายการแต่งเมื่อ backend ขัดข้อง |
| Assessment | subject เจ้าของเองเท่านั้น; goals/country/area/language/online/hours ข้ามได้ทั้งหมด; draft/confirmed, version lock, notice เฉพาะ assessment ไทย/อังกฤษ และ append-only confirmation history; profile delegate ไม่ได้สิทธิ์ assessment |
| Bookmarks | บันทึกซ้ำไม่เพิ่มรายการ แยกเจ้าของ; เมื่อรายการหมดอายุ/ถูกระงับแสดง unavailable โดยไม่คืนข้อมูล draft หรือฉบับเก่า |
| Matching | กฎ allowlist ไม่รับ SQL/JS; country/area/modality coverage และกฎที่ประกาศ; eligible/ineligible/unknown พร้อมเหตุผล, schema/rule version; ข้อมูลที่ไม่ตอบเป็น unknown ไม่อนุมานข้อมูลอ่อนไหว ไม่ auto-apply/ตัดสินสิทธิ์ขั้นสุดท้าย |
| Live sync | private empty signals, public-only catalog digest/deadline wake และ refetch ผ่าน authorization ปัจจุบัน; ข้อมูล assessment ส่ง signal เฉพาะเจ้าของ ไม่ส่งให้ delegate; draft และ conflict ใช้ expected version |

## PNG inspection และสิ่งที่ยังไม่ได้อ้างว่าทำแล้ว

เลือก PNG-only สำหรับ slice นี้ เพื่อให้มีเส้นทางตรวจชนิด/ขนาด/pixels/animation และสร้าง bytes ใหม่ที่ไม่ส่ง original metadata กลับ
`scripts/process-evidence.mjs` รันได้เฉพาะ local port54322 ผ่าน operator connection; รับ UUID เฉพาะไฟล์ได้ ใช้ row lock/SKIP LOCKED และลบ original หลังตัดสิน
ไม่มี public scan-verdict RPC ไม่มี key ของ operator/service role ใน browser หรือ Next runtime
นี่ **ไม่ใช่ general-purpose antivirus/PDF/Office scanning** และยังไม่มี production worker/queue/ผู้รับผิดชอบที่ deploy แล้ว
การนำไปใช้จริงต้องยืนยันชนิดเอกสาร นโยบายตรวจและ retention พร้อม worker/monitoring; เมื่อ worker ไม่พร้อมให้คง quarantine ไม่รับรองว่าไฟล์ปลอดภัยแล้ว
ค่า intent15นาที/20uploadsต่อวัน/1MiB เป็นข้อกำหนดทดสอบที่เลือกทางเทคนิค ไม่ใช่นโยบายที่ owner รับรองสำหรับผู้ใช้จริง

## Authorization และการจัดเก็บ

ใช้ request user JWT→BFF→RPC ที่ owner เป็น `goos_api` NOLOGIN/NOINHERIT/NOBYPASSRLS
predicate `goos_authz` อ่าน metadata สิทธิ์ผ่าน RLS policies ที่จำกัดบทบาท ห้าม authenticated/anon เปลี่ยนเป็นบทบาทภายใน
เปิด RLS ทุกตารางใหม่ แยก column grants ของ upload จากสิทธิ์ inspection; actor/organization/status/version ตรวจใน DB ไม่เชื่อ client metadata
เหตุผล review/หลักฐาน/assessment/consent ไม่อยู่ public DTO หรือ Realtime payload; audit เก็บ ID/action/time ตามฐาน S1
notice ฉบับ development เป็น immutable และผูก purpose/profile/assessment ชัดเจน ไม่ใช้ข้อความทดสอบเป็นหลักฐาน lawful basis/retention ที่รับรองแล้ว

## การเปิดใช้และทดสอบ

`S2_ENABLED=true` เปิด UI/BFF/public catalog backend ในเครื่องเท่านั้นตามการตั้ง env ของ process
flag ไม่ใช่ authorization; direct RPC ยังตรวจสิทธิ์และ grants ของ DB ส่วนค่าเริ่มต้นยังคงต้นแบบเดิมเพื่อไม่เปิด backend ที่ยังไม่ migrate
runtime ของแอปไม่มี management token/service_role; fixture/worker/local DB tools ไม่ถูกเรียกจากหน้าเว็บ
S2 migrations ใหม่14–17 ยังไม่ใช้กับ Supabase ที่ให้บริการจริงในรอบพัฒนานี้
ดูคำสั่งและผลจริงในรายงาน S2 เมื่อจัดชุดทดสอบเสร็จ; ไม่ถือว่า build/local tests ทำให้ hosted หรือ pilot gates ผ่าน

## ช่องว่างก่อน rollout/ผู้ใช้จริง

- ยืนยันและทดสอบ worker สำหรับ environment เป้าหมาย, ชนิดเอกสาร/scan policy, expiry/revalidation operation และผู้ตรวจอิสระจริง
- ทดสอบ hosted JWT/Realtime/tenant/HTTPS ที่ค้างจาก S1; SMTP/Recovery ยังเลื่อนตาม C-24 ก่อนผู้ใช้จริง
- approved processing/retention notices, support/recovery roster, backup/RPO/RTO และ device/screen-reader UAT ตาม release gates
- applications/cases/referrals/AI/impact/LINE/paid services/minor personalization ไม่อยู่ในการอนุมัติ S2 นี้
