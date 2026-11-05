# แผนดำเนิน S2 และขอบเขตที่เริ่มตาม C-28

ขอบเขต C-25 และคำสั่งล่าสุด C-28 อนุมัติเริ่ม S2 แล้วระหว่างที่ S1 hosted ยังติด Network
เริ่ม schema/API/UX ด้วยข้อมูลสมมติและ stack เดิม ไม่เปลี่ยน S1 blocked หรือ Recovery/SMTP ที่เลื่อนให้เป็นผ่าน
รายละเอียดที่เลือกในชิ้นงานอยู่ [ADR-004](adr/ADR-004-S2-TH.md); การ rollout/worker จริงยังต้องมีหลักฐานและขอบเขตที่ชัดเจน
เอกสารนี้แยกขอบเขตที่ยืนยันแล้วออกจากรายละเอียดออกแบบที่เสนอ ไม่เปลี่ยน P-* หรือ BP-D-* เป็น accepted
พันธกิจทั่วโลกทุกกลุ่มและความช่วยเหลือพื้นฐานที่ไม่เก็บค่าใช้จ่ายยังคงเดิม

## ลำดับ PR และ functions/features

| ลำดับ | งานและหน้าจอ | Schema/API ที่เสนอ | หลักฐานตรวจรับ |
| --- | --- | --- | --- |
| S2.1 / BP-B-201 | onboarding องค์กร, คิวตรวจอิสระ, ขอข้อมูลเพิ่ม, verify/expire/suspend/appeal; ใช้ account/org/membership เดิม | verification requests/reviews/evidence metadata; draft→review→verified, expiry ตรวจขณะอ่าน; RPC ตรวจ staff MFA/current tenant/expected version | BP-AC-02/08/18, ผู้ส่งตรวจตัวเองไม่ได้, revoked member/old JWT deny, องค์กร A อ่านหลักฐาน B ไม่ได้; audit และ Live sync เฉพาะผู้มีสิทธิ์ |
| S2.2 / BP-B-201 | แนบหลักฐานองค์กรอย่างปลอดภัย | private upload intent, quarantine, byte/MIME/size checks, scan result, authorized download; ไม่เปิด public bucket | BP-AC-15; ปลอม MIME/oversize/executable/stale link/revoked access deny; ข้อมูล pending/failed scan ไม่ถูกอ่านหรือใช้ verify |
| S2.3 / BP-B-202 | partner สร้าง/แก้รายการ, admin moderation, revision/re-review, source/freshness/expiry; public detail | listing/revision/review/coverage/eligibility/cost/language/accessibility metadata; immutable approved revision; public safe DTO ผ่าน RPC | BP-AC-01 และส่วน lifecycle ของ06; draft/expired/suspended/org-invalid ไม่ออก public, material edit ไม่เผยแพร่เอง, field allowlist ไม่มี PII; การสมัครของ AC-06 เต็มอยู่ S3 |
| S2.4 / BP-B-202 | ค้นหา/filter/detail ไทย–อังกฤษจาก backend, no-results และ stale detail | server-side query/pagination, country/coverage/category/language/cost filters, bounded query; Thai normalization ใช้ fixtures พิสูจน์ก่อนเลือก search extension | guest ไม่ต้อง login, ค้นไทย/อังกฤษ/ค่าว่าง/ข้อความยาว, public cache ไม่เก็บข้อมูลบัญชี, keyboard/screen reader/reflow/low bandwidth |
| S2.5 / BP-B-203 | ประเมินความต้องการแบบข้ามคำถามได้, preference และ bookmarks ของบัญชี | assessment version/answers แบบจำกัดข้อมูล, own-account preferences/bookmarks; consent ของการบันทึกแยกจากการแชร์; optimistic conflict | cross-user/delegate ไม่มีสิทธิ์ใหม่โดยปริยาย; skip ไม่บล็อก search; no minor profile; bookmark ที่หมดอายุไม่กลายเป็นข้อเสนอปัจจุบัน; สองหน้าต่างไม่ทับ dirty draft |
| S2.6 / BP-B-203 | จับคู่ด้วยกฎที่อธิบายได้ พร้อมแก้คำตอบและค้นเองต่อ | versioned rule AST, eligible/ineligible/unknown พร้อมเหตุผลและ source revision; คำนวณบน current verified published catalog เท่านั้น | deterministic clock/rule fixtures; missing answer=unknown, ไม่มี proxy inference/paid ranking/AI final decision; stale/suspended ถูกตัดทันทีและไม่ auto-apply |

