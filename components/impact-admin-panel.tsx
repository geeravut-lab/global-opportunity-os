"use client";
import { useRef, useState } from "react";
import { BusyForm } from "./busy-form";
import Link from "./busy-link";
import { busyFetch } from "@/lib/ui/activity";
import { useBusyRouter } from "@/lib/ui/router";
export type ImpactAdminState = { organizations: { id: string; name: string }[]; grants: { id: string; account: string; organization: string | null; expires: string }[] };
export function ImpactAdminPanel({ lang, initial: d }: { lang: "th" | "en"; initial: ImpactAdminState }) {
  const say = (a: string, b: string) => lang === "th" ? a : b, router = useBusyRouter(), lock = useRef(false);
  const [account, setAccount] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false), [saved, setSaved] = useState(false);
  async function run(path: string, body: unknown) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(false); setSaved(false);
    try { const r = await busyFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) { setError(true); return; } if (path === "/api/policy") { if (j.data?.active && j.data?.verified && j.data?.mfa) setAccount(j.data.account_id); else setError(true); } else { setSaved(true); router.refresh(); } } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  }
  return <main id="main" className="account-page s2-page" data-live-busy={busy || router.isPending}><h1>{say("สิทธิ์รายงานผลลัพธ์รวม", "Aggregate report permissions")}</h1><Link href={`/${lang}/admin`}>{say("กลับผู้ดูแล", "Back to administration")}</Link>
    <p>{say("เลือกบัญชีที่มี MFA และบทบาทองค์กรจริง สิทธิ์รายงานไม่เพิ่มสิทธิ์เคสหรือรายชื่อบุคคล รายงาน platform จำกัดเจ้าหน้าที่ impact ที่ยังมี scope เท่านั้น", "Choose an existing MFA account with a current organization role. Report grants do not grant case or personal-record access. Platform reports are limited to current internal impact staff.")}</p>
    {error && <p role="alert">{say("ทำรายการไม่ได้ ตรวจบัญชี MFA บทบาทองค์กร และอายุสิทธิ์", "Unable to complete. Check the account, MFA, organization role and grant expiry.")}</p>}{saved && <p role="status">{say("บันทึกแล้ว", "Saved")}</p>}
    <BusyForm className="panel form-grid" onSubmit={e => { e.preventDefault(); setAccount(null); void run("/api/policy", { action: "lookup", email: new FormData(e.currentTarget).get("email") }); }}><fieldset disabled={busy}><label>{say("Email บัญชีที่มีอยู่แล้ว", "Existing account email")}<input name="email" type="email" required autoComplete="off" /></label><button type="submit">{say("ตรวจบัญชีและ MFA", "Check account and MFA")}</button></fieldset></BusyForm>
    {account && <BusyForm className="panel form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run("/api/impact/admin", { account, organization: f.get("organization") || null, expires: new Date(Date.now() + Number(f.get("days")) * 86400000).toISOString(), grant: true }); }}><fieldset disabled={busy}><label>{say("ขอบเขต", "Scope")}<select name="organization"><option value="">{say("รวม platform (เฉพาะทีม impact)", "Platform (internal impact staff only)")}</option>{d.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>{say("อายุสิทธิ์เป็นวัน", "Grant duration in days")}<input name="days" type="number" min={1} max={90} defaultValue={30} required /></label><button type="submit">{say("ให้สิทธิ์รายงาน", "Grant report access")}</button></fieldset></BusyForm>}
    <section className="panel"><h2>{say("สิทธิ์ที่ยังใช้งานได้", "Active grants")}</h2>{!d.grants.length && <p>{say("ยังไม่มีสิทธิ์รายงาน", "No report grants")}</p>}{d.grants.map((g, index) => <article className="catalog-card" key={g.id}><h3>{d.organizations.find(o => o.id === g.organization)?.name ?? "Opp4All"} · {index + 1}</h3><p className="source-hash">{g.account}</p><p>{say("หมดอายุ", "Expires")}: {new Date(g.expires).toLocaleDateString(lang)}</p><button disabled={busy} onClick={() => void run("/api/impact/admin", { account: g.account, organization: g.organization, expires: new Date(Date.now() + 60000).toISOString(), grant: false })}>{say("ถอนสิทธิ์รายงาน", "Revoke report access")}</button></article>)}</section>
  </main>;
}
