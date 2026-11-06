"use client";
import { useRef, useState } from "react";
import Link from "./busy-link";
import { BusyForm } from "./busy-form";
import { busyFetch } from "@/lib/ui/activity";
export function DeletionReceipt({ lang, request }: { lang: "th" | "en"; request?: string }) {
  const say = (a: string, b: string) => lang === "th" ? a : b, lock = useRef(false);
  const [busy, setBusy] = useState(false), [receipt, setReceipt] = useState(""), [status, setStatus] = useState<Record<string, string> | null>(null), [error, setError] = useState(false);
  async function run(value?: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(false);
    try {
      const r = await busyFetch(value ? "/api/purge/status" : "/api/purge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value ? { receipt: value } : { action: "receipt", request }) }); const j = await r.json();
      if (!r.ok) { setError(true); return; } if (value) setStatus(j.data); else setReceipt(j.data);
    } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  }
  const names: Record<string, string> = lang === "th" ? { state: "สถานะคำขอ", live_database: "ข้อมูลที่ระบบใช้งาน", authentication: "บัญชีเข้าสู่ระบบ", recipient_cessation: "การหยุดใช้ข้อมูลของผู้รับ", backups: "สำเนาสำรอง", external_copies: "สำเนาที่ผู้รับเก็บไว้" } : { state: "Request status", live_database: "Live data", authentication: "Sign-in identity", recipient_cessation: "Recipient cessation", backups: "Backups", external_copies: "External recipient copies" };
  return <main id="main" className="account-page s2-page"><h1>{say("ติดตามคำขอลบข้อมูล", "Track a deletion request")}</h1>
    <p>{say("เก็บรหัสติดตามไว้ในที่ปลอดภัย รหัสนี้ใช้ดูสถานะได้หลังบัญชีถูกลบ โดยไม่แสดงข้อมูลส่วนบุคคลหรือรายละเอียดเคส", "Keep your tracking key safe. It can show status after account deletion without exposing personal data or case details.")}</p>
    {error && <p role="alert">{say("ไม่พบคำขอหรือยังทำรายการไม่ได้ กรุณาตรวจรหัส/สิทธิ์แล้วลองใหม่", "Request unavailable. Check your key/permission and retry.")}</p>}
    {request && <BusyForm className="panel" onSubmit={e => { e.preventDefault(); void run(); }}><fieldset disabled={busy}><button type="submit">{say("สร้าง/เปลี่ยนรหัสติดตามคำขอของฉัน", "Create/rotate my tracking key")}</button></fieldset><p>{say("หากเปลี่ยนรหัส รหัสเก่าจะใช้ไม่ได้", "Rotating the key invalidates the previous key.")}</p></BusyForm>}
    {receipt && <section className="panel"><h2>{say("บันทึกรหัสนี้ก่อนบัญชีถูกลบ", "Save this key before account deletion")}</h2><label>{say("รหัสติดตามส่วนตัว", "Private tracking key")}<textarea readOnly value={receipt} rows={3} autoComplete="off" /></label></section>}
    <BusyForm className="panel form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(String(f.get("receipt"))); }}><fieldset disabled={busy}><label>{say("รหัสติดตาม", "Tracking key")}<input name="receipt" type="password" autoComplete="off" spellCheck={false} minLength={64} maxLength={64} required /></label><button type="submit">{say("ตรวจสถานะ", "Check status")}</button></fieldset></BusyForm>
    {status && <section className="panel" role="status"><h2>{say("ผลติดตาม", "Tracking result")}</h2><dl>{Object.entries(status).map(([k, v]) => <div key={k}><dt>{names[k] ?? k}</dt><dd>{v}</dd></div>)}</dl><p>{say("สถานะ live data ไม่ได้แปลว่าสำเนาภายนอกหรือ backup ถูกลบทันที การกู้คืนต้อง replay ledger ก่อนเปิดบริการ", "Live-data completion does not mean immediate deletion of external copies or backups. Restore requires ledger replay before service resumes.")}</p></section>}
    <Link href={`/${lang}/policy`}>{say("อ่านนโยบายและช่องทาง privacy", "Read the policy and privacy contact")}</Link>
  </main>;
}
