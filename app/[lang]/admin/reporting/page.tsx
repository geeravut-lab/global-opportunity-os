import { notFound, redirect } from "next/navigation";
import Link from "@/components/busy-link";
import { isLocale } from "@/lib/i18n";
import { s5Enabled } from "@/lib/s5/model";
import { serverClient } from "@/lib/supabase/server";
import { ImpactAdminPanel } from "@/components/impact-admin-panel";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang) || !s5Enabled()) notFound();
  const c = await serverClient(); if (!c || (await c.auth.getUser()).error) redirect(`/${lang}/auth/login`);
  const context = await c.rpc("goos_context"); if (!context.data?.has_platform_role) notFound();
  if (!context.data.staff_assured) return <main id="main" className="account-page"><h1>{lang === "th" ? "สิทธิ์รายงาน" : "Report permissions"}</h1><Link href={`/${lang}/account/security`}>{lang === "th" ? "ยืนยัน MFA" : "Verify MFA"}</Link></main>;
  const r = await c.rpc("goos_impact_admin"); if (r.error) return <main id="main" className="account-page"><h1>{lang === "th" ? "สิทธิ์รายงาน" : "Report permissions"}</h1><p role="alert">{lang === "th" ? "ยังโหลดสิทธิ์ไม่ได้ กรุณาลองใหม่" : "Unable to load permissions. Please retry."}</p></main>;
  return <ImpactAdminPanel lang={lang} initial={r.data} />;
}
