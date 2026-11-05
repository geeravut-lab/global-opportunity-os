# ตั้ง SMTP และปิด Recovery บนระบบจริง

สถานะ C-32: ยังไม่มี SMTP provider/sender credentials ใน Supabase จึงไม่อ้างว่า email delivery หรือ recovery บน hosted ผ่าน
Confirm email ยังคง Off ตามเจ้าของ ไม่เปิดกลับโดยอัตโนมัติ; Google OAuth settings เดิมคงไว้

## ข้อมูลที่ต้องมี

ใช้ provider/account ที่เจ้าของมีอยู่และผู้ส่งที่ provider อนุญาตแล้ว ไม่สร้างบัญชีเสียเงินหรือซื้อ domain จากขั้นตอนนี้
ตั้ง SMTP_HOST, SMTP_PORT (465หรือ587), SMTP_USER, SMTP_PASSWORD และ SMTP_FROM (อีเมลผู้ส่ง) ผ่าน Secret Settings หรือ Vercel Production encrypted Environment Variables
แจ้งเฉพาะชื่อprovider/อีเมลผู้ส่งในแชต ไม่ส่งpassword/API key/OTP/recovery link
ถ้าใช้Secret SettingsของCloudต้องให้runtimeเห็นbindingsจริง ถ้าใช้Vercelให้ระบุว่าเป็นProduction

## งานที่จะทำเมื่อข้อมูลครบ

1. ตรวจ sender/provider/TLS และตั้ง Supabase Authentication SMTP โดยไม่เปลี่ยนSite URL/Google/Confirm emailที่เจ้าของตั้งไว้
2. ตั้งVercelproductionvarsเฉพาะSMTP ไม่ใส่management/service-role token ลงแอป แล้วdeployเพื่อรับenvใหม่
3. workerจะเริ่มclaimemailเฉพาะเมื่อconfigครบ; ตรวจ opt-in/safe contact/revalidate/Message-ID/retry/dead-letter และgeneric content
4. ทดสอบ recoveryในbrowserเดียวกันด้วยPKCE/HttpOnly cookies, fixedcallback, existence-neutral response, เปลี่ยนpasswordและsign out; ตรวจpasswordเก่าใช้ไม่ได้/MFAที่มีอยู่ยังบังคับ
5. ใช้เฉพาะบัญชีสมมติและmailboxที่เจ้าของควบคุมและอนุญาต ไม่มีการส่งถึงpartner/beneficiaryจริงเพื่อทดสอบ

ต้องมีtaskที่เข้าถึง opp4all.vercel.app และProject Supabase hostnameได้จริงก่อน hosted browser tests
การตั้งค่าSMTPสำเร็จหรือproviderยอมรับmessageยังไม่ใช่หลักฐานว่าownerเปิดrecovery/เปลี่ยนpasswordสำเร็จ
เมื่อทดสอบแล้วบันทึกtarget/commit/จำนวนกรณี/cleanup โดยไม่เก็บOTP/link/credentialsในรายงานหรือCIartifact

## ก่อนข้อมูลจริง

ระบุผู้รับผิดชอบsender/domain/DNS/delivery/bounce/abuse และquota/provider policy
กำหนดAuth confirmation policyหลังช่วงทดสอบและให้เจ้าของยืนยันก่อนเปลี่ยน; localMailpitหรือConfirmOffsignupไม่พิสูจน์mailbox ownership
Backup/PITR/RPO/RTOและmanualAT/device/UATเป็นงานS6แยกจากAuth recovery

## Resend ที่เจ้าของเลือก

