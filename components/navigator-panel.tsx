"use client";
import { useEffect, useRef, useState } from "react";
import Link from "./busy-link";
import { BusyForm } from "./busy-form";
import { busyFetch } from "@/lib/ui/activity";
import { parseNavigatorQuery, type NavigatorDraft, type Source } from "@/lib/s5/model";
type Result = { sources: Source[]; mode: string; reason: string };
export function NavigatorPanel({ lang }: { lang: "th" | "en" }) {
  const th = lang === "th", say = (a: string, b: string) => th ? a : b, lock = useRef(false);
  const [query, setQuery] = useState(""), [draft, setDraft] = useState<NavigatorDraft | null>(null), [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  useEffect(() => {
    const stale = () => setResult(old => old?.sources.length ? { ...old, sources: [], reason: "sources_changed" } : old);
    window.addEventListener("goos:revalidate", stale); return () => window.removeEventListener("goos:revalidate", stale);
  }, []);
  useEffect(() => {
    if (!result?.sources.length) return;
    const expires = Math.min(...result.sources.map(s => Date.parse(s.expires_at)));
    const timer = setTimeout(() => setResult(old => old === result ? { ...old, sources: [], reason: "sources_changed" } : old), Math.min(2147483647, Math.max(0, expires - Date.now() + 50)));
    return () => clearTimeout(timer);
  }, [result]);
  async function submit(form: HTMLFormElement) {
    if (lock.current || !draft) return; lock.current = true; setBusy(true); setError(false); setResult(null);
    const f = new FormData(form), filters = Object.fromEntries(["category", "country", "language", "remote", "free"].flatMap(k => f.get(k) ? [[k, f.get(k)]] : []));
    try {
      const r = await busyFetch("/api/navigator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, filters, locale: lang, confirmed: f.get("confirmed") === "on" }) });
      const j = await r.json(); if (!r.ok) { setError(true); return; } setResult(j.data);
    } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  }
  const notices: Record<string, string> = {
    sources_changed: say("แหล่งข้อมูลมีการเปลี่ยนหรือหมดอายุ กรุณาตรวจตัวกรองและค้นหาใหม่ คำค้นที่ยังแก้ไขอยู่คงเดิม", "Sources changed or expired. Review the filters and search again. Your query draft is preserved."),
    remove_personal_details: say("กรุณาลบชื่อ ข้อมูลติดต่อ หรือข้อมูลส่วนตัวออก แล้วค้นหาใหม่", "Remove personal and contact details, then try again."),
    public_information: say("ค้นข้อมูลทั่วไปและติดต่อผู้ให้บริการที่ตรวจสอบแล้วได้ โดยไม่สร้างโปรไฟล์เด็กหรือแผนเฉพาะบุคคล", "Use general information and verified provider contacts. No child profile or personalized plan is created."),
    urgent_information: say("หากกำลังมีอันตราย ให้ติดต่อบริการฉุกเฉินในพื้นที่หรือคนที่คุณไว้ใจ ระบบนี้ไม่ได้ส่งเจ้าหน้าที่ไปรับเรื่อง และไม่ใช่ช่องทางฉุกเฉิน", "If you are in immediate danger, contact local emergency services or someone you trust. This service has not dispatched help and is not an emergency channel."),
    clarify: say("ระบุประเภทโอกาส เช่น งาน หลักสูตร บริการ หรือชุมชน หรือใช้ค้นหาปกติ", "Choose an opportunity type such as jobs, courses, services or community, or use normal search."),
    no_current_sources: say("ยังไม่มีแหล่งข้อมูลปัจจุบันที่ตรงเงื่อนไข ลองปรับตัวกรองหรือค้นหาปกติ", "No current sources match. Adjust the filters or use normal search."),
  };
  return <main id="main" className="account-page s2-page" data-live-busy={busy}><h1>{say("Navigator — สำรวจโอกาสของคุณ", "Navigator — explore your opportunities")}</h1>
    <p>{say("โหมดแนะนำจากแหล่งข้อมูล: ใช้กฎอ่านคำค้นและข้อมูลรายการที่ตรวจแล้ว ยังไม่ได้ใช้โมเดล AI ภายนอก ไม่ตัดสินสิทธิ์หรือสมัครแทนคุณ", "Source guidance mode: rule-based query interpretation and reviewed listings. No external AI model is used. It does not decide eligibility or apply on your behalf.")}</p>
    <p className="notice">{say("ไม่ต้องกรอกชื่อ เบอร์โทร เลขบัตร หรือประวัติส่วนตัว คำค้นไม่ถูกบันทึกเป็นประวัติสนทนา", "Do not enter names, phone numbers, ID numbers or personal history. Queries are not stored as conversation history.")}</p>
    <Link href={`/${lang}/opportunities`}>{say("ค้นหาปกติโดยไม่ใช้ Navigator", "Normal search without Navigator")}</Link>
    {error && <p role="alert">{say("ยังค้นหาไม่ได้ ตรวจการเข้าสู่ระบบหรือรอสักครู่ แล้วใช้ค้นหาปกติได้เสมอ", "Search is unavailable. Check your sign-in or retry later. Normal search remains available.")}</p>}
    <BusyForm className="panel form-grid" onSubmit={e => { e.preventDefault(); setDraft(parseNavigatorQuery(query)); setResult(null); }}><fieldset disabled={busy}><label>{say("คุณกำลังหาโอกาสแบบใด", "What kind of opportunity are you looking for?")}<textarea name="query" rows={3} minLength={1} maxLength={600} required value={query} autoComplete="off" onChange={e => { setQuery(e.target.value); setDraft(null); setResult(null); }} /></label><button type="submit">{say("เตรียมตัวกรองให้ตรวจ", "Prepare filters for review")}</button></fieldset></BusyForm>
    {draft && <BusyForm key={JSON.stringify(draft.filters)} className="panel form-grid" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}><h2>{say("ตรวจและแก้ตัวกรองก่อนค้นหา", "Review and edit filters before searching")}</h2><fieldset disabled={busy}>
      <label>{say("ประเภทโอกาส", "Opportunity type")}<select name="category" defaultValue={draft.filters.category ?? ""}><option value="">{say("ทุกประเภท", "All types")}</option>{[["jobs", say("งาน", "Jobs")], ["skills", say("เรียนรู้และทักษะ", "Learning and skills")], ["access", say("บริการช่วยเหลือ", "Support services")], ["community", say("ชุมชน", "Community")]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <label>{say("รหัสประเทศ (ไม่กรอก = ทุกประเทศ)", "Country code (blank = worldwide)")}<input name="country" pattern="[A-Z]{2}" maxLength={2} defaultValue={draft.filters.country ?? ""} /></label>
      <label>{say("ภาษาของบริการ", "Service language")}<select name="language"><option value="">{say("ทุกภาษา", "All languages")}</option><option value="th">ไทย</option><option value="en">English</option></select></label>
      <label className="check"><input name="remote" type="checkbox" value="true" defaultChecked={draft.filters.remote === "true"} />{say("เข้าร่วมออนไลน์", "Remote participation")}</label>
      <label className="check"><input name="free" type="checkbox" value="true" defaultChecked={draft.filters.free === "true"} />{say("ไม่มีค่าใช้จ่าย", "Free of charge")}</label>
      <label className="check"><input name="confirmed" type="checkbox" required />{say("ยินยอมใช้ Navigator ในการค้นหาครั้งนี้และตรวจตัวกรองแล้ว ไม่มีการแชร์โปรไฟล์หรือส่งใบสมัคร", "I opt in to this Navigator search and have reviewed the filters. No profile is shared and no application is submitted.")}</label>
      <button type="submit">{say("ค้นหาพร้อมแหล่งอ้างอิง", "Find sources")}</button>
    </fieldset></BusyForm>}
    {result && <section className="panel" aria-live="polite"><h2>{say("แนวทางจากข้อมูลที่ตรวจแล้ว", "Guidance from reviewed sources")}</h2>
      {(notices[result.reason] || !result.sources.length) && <p>{notices[result.reason] ?? notices.no_current_sources}</p>}
      {result.sources.map((s, i) => <article className="catalog-card" key={s.id}><h3>{i + 1}. {s.title}</h3><blockquote>{s.quote}</blockquote><p>{say("คำอธิบายจากผู้ให้บริการ ไม่ใช่การรับรองสิทธิ์หรือผลลัพธ์", "Provider description, not an eligibility or outcome guarantee")}</p><p>{say("ตรวจเมื่อ", "Reviewed")}: {new Date(s.reviewed_at).toLocaleDateString(lang)} · {say("ใช้ได้ถึง", "Valid until")}: {new Date(s.expires_at).toLocaleDateString(lang)}</p><div className="button-row"><Link href={`/${lang}/directory/${s.listing_id}`}>{say("ตรวจรายละเอียดและติดต่อผู้ให้บริการ", "Review details and contact the provider")}</Link><a href={s.url} target="_blank" rel="noopener noreferrer">{say("แหล่งต้นฉบับ (เปิดหน้าต่างใหม่)", "Original source (opens a new window)")}</a></div><details><summary>{say("ข้อมูลอ้างอิง", "Source provenance")}</summary><code className="source-hash">{s.hash}</code></details></article>)}
      <Link href={`/${lang}/workspace/assessment`}>{say("ประเมินความต้องการด้วยตัวเอง", "Self-directed needs assessment")}</Link>
    </section>}
  </main>;
}
