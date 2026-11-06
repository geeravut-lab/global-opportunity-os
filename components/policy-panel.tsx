"use client";
import { useRef, useState } from "react";
import Link from "./busy-link";
import { BusyForm } from "./busy-form";
import { busyFetch } from "@/lib/ui/activity";
import { useBusyRouter } from "@/lib/ui/router";
import { retentionDefaults, type PolicyDefinition, type PolicyState, type PolicyVersion } from "@/lib/policy/model";
export function PolicyPanel({ lang, initial: d }: { lang: "th" | "en"; initial: PolicyState }) {
  const th = lang === "th", say = (a: string, b: string) => th ? a : b, router = useBusyRouter(), lock = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false), [editing, setEditing] = useState<PolicyVersion | null>(null), [lookup, setLookup] = useState<{ account_id: string; active: boolean; verified: boolean; mfa: boolean } | null>(null);
  const defaults: PolicyDefinition = { controller_name: "", country_codes: [], privacy_contact: "", service_hours: "", notice_th: "", notice_en: "", legal_review_ack: false, retention: retentionDefaults };
  const value = editing?.definition ?? defaults;
  async function run(body: Record<string, unknown>, form?: HTMLFormElement) {
    if (lock.current) return null; lock.current = true; setBusy(true); setMessage(""); setFailed(false);
    try {
      const r = await busyFetch("/api/policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json();
      if (!r.ok) { setFailed(true); setMessage(say("ทำรายการไม่สำเร็จ ตรวจสิทธิ์ ข้อมูล หรือ policy/ทีมที่ยังไม่พร้อม", "Unable to complete. Check permission, input and policy/roster readiness.")); return null; }
      if (form) form.dataset.liveDirty = "false";
      setMessage(say("บันทึกแล้ว", "Saved")); if (body.action === "lookup") return j.data; router.refresh(); window.dispatchEvent(new Event("goos:saved")); return j.data ?? true;
    } catch { setFailed(true); setMessage(say("การเชื่อมต่อขัดข้อง กรุณาลองใหม่", "Connection interrupted. Please retry.")); return null; }
    finally { lock.current = false; setBusy(false); }
  }
  const labels: Record<string, string> = th ? { draft_days: "draft ที่ไม่ใช้งาน", case_days: "เคสหลังปิด", audit_days: "consent/audit metadata", verification_days: "เอกสารตรวจสอบหลังตัดสิน", backup_target_days: "เป้าหมาย backup (ต้องตรวจ plan จริง)", request_days: "อายุคำขอส่งต่อ", share_days: "อายุการแชร์" } : { draft_days: "Inactive drafts", case_days: "Closed case content", audit_days: "Consent/audit metadata", verification_days: "Verification documents", backup_target_days: "Backup target (verify actual plan)", request_days: "Referral request validity", share_days: "Sharing validity" };
  return <main id="main" className="account-page s2-page" data-live-busy={busy || router.isPending}>
    <h1>{say("Policy, ทีมผู้ตรวจ และสิทธิ์ข้อมูล", "Policy, review team and data rights")}</h1>
    <Link href={`/${lang}/admin`}>{say("กลับผู้ดูแล", "Back to administration")}</Link>
    <p className="notice">{say("การ deploy ไม่เท่ากับเปิดรับข้อมูลจริง กรุณาระบุผู้ดำเนินการ/การทบทวนตามพื้นที่ และทีมที่มีบัญชี/MFA จริงก่อนเปิด workflow S4", "Deployment does not establish real-data readiness. Name the controller, local policy review and actual staff with MFA before full enablement.")}</p>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    <section className="panel"><h2>{say("สถานะการเปิด S4", "S4 rollout status")}</h2><p>{d.release.mode} · {say("policy", "Policy")}: {d.policy_ready ? say("พร้อม", "Ready") : say("ยังไม่พร้อม", "Pending")} · {say("ทีม", "Roster")}: {d.roster_ready ? say("มีบัญชี/MFA ครบ", "Accounts/MFA ready") : say("ยังไม่ครบ", "Incomplete")}</p>
      <div className="button-row">{["off", "owner_preview", "enabled"].map(mode => <button key={mode} disabled={busy || (mode === "enabled" && (!d.policy_ready || !d.roster_ready))} onClick={() => void run({ action: "release", mode })}>{mode === "off" ? say("ปิด S4", "Disable S4") : mode === "owner_preview" ? say("เปิดให้ผู้ดูแลตรวจ", "Owner preview") : say("เปิด workflow S4", "Enable S4 workflow")}</button>)}</div>
    </section>
    <BusyForm key={editing?.id ?? "new"} className="panel form-grid" aria-label={say("ร่างนโยบาย", "Policy draft")} onInput={e => { e.currentTarget.dataset.liveDirty = "true"; }} onSubmit={e => {
      e.preventDefault(); const el = e.currentTarget, f = new FormData(el);
      const definition = { controller_name: String(f.get("controller")), country_codes: String(f.get("countries")).toUpperCase().split(/[\s,]+/).filter(Boolean), privacy_contact: String(f.get("contact")), service_hours: String(f.get("hours")), notice_th: String(f.get("th")), notice_en: String(f.get("en")), legal_review_ack: f.get("legal") === "on", retention: Object.fromEntries(Object.keys(retentionDefaults).map(k => [k, Number(f.get(k))])) };
      void run({ action: "save", id: editing?.id ?? null, version: editing?.version, definition }, el);
    }}><h2>{say("ร่างนโยบาย", "Policy draft")}</h2><fieldset disabled={busy}>
      <label>{say("ผู้ดำเนินการ/นิติบุคคล", "Controller/operator")}<input name="controller" maxLength={200} defaultValue={value.controller_name} /></label>
      <label>{say("รหัสประเทศที่นโยบายครอบคลุม เช่น TH", "Covered country codes, e.g. TH")}<input name="countries" maxLength={80} defaultValue={value.country_codes.join(", ")} /></label>
      <label>{say("ช่องทาง privacy ที่ติดต่อได้จริง", "Working privacy contact")}<input name="contact" maxLength={254} defaultValue={value.privacy_contact} /></label>
      <label>{say("เวลารับเรื่องตามทีมจริง", "Actual staffed hours")}<input name="hours" maxLength={500} defaultValue={value.service_hours} /></label>
      <label>{say("Notice ภาษาไทย", "Thai notice")}<textarea name="th" rows={5} maxLength={6000} defaultValue={value.notice_th} /></label>
      <label>{say("Notice ภาษาอังกฤษ", "English notice")}<textarea name="en" rows={5} maxLength={6000} defaultValue={value.notice_en} /></label>
      <fieldset><legend>{say("ระยะเวลา (วัน) — ไม่ใช่อายุตามกฎหมายที่ระบบรับรอง", "Durations in days — no statutory certification")}</legend>{Object.keys(retentionDefaults).map(k => <label key={k}>{labels[k]}<input name={k} type="number" min={1} max={k === "request_days" ? 30 : k === "share_days" ? 90 : 3650} required defaultValue={value.retention[k as keyof typeof retentionDefaults]} /></label>)}</fieldset>
      <label className="check"><input name="legal" type="checkbox" defaultChecked={value.legal_review_ack} />{say("ยืนยันว่าทบทวนผู้ดำเนินการ ฐานกฎหมาย อายุการเก็บ และข้อความตามพื้นที่แล้ว", "I confirm review of controller, local lawful bases, retention and notices.")}</label>
      <button type="submit">{say("บันทึกร่าง", "Save draft")}</button>
    </fieldset></BusyForm>
    <section className="panel"><h2>{say("รุ่นนโยบาย", "Policy versions")}</h2>{d.versions.length === 0 && <p>{say("ยังไม่มี policy ที่รับรองแล้ว", "No policy has been confirmed.")}</p>}{d.versions.map(p => <article className="catalog-card" key={p.id}><h3>{p.definition.controller_name || say("ร่างที่ยังไม่ระบุผู้ดำเนินการ", "Unnamed controller draft")}</h3><p>{p.state} · {p.version}</p><details><summary>{say("ตรวจเนื้อหาและ hash", "Review content and hash")}</summary><p>{p.definition.notice_th}</p><p>{p.definition.notice_en}</p><code className="source-hash">{p.content_hash}</code></details>{p.state === "draft" && <div className="button-row"><button disabled={busy} onClick={() => setEditing(p)}>{say("แก้ไขร่าง", "Edit draft")}</button><button disabled={busy || !p.definition.legal_review_ack} onClick={() => void run({ action: "publish", id: p.id, hash: p.content_hash })}>{say("เผยแพร่รุ่นที่ตรวจแล้ว", "Publish reviewed version")}</button></div>}</article>)}</section>
    <BusyForm className="panel form-grid" aria-label={say("ค้นหาบัญชีเจ้าหน้าที่", "Find staff account")} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run({ action: "lookup", email: String(f.get("email")) }).then(v => setLookup(v && typeof v === "object" ? v : null)); }}><h2>{say("ทีมผู้ตรวจจริง", "Actual review team")}</h2><fieldset disabled={busy}><label>{say("อีเมลบัญชีที่สมัครแล้ว", "Registered account email")}<input name="email" type="email" autoComplete="off" required maxLength={254} /></label><button type="submit">{say("ตรวจบัญชี", "Check account")}</button></fieldset></BusyForm>
    {lookup && <BusyForm className="panel form-grid" aria-label={say("กำหนดขอบเขตเจ้าหน้าที่", "Assign staff scope")} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run({ action: "scope", account: lookup.account_id, scope: String(f.get("scope")), grant: true, expires: new Date(Date.now() + Number(f.get("days")) * 86400000).toISOString() }); }}><p>{lookup.active && lookup.verified ? say("บัญชีใช้งานได้", "Account active") : say("บัญชียังไม่พร้อม", "Account not ready")} · MFA: {lookup.mfa ? say("มี", "Ready") : say("ต้องตั้งก่อนรับงาน", "Required before work")}</p><fieldset disabled={busy}><label>{say("หน้าที่", "Scope")}<select name="scope"><option value="impact">Impact</option><option value="privacy">Privacy</option><option value="safety">Safety</option></select></label><label>{say("อายุสิทธิ์ (วัน)", "Scope duration in days")}<input name="days" type="number" min={1} max={90} defaultValue={30} required /></label><button type="submit">{say("ให้สิทธิ์แบบมีวันหมดอายุ", "Grant expiring scope")}</button></fieldset></BusyForm>}
    <section className="panel"><h2>{say("ขอบเขตเจ้าหน้าที่ปัจจุบัน", "Current staff scopes")}</h2>{d.roster.map((r, i) => <p key={i}>{r.scope} · {r.account_id} · {r.expires_at} · MFA: {r.mfa ? say("พร้อม", "Ready") : say("ยังไม่พร้อม", "Pending")}</p>)}</section>
    <Link href={`/${lang}/admin/purge`}>{say("ตรวจคำขอลบและ ledger", "Review deletion requests and ledger")}</Link>
  </main>;
}