เจ้าของเลือก Resend ในแชตรอบนี้ แต่ยังไม่ได้ระบุโดเมน/อีเมลผู้ส่งหรือใส่ API key
อ้างอิง [Resend: Send with SMTP](https://resend.com/docs/send-with-smtp), [API Keys](https://resend.com/api-keys) และ [Domains](https://resend.com/domains)

| ตัวแปร        | ค่า / วิธีหา                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------- |
| SMTP_HOST     | `smtp.resend.com`                                                                                 |
| SMTP_PORT     | `465` ใช้ TLS                                                                                     |
| SMTP_USER     | `resend`                                                                                          |
| SMTP_PASSWORD | Resend → API Keys → Create API Key; ใช้ key สำหรับ sending access โดยจำกัดโดเมนที่จะส่งเมื่อทำได้ |
| SMTP_FROM     | อีเมลบนโดเมนที่ยืนยันแล้ว เช่น `noreply@yourdomain.com`; ตัวอย่างนี้ไม่ใช่อีเมลที่ตั้งให้แล้ว     |

ใน Resend เปิด Domains → Add Domain แล้วเพิ่ม DNS ตามค่าที่ Resend แสดงจน Verified
ต้องเป็นโดเมนที่เจ้าของจัดการ DNS ได้ ไม่ใช้ `opp4all.vercel.app` เป็นโดเมนผู้ส่งของตนเอง
หากยังไม่มีโดเมนที่ยืนยันแล้ว การส่งแบบทดสอบที่จำกัดผู้รับของ Resend ไม่ถือเป็น SMTP production พร้อมใช้งาน

เก็บทั้งห้าค่าผ่าน Secret Settings ของ Cloud Environment หรือ Vercel → Project → Settings → Environment Variables สำหรับ Production
ห้ามใส่ในตัวแปร `NEXT_PUBLIC_*`, commit, screenshot หรือแชต; แจ้งเฉพาะอีเมลผู้ส่งและตำแหน่งที่เก็บค่าเมื่อพร้อม
worker และ Supabase Auth ต้องตั้งแยกกัน: การตั้ง SMTP ใน Supabase อย่างเดียวไม่ทำให้ notification worker มี credentials
ยังไม่เปลี่ยน rate limit/plan หรือ DNS ของผู้ส่งโดยไม่มีค่าจริงและขอบเขตจากเจ้าของ

## Network ของ Cloud Environment

ปัญหานี้ไม่ใช่เมนูใน Supabase/Vercel และไม่ต้องออก API key ใหม่
ณ รอบตรวจนี้ runtime ใช้ revision `1` และอนุญาตเฉพาะ management APIs แม้ draft มีสองโดเมนเว็บ/Project แล้ว
เครื่องมือใน task ไม่มีคำสั่ง rebind/apply/restart และไม่มีเมนู rebind ที่ยืนยันได้ จึงไม่ให้เจ้าของค้นหาเมนูที่อาจไม่มี

1. ตรวจ Cloud Environment configuration ของแชตให้มี `opp4all.vercel.app` และ `fxqgvqvthrdzmgnmqgom.supabase.co` แล้ว Publish configuration ที่ถูกต้อง
2. เริ่ม task ใหม่โดยใช้ Environment รุ่นที่ publish แล้ว ไม่ใช่เพียง redeploy Vercel หรือเปลี่ยน Supabase settings
3. หาก task ใหม่ยังใช้รุ่นเก่า ให้ฝ่ายช่วยเหลือของแพลตฟอร์มตรวจ runtime/config binding พร้อมข้อมูลด้านล่าง ไม่มี credentials

- Environment ID: `ccarenv_b64_Y2NhcmVudl83OTQ4YzMyZTFkNzg4MTkxOTQzZjdiOTg0MDNiMTcxNQ`
- Source config: `1dadeda9-e93a-48b5-a4b8-d200b451ff17~cecfg_6aeae1e97f9c81a29bc8bf0e668c7680`
- Runtime source version ที่ยังใช้อยู่: `1dadeda9-e93a-48b5-a4b8-d200b451ff17~cecfgver_6aeb296fd85881a2b871bef424f0fe71`
- อาการ: configuration draft มี host ครบ แต่ observed/spec revision `1` ของ task ยังอนุญาตเฉพาะ `api.github.com`, `api.supabase.com`, `api.vercel.com`

อย่าใช้ remote proxy/worker/DB HTTP extension เพื่อเลี่ยง network policy ไปทำ hosted browser tests
cron เรียก maintenance endpoint เป็นงาน production ที่อนุมัติแยกต่างหาก ไม่ใช่หลักฐานว่า browser Email/Live/สิทธิ์ผ่าน
