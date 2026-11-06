"use client";
import { useEffect, useRef, useState } from "react";
import { BusyForm } from "./busy-form";
import { DownloadLink } from "./download-link";
import { busyFetch } from "@/lib/ui/activity";
type Scope = { organization_id: string | null; name: string; expires_at: string };
type Report = { state: string; month: string; scope: string; minimum_group: number; suppressed: boolean; people_total: number | null; counts: Record<string, number | null>; metric_version: number };
export function ImpactPanel({ lang, scopes }: { lang: "th" | "en"; scopes: Scope[] }) {
  const say = (a: string, b: string) => lang === "th" ? a : b, lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false), [report, setReport] = useState<Report | null>(null);
  const reportRef = useRef<Report | null>(null);
  useEffect(() => { reportRef.current = report; }, [report]);
  useEffect(() => {
    let running = false, cancelled = false;
    async function recheck() {
      const current = reportRef.current; if (!current || current.state !== "available" || running || lock.current || document.hidden) return;
      running = true;
      try {
        const r = await fetch("/api/impact", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ organization: current.scope === "platform" ? null : current.scope, month: current.month }) });
        const j = await r.json(); if (cancelled || reportRef.current !== current) return;
        if (!r.ok) { setReport(null); setError(true); } else setReport(j.data);
      } catch { if (!cancelled) { setReport(null); setError(true); } } finally { running = false; }
    }
    const wake = () => { void recheck(); }, timer = setInterval(wake, 30000);
    window.addEventListener("goos:revalidate", wake); window.addEventListener("focus", wake);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("goos:revalidate", wake); window.removeEventListener("focus", wake); };
  }, []);
  const last = new Date(); last.setUTCDate(1); last.setUTCMonth(last.getUTCMonth() - 1);
  const labels: Record<string, string> = { service_delivered: say("ได้รับบริการ", "Service delivered"), job_started: say("เริ่มงาน", "Job started"), skills_completed: say("จบการเรียนรู้", "Learning completed") };
  const count = (n: number | null) => n === null ? say("ซ่อนเพื่อคุ้มครองข้อมูล", "Suppressed for privacy") : n.toLocaleString(lang);
  return <main id="main" className="account-page s2-page" data-live-busy={busy}><h1>{say("รายงานผลลัพธ์รวม", "Aggregate outcomes")}</h1>
    <p>{say("นับคนไม่ซ้ำจากผลลัพธ์ L2 ที่ยังผ่านการตรวจอิสระในเดือน UTC ที่ปิดแล้ว ไม่ใช่หลักฐานว่าแพลตฟอร์มทำให้เกิดผลลัพธ์นั้นโดยตรง", "Distinct people with currently independently verified L2 outcomes in a closed UTC month. These counts do not establish causal impact.")}</p>
    <p className="notice">{say("ซ่อนกลุ่มเล็กและตัวเลขประกอบที่อาจใช้ระบุตัวบุคคล ไม่มีการเปิดรายชื่อหรือเจาะข้อมูลรายคน ยอดแต่ละประเภทบวกเป็นจำนวนคนรวมไม่ได้", "Small groups and revealing complementary counts are suppressed. No personal drilldown is provided. Category counts cannot be added to obtain a distinct total.")}</p>
    {!scopes.length && <p>{say("ยังไม่มีสิทธิ์รายงานที่ใช้งานได้ กรุณาติดต่อผู้ดูแล ไม่แสดงรายงานข้ามองค์กร", "No active report grant. Contact your administrator. Reports are isolated by organization.")}</p>}
    {error && <p role="alert">{say("รายงานไม่พร้อมหรือสิทธิ์เปลี่ยน กรุณาลองใหม่", "Report unavailable or permission changed. Please retry.")}</p>}
    {!!scopes.length && <BusyForm className="panel form-grid" onSubmit={async e => {
      e.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(false); setReport(null);
      const f = new FormData(e.currentTarget);
      try { const r = await busyFetch("/api/impact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization: f.get("organization") || null, month: f.get("month") + "-01" }) }); const j = await r.json(); if (!r.ok) setError(true); else setReport(j.data); } catch { setError(true); } finally { lock.current = false; setBusy(false); }
    }}><fieldset disabled={busy}><label>{say("ขอบเขตที่ได้รับสิทธิ์", "Authorized scope")}<select name="organization">{scopes.map(s => <option key={s.organization_id ?? "platform"} value={s.organization_id ?? ""}>{s.name}</option>)}</select></label><label>{say("เดือนที่ปิดแล้ว", "Closed month")}<input name="month" type="month" max={last.toISOString().slice(0, 7)} defaultValue={last.toISOString().slice(0, 7)} required /></label><button type="submit">{say("ดูรายงานรวม", "View aggregate report")}</button></fieldset></BusyForm>}
    {report && <section className="panel" aria-live="polite"><h2>{say("ผลรายงาน", "Report result")} · {report.month}</h2>{report.state !== "available" ? <p>{say("แหล่งข้อมูลเปลี่ยน รายงานเดิมถูกระงับและจะไม่ออกรุ่นตัวเลขเล็กที่ใช้เทียบหาบุคคลได้ กรุณาติดต่อทีมรายงาน", "Sources changed. This snapshot is withdrawn and is not reissued as a revealing small delta. Contact the reporting team.")}</p> : <><p>{say("เกณฑ์กลุ่มขั้นต่ำ", "Minimum group size")}: {report.minimum_group} · {say("รุ่นตัวชี้วัด", "Metric version")}: {report.metric_version}</p><p>{say("จำนวนคนไม่ซ้ำรวม", "Total distinct people")}: {count(report.people_total)}</p><table><caption>{say("คนไม่ซ้ำในแต่ละประเภทผลลัพธ์", "Distinct people by outcome type")}</caption><thead><tr><th scope="col">{say("ประเภท", "Type")}</th><th scope="col">{say("จำนวนคน", "People")}</th></tr></thead><tbody>{Object.entries(report.counts).map(([k, n]) => <tr key={k}><th scope="row">{labels[k] ?? k}</th><td>{count(n)}</td></tr>)}</tbody></table><DownloadLink href={`/api/impact/export?month=${encodeURIComponent(report.month)}&organization=${report.scope === "platform" ? "" : encodeURIComponent(report.scope)}`} lang={lang}>{say("ดาวน์โหลดรายงานที่คุ้มครองข้อมูล (JSON)", "Download protected report (JSON)")}</DownloadLink></>}</section>}
  </main>;
}
