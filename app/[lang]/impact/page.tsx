import { notFound, redirect } from "next/navigation";
import Link from "@/components/busy-link";
import { isLocale } from "@/lib/i18n";
import { s5Enabled } from "@/lib/s5/model";
import { serverClient } from "@/lib/supabase/server";
import { ImpactPanel } from "@/components/impact-panel";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang) || !s5Enabled()) notFound();
  const c = await serverClient(); if (!c || (await c.auth.getUser()).error) redirect(`/${lang}/auth/login`);
  const r = await c.rpc("goos_impact_scopes");
  if (r.error) return <main id="main" className="account-page"><h1>{lang === "th" ? "รายงานผลลัพธ์รวม" : "Aggregate outcomes"}</h1><p>{lang === "th" ? "ต้องมีสิทธิ์รายงานและยืนยัน MFA ก่อนดูข้อมูล" : "An active report grant and MFA are required."}</p><Link href={`/${lang}/account/security`}>{lang === "th" ? "ยืนยัน MFA" : "Verify MFA"}</Link></main>;
  return <ImpactPanel key={JSON.stringify(r.data)} lang={lang} scopes={r.data} />;
}
