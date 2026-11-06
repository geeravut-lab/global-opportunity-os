import { notFound, redirect } from "next/navigation";
import Link from "@/components/busy-link";
import { isLocale } from "@/lib/i18n";
import { serverClient } from "@/lib/supabase/server";
import { PurgePanel } from "@/components/purge-panel";
export const dynamic = "force-dynamic";
export default async function Purge({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound(); const c = await serverClient(); if (!c) redirect(`/${lang}/auth/login`);
  const u = await c.auth.getUser(); if (u.error || !u.data.user) redirect(`/${lang}/auth/login`);
  const context = await c.rpc("goos_context"); if (!context.data?.has_platform_role) notFound();
  if (!context.data.staff_assured) return <main id="main" className="account-page"><h1>{lang === "th" ? "คำขอลบข้อมูล" : "Deletion requests"}</h1><Link href={`/${lang}/account/security`}>{lang === "th" ? "ยืนยัน MFA ก่อนจัดการ" : "Verify MFA to continue"}</Link></main>;
  const r = await c.rpc("goos_purge_list"); if (r.error) return <main id="main" className="account-page"><h1>{lang === "th" ? "คำขอลบข้อมูล" : "Deletion requests"}</h1><p role="alert">{lang === "th" ? "โหลดไม่สำเร็จ กรุณาลองใหม่" : "Unable to load. Please retry."}</p></main>;
  return <PurgePanel lang={lang} initial={{ ...r.data, authentication_configured: !!process.env.SUPABASE_PURGE_AUTH_KEY, runtime_worker_enabled: process.env.S4_PURGE_ENABLED === "true" }} />;
}
