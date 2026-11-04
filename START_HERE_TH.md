# เริ่มต้นใช้งาน Starter Pack

ชุดนี้เป็นเอกสารและโครงสร้าง Repository ยังไม่มีโปรแกรมที่รันได้ ไม่มีฐานข้อมูลจริง และไม่มีคำสั่งติดตั้งแอปในขั้นนี้ เอกสารหลักใช้ภาษาอังกฤษเพื่อให้ทีมและ Codex อ้างอิงได้ร่วมกัน

## 1. นำเข้า Repository ที่สร้างไว้แล้ว

1. แตก ZIP แล้วเปิดโฟลเดอร์ `global-opportunity-os` ด้านใน
2. นำ **เนื้อหาภายใน** ไปไว้ที่รากของ Repository เดิม ให้ `AGENTS.md` อยู่ระดับเดียวกับ `README.md` อย่าสร้างโฟลเดอร์ซ้อนเป็น `global-opportunity-os/global-opportunity-os`
3. หากมี README หรือเอกสารเดิมอยู่ ให้เทียบและรวมเนื้อหา เก็บงานเดิมไว้ ตรวจไฟล์ซ่อน `.github`, `.gitignore`, `.gitattributes` และ `.editorconfig` ด้วย
4. ไม่ต้องนำ ZIP กลับเข้า Repository และห้ามใส่รหัสผ่าน API key หรือข้อมูลผู้รับความช่วยเหลือจริง

วิธีง่าย: ใช้ GitHub Desktop เปิดหรือ Clone Repository เดิม คัดลอกไฟล์เข้าที่โฟลเดอร์นั้น ตรวจรายการเปลี่ยนแปลง สร้าง branch เช่น `docs/starter-pack` แล้ว Commit → Push → เปิด Pull Request ตรวจและ Merge เมื่อพร้อม

ถ้าใช้หน้าเว็บ GitHub: สร้าง branch ก่อน เลือก Add file → Upload files แล้วอัปโหลดไฟล์/โฟลเดอร์ที่แตกแล้ว ตรวจตำแหน่งและไฟล์ซ่อน หากตัวเลือกไฟล์ไม่แสดง `.github` ให้ใช้ GitHub Desktop แทน อย่าอัปโหลดเพียง ZIP เพราะ Codex จะไม่ได้เอกสารที่ราก Repository

## 2. ตัวอย่างคำสั่ง Git (ทางเลือก)

รันในโฟลเดอร์ Repository ที่ Clone ไว้และเชื่อม remote แล้ว ตรวจสถานะก่อนเสมอ ตัวอย่างนี้ไม่ Clone ซ้ำ ไม่ตั้ง remote ใหม่ และไม่บังคับทับประวัติ

```powershell
git status
git switch -c docs/starter-pack
```

คัดลอกไฟล์หลังตรวจและรวมไฟล์เดิมแล้ว จากนั้นเลือกเพิ่มเฉพาะไฟล์ของชุดนี้:

```powershell
git add AGENTS.md README.md CODEX_KICKOFF.md START_HERE_TH.md docs apps packages supabase tests .github .gitignore .gitattributes .editorconfig
git diff --cached --stat
git diff --cached
git commit -m "docs: add Global Opportunity OS development starter pack"
git push -u origin docs/starter-pack
```

ตรวจรายการที่ staged ว่าไม่มีงานอื่นหรือข้อมูลลับก่อน Commit หากชื่อ branch มีแล้วให้เลือกชื่อใหม่ ไม่ใช้ force push เปิด PR ใน GitHub และ Merge ตามกติกา Repository เดิม การคัดลอกชุดนี้ไม่เปลี่ยนสิทธิ์การเชื่อมต่อ GitHub และไม่ Deploy เว็บ

## 3. เริ่มงานใน Codex

เลือก Repository นี้และ branch ที่มีเอกสารแล้ว หรือ Merge ก่อนแล้วเลือก branch หลัก เปิดแชตใหม่สำหรับงานพัฒนา คัดลอก prompt แรกใน `CODEX_KICKOFF.md` ให้ Codex ทำ Sprint 0: อ่านเอกสาร ตรวจข้อขัดแย้ง และสร้างแผนก่อนเขียนแอป

ตรวจ `docs/DECISIONS.md`: C-* คือสิ่งที่คุณระบุชัดเจน P-* คือข้อเสนอที่ยังไม่อนุมัติ ตัวเลือกเทคโนโลยี ไทยเป็นตลาดนำร่อง ราคา และขอบเขต MVP ยังเป็นข้อเสนอ ไม่ต้องอนุมัติทุกอย่างเพียงเพื่อให้ Codex ทำแผน

เมื่อแผนพร้อม ระบุขอบเขตที่จะให้สร้างอย่างชัดเจน เช่น “อนุมัติเทคโนโลยีตาม P-04 และให้เริ่มเฉพาะหน้า directory ไทย/อังกฤษด้วยข้อมูลจำลองตามแผน” แล้วใช้ prompt ที่สอง หลังเริ่มมีโค้ด Codex ต้องเพิ่มคำสั่งติดตั้ง/รัน/ทดสอบที่ตรวจแล้วใน README

การเริ่มพัฒนาไม่เท่ากับอนุมัติเปิดใช้จริง: ระบบเด็ก การเก็บข้อมูลจริง พันธมิตร และการ Deploy มีเงื่อนไขใน `docs/RELEASE_GATES.md` ต้องมีผู้รับผิดชอบและหลักฐานพร้อมก่อน
