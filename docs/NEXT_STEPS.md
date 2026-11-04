# สิ่งที่เจ้าของต้องทำต่อหลังปรับตาม Blueprint

วันที่ 2026-11-04 งานรอบนี้คือ “ปรับต้นแบบ 3 มุมมองและแผนทุก Phase ก่อน” ตาม C-10
ไม่ต้องเลือกขอบเขตเดิมซ้ำ ไม่ใช้จำนวน Phase เดิม 0–5 อ้างเป็น roadmap ปัจจุบัน

## ทบทวนตอนนี้

1. ดูต้นแบบผู้ใช้ `/th`, NGO `/th/demo/partner`, admin `/th/demo/admin` และสลับอังกฤษ
2. ดู [ภาพหน้าจอและผลตรวจ](PROTOTYPE_REPORT_TH.md) เทียบกับภาพ Showcase
3. อ่าน [ผลเทียบและส่วนที่ยังต่าง](BLUEPRINT_ALIGNMENT_TH.md) และ [แผน S0–S6](PHASE_PLAN_TH.md)
4. ทบทวนฟังก์ชัน/หน้าจอที่ต้องการแก้ใน prototype ก่อนขยับสู่ระบบจริง

## ก่อนให้เริ่ม S1 ของระบบจริง

ต้องมีขอบเขต pilot/country/adult boundary และเจ้าของ safety/privacy ตาม BP-D-01/03/04
ระบุงบ/คน/region/database plan กับ BP-D-02 และทำ auth-to-DB/RLS spike/ADR
เลือก disposition Tailwind/monorepo และ OpenAPI/data constraints ตามแผน
ไม่ต้องเลือกประเทศที่สอง ราคา หรือ AI vendor เพื่อปิดงานต้นแบบปัจจุบัน

Vercel เลือกแล้วตาม C-09 และเจ้าของแจ้งว่าเชื่อม GitHub; ยังไม่ได้ตรวจ integration หรือแก้ Project
หากจะส่งสาขาหรือให้ Preview deploy ต้องอนุญาตขั้นที่ต้องการก่อน เพราะ push อาจกระตุ้น deployment
ยังไม่อนุญาต production deployment หรือใช้ข้อมูลผู้รับประโยชน์จริง

## ส่งต่อไป Project เดิม

หากแชตใน ChatGPT มีเมนู `⋯` → Move to project ให้เลือก Project เดิมแล้วตรวจว่าบทสนทนาปรากฏจริง
หากเป็น Codex/ไม่มีเมนู ให้แนบ README, docs/INDEX และไฟล์อ้างอิงที่เชื่อมจากนั้นใน Project ปลายทาง
การเลือก repo เดียวกันไม่ย้ายประวัติแชต และการ publish cloud environment ไม่ใช่ git push

รอบนี้เก็บ snapshot งานก่อนแก้ไว้ใน local commit `3906306` และรวม main ผ่าน local merge `60de51e`
ชิ้นงานปรับ UX ต่อจากนั้นอยู่ในสาขา `feat/blueprint-ux-alignment`; ยังไม่มีการ push
ก่อนเปิดงานใหม่จาก GitHub ต้องส่งไฟล์หรือ push สาขาที่ได้รับอนุญาตก่อน อย่าสมมติว่าไฟล์ local ไปถึงปลายทางเอง

ข้อความส่งต่อ:

> Global Opportunity OS ใช้ภาษาไทยในแชต/เอกสาร อ่าน AGENTS.md, README.md และ docs/INDEX.md
> ใช้ Product Blueprint TH v1.0 และภาพ UX Showcase เป็นฐาน อนุมัติรอบนี้เฉพาะต้นแบบ 3 มุมมองและแผนทุก Phase
> แผนใหม่คือ S0–S6 ตาม docs/PHASE_PLAN_TH.md; ชิ้นงานไม่ใช่ backend/full MVP หรือระบบสิทธิ์จริง
> ตรวจ docs/DECISIONS.md, BLUEPRINT_ALIGNMENT_TH.md และ PROTOTYPE_REPORT_TH.md ก่อนเปลี่ยน
> รักษาพันธกิจทั่วโลกทุกกลุ่มและธุรกิจยั่งยืน ใช้ข้อมูลสมมติ ห้าม deploy/paid provisioning/external messages/real-data/minor workflows โดยไม่มีอนุมัติ
