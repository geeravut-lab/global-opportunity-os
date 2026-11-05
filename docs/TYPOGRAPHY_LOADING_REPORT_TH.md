# การปรับตัวอักษร สี และสถานะรอของ Opp4All

วันที่5พฤศจิกายน2026 อ้าง C-30/C-31 และ [knowledge บน main](TYPOGRAPHY-COLOR-KNOWLEDGE.md)
ต้นทาง main `213b6e9` เพิ่ม knowledge และสารบัญเท่านั้น จึงนำสองไฟล์นั้นมาโดยไม่เขียนทับงาน S2/S3
แนวทาง ShopNestra เป็นข้อมูลอ้างอิง: ใช้ stack Next.js เดิมและธีมม่วง/น้ำเงิน Opp4All ไม่เพิ่มร้านค้า/ธีมรายร้าน/Tailwind

## Typography/color ที่ใช้แล้วในโค้ด

| ส่วน | ขนาด/พฤติกรรม |
| --- | --- |
| เนื้อหา ปุ่ม ช่องกรอก select/textarea | 1rem หรือ16px เมื่อ root ค่าเริ่มต้น16; line-heightฐาน1.6, controlsขั้นต่ำ44px |
| คำอธิบาย/metadata | .875rem/14px; ไม่ย่อตามจอ |
| ข้อความเล็ก | .75rem/12px จำกัด mobile bottom menu และ badgeสั้น |
| หัวข้อ | 20/24/30/36px ผ่าน rem scale ตามลำดับ; h1หลักอย่างน้อย24px |
| ฟอนต์ | Geist Variable → Noto Sans Thai Variable → system fallback, self-hosted Fontsource5.3.0 ทั้งสองชุด, font-display swap; licenses ใน public/font-licenses |
| สี | `app/theme.css` เป็นแหล่ง semantic tokens; ม่วงเข้ม/น้ำเงินเดิม, pastel ใช้ข้อความเข้ม, success/warning/error มีข้อความประกอบ |
| Keyboard/ตัวเลข | focus ring3px, field border contrast แยกจากเส้นการ์ด, tabular-nums; ไม่บีบระยะวรรณยุกต์ไทย |

lint ตรวจไม่ให้ raw hex/rgb หรือ font pxต่ำกว่า14หลุดเข้าหน้า/ส่วนประกอบ
manifest ต้องมีสี literal ตามรูปแบบ web manifest จึงยกเว้นและมี unit ตรวจว่าตรง token
ไฟล์ภาพประกอบเดิมคงสีใน asset ไม่ใช่ runtime text theme
unit คำนวณ contrast ข้อความ4.5และ focus/field boundary3; browser ตรวจ computed size หลังฟอนต์โหลดจริง

## Spinner และการกดซ้ำ

- กลางหน้าจอมีข้อความไทย–อังกฤษ `role=status` และ throbber ระหว่าง user API, route transition/refresh, ฟอร์มค้นหา GET และ protected download
- ใช้ wrapper กลาง BusyLink/BusyForm/useBusyRouter/busyFetch; pending transition ครอบคลุมจนข้อมูลหน้าถัดไปพร้อม โดยรักษา HTTP404 ของหน้าที่ไม่มีอยู่
- action เดิมมี aria-busy/aria-disabled และกัน duplicate click/submit; ไม่ล็อกทุกส่วนของหน้าจอ ผู้ใช้ยังอ่านหรือย้ายงานได้
- API รอ body จบและคืนสถานะทั้ง success/error/abort ใน finally; navigation อิง transition/page lifecycle จริง ไม่ตั้งเวลาปิดลวง
- backend idempotency/expected version/unique constraints ยังป้องกันการเขียนซ้ำ แม้กดจากหลายแท็บหรือเรียก API โดยตรง
- background Live polling/Realtime renewal/prefetch ไม่เปิด spinner; toggle/dialog ที่เปลี่ยนทันทีไม่ต้องรอ network และไม่เพิ่มการหน่วงเทียม
- ปุ่มไป Google แสดงสถานะก่อนออกจากแอป; หลังออกไป provider แล้วเป็นหน้าของ provider ที่แอปควบคุมไม่ได้
- reduced-motion ใช้ indicator คงที่พร้อมข้อความ; download จบเมื่อรับ bytes/ส่งต่อการบันทึกให้ browser ไม่อ้างว่าทราบว่าเขียนไฟล์ลงเครื่องแล้ว

## หลักฐานและข้อจำกัด

ผลสุดท้ายของ build/unit/browser/axe/reflow และ spinner ที่หน่วง API/navigation อยู่ใน [รายงาน S3](S3_REPORT_TH.md)
ก่อนผลชุดสุดท้าย ห้ามใช้เอกสารนี้กล่าวว่า hosted ผ่าน ทุกการทดสอบในงานนี้ใช้ local/synthetic data
ยังต้องทดสอบ Safari/iOS/Android จริงและ NVDA/VoiceOver กับเจ้าของ; automated checks ไม่ใช่ใบรับรอง WCAG

ขั้นถัดไป: review PR ที่ต่อจาก S2 → ตรวจ rollout/worker/notices → hosted UAT และ S1 network/recovery ตาม [งานถัดไป](NEXT_STEPS.md)
