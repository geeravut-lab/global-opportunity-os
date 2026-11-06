# S5 — Navigator และรายงานรวมตาม C-36

เจ้าของมอบหมายให้เลือกขอบเขตและเริ่มพัฒนา วันที่ 6 พฤศจิกายน 2026 ใช้ Next.js/TypeScript/Supabase และ dependencies เดิม
พันธกิจทั่วโลก ทุกกลุ่มผู้รับประโยชน์ และเป้าหมายธุรกิจยั่งยืนคงเดิม บริการช่วยเหลือหลักไม่เก็บเงิน/ไม่จัดอันดับตามเงินสนับสนุน

| ชิ้นงาน | Functions/features | Acceptance |
| --- | --- | --- |
| BP-B-501 | immutable public catalog corpus/chunks พร้อม listing/revision/hash/source/locale/expiry, approve provenance, invalidate ตอนหมดอายุ/พักองค์กร, lexical retrieval ก่อน vector | BP-AC-10/11; ไม่อ่าน profile/case/evidence เป็น corpus |
| BP-B-502 | Navigator ไทย–อังกฤษ, query → editable filter draft → อ้างอิงข้อมูลปัจจุบัน, uncertainty/ไม่มีผลลัพธ์, manual search/verified human contact, provider adapter/kill switch/budget/circuit breaker | ไม่มี auto-submit หรือ model mutation; links ไป S2/S3 ยังต้อง user confirmation เดิม |
| BP-B-503 | NGO/admin/CSR เฉพาะ report grant/tenant ปัจจุบัน, fixed closed-month cohorts, distinct persons, L2 ที่ยัง verified, versioned metrics, k10 และ complementary suppression, export DTO เดียวกัน | BP-AC-13; ไม่มี raw drilldown/PII/filters ตามใจ |

## Navigator ที่เลือก

- เริ่มจาก public fields ของรายการที่ independent review แล้ว ไม่ crawl arbitrary URLs หรือ index เอกสารส่วนตัว
- revalidate listing/revision/organization/expiry ก่อน retrieval และก่อนแสดงผล citation ชื่อและ URL resolve จาก server เท่านั้น
- ใช้คำอธิบาย/quotes จากต้นทางและ reason codes ที่ตรวจได้; ไม่ถือ score เป็นโอกาสได้งานหรือสิทธิรับบริการแน่นอน
- raw query อยู่เพียง request/client memory ไม่มี transcript/localStorage/analytics log; provider ได้เฉพาะ structured public filters และ approved public chunks ไม่มีชื่อ/อีเมล/subject ID หรือ case history
- provider/key/model/terms ยังไม่สมมติว่ามี เลือก adapter ที่ปิด default; เมื่อไม่มี provider ใช้ extractive source-backed guidance พร้อม manual search ได้ ต้องแสดงโหมดตามจริง
- unknown/minor disclosure ใช้ public information เท่านั้น; urgency ไม่สร้างเบอร์ฉุกเฉินจากความจำหรืออ้างว่ามีเจ้าหน้าที่รับเรื่องแล้ว
- budget, timeout, malformed output, invented IDs/quotes หรือ source เปลี่ยน → abstain/fallback โดยไม่เรียก tool เขียนข้อมูล

ไม่เพิ่ม vector service หรือ embedding ที่ต้องจ่ายเงินก่อนหลักฐานว่าจำเป็น ไม่เปิด model calls/สัญญา vendor จากการเริ่มพัฒนา

## รายงานรวมที่เลือก

- เดือนปิดแล้วและ scope องค์กรที่ได้รับสิทธิ์เท่านั้น ไม่มี query cohort ตามชื่อ/อายุ/โรค/หมู่บ้านหรือ arbitrary date windows
- snapshot หนึ่งชุดต่อ scope/month/metric version ห้าม reissue ตัวเลขรุ่นเล็กต่างกันจนใช้ subtract หาคนได้
- กลุ่มที่มีคนน้อยกว่า10ซ่อน count; เมื่อมี small positive cell ซ่อน cells/total ประกอบเพื่อกัน complementary inference รวมทั้ง export
- counts เป็น distinct subject ตาม outcome kind; total distinct แยก ไม่บวกหมวดซ้ำเป็นจำนวนคนทั้งหมด
- dispute/correction/purge/consent invalidation ทำให้ snapshot ที่เกี่ยวข้องไม่ serve; ไม่ปล่อยตัวเลขใหม่ของ cohort เดิมทันที การแก้ค่าที่เคย export ไปแล้วต้องมี recipient process
- ไม่มี causal-impact หรือ L3/audit claim และไม่มีการสร้าง CSR buyer/program จริงแทนเจ้าของ

## การตรวจรับ

ทดสอบ unit/DB/RLS/สองภาษา/keyboard/reflow/spinner, stale/suspended/no-match, invalid citations, provider failure, grant revoke/tenant/direct-ID/export และ suppression/inference cases
เตรียม synthetic contract suite ≥200 Thai/English queries และ ≥50 adversarial cases แยกจาก human-labelled relevance benchmark; ไม่อ้าง Recall/precision ตาม Blueprint ว่าผ่านก่อนมี labels และผลตรวจจริง
ผลจริง คำสั่ง และ gaps ต้องบันทึกในรายงาน S5; S5 production release และ provider terms/credentials เป็นขั้นถัดจาก development นี้