dependency: S2.1→S2.2→S2.3→S2.4; S2.5 ใช้ S1 authority และต่อ S2.4; S2.6 ใช้ S2.3+S2.5
แต่ละ PR ต้อง build/type/lint และ tests เฉพาะ lifecycle/permission ที่เปลี่ยน ไม่สะสมทุกอย่างไว้ mega-PR
ใช้ stack/dependencies ที่ pin อยู่แล้วจนมีเหตุผลและ official documentation รองรับการเพิ่ม dependency

## ข้อเสนอ architecture/permissions สำหรับ review

- ใช้ Next.js BFF และ user JWT ไปยัง RPC ที่จำกัดบทบาท NOBYPASSRLS ต่อ ไม่เพิ่ม service-role CRUD ให้ runtime
- แยก applicant/editor/reviewer และผู้มีผลประโยชน์ทับซ้อน: organization owner ไม่เท่ากับ independent verifier
- policy ตรวจ membership, MFA, account status, expiry และ current version ทุก read/write; UI ซ่อนปุ่มไม่แทน DB authorization
- public DTO มีเฉพาะ approved/current fields; verification evidence, contact ส่วนตัว, assessment และ audit ไม่อยู่ public cache/Realtime payload
- private Live sync ส่งเพียง signal ให้ผู้ที่มีสิทธิ์ แล้ว refetch ผ่าน authorization ปัจจุบัน ใช้แนวแก้ migration0013
- upload ต้องมี scan verdict ที่เชื่อถือได้ก่อนใช้หลักฐาน; ถ้ายังไม่มี scanner ให้คง quarantine ปิด download และไม่อ้างว่าตรวจแล้ว
- ไม่ตั้ง vendor scanner/paid plan หรือเลือก operational verifier จริงแทนเจ้าของ; เอกสาร/metadata/fixtures ทำต่อได้โดยไม่แต่ง partner claims
- ไม่ขยาย profile delegation S1 ไปถึง assessment/submit เอง; หากต้องเพิ่ม scope ต้องออกแบบ consent/allow-deny แยกและบันทึกขอบเขต

ชื่อ tables/routes ในตารางเป็นแผนเริ่มต้น; การเลือกจริงและคำสั่ง local ที่มีแล้วอยู่ใน [รายงาน S2](S2_REPORT_TH.md) และ [ADR-004](adr/ADR-004-S2-TH.md) ไม่ใช่คำสั่งให้ apply hosted โดยอัตโนมัติ

## Fixtures และความปลอดภัย

เตรียมองค์กร A/B ที่ไม่ใช่พันธมิตรจริง, ผู้ส่งและผู้ตรวจคนละบัญชี, รายการ current/expired/suspended/draft,
หลักฐาน MIME mismatch/quarantine, ภาษาไทย/อังกฤษ, missing eligibility answers, bookmark ที่สิทธิ์/สถานะเปลี่ยน
manifest ต้องระบุ target/run/UUID/tag และ cleanup เฉพาะ fixture; append-only audit คงไว้
ไม่มี real beneficiary data, external messages, job application, minors personalization, AI, billing หรือ production launch ใน S2 รอบนี้

## ประมาณการและเงื่อนไขส่งมอบ

ช่วง effort เดิม S2 คือ15–25 engineer-days เพื่อวางแผน ไม่ใช่เวลาที่ agent ใช้หรือสัญญาวันส่ง
แบ่งส่ง review เป็น3 PR ที่ต่อกันตามรายงาน S2 โดยคง functions6กลุ่มในตาราง; ให้ re-estimate งาน rollout/scan/operations เมื่อรู้ผู้ตรวจและนโยบายหลักฐานจริง
S2 ทำงานกับข้อมูลสมมติได้โดยไม่กล่าวว่าองค์กรได้รับการตรวจจริง; ก่อนเปิดรับข้อมูล/พันธมิตรจริงยังต้องผ่าน operational/privacy gates
Email Recovery/SMTP ที่เลื่อนไว้ต้องกลับมาปิดก่อน real-user production launch ตาม C-24
