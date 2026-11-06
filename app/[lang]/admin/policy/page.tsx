import { notFound, redirect } from "next/navigation";
import Link from "@/components/busy-link";
import { isLocale } from "@/lib/i18n";
import { serverClient } from "@/lib/supabase/server";
import { PolicyPanel } from "@/components/policy-panel";
export const dynamic = "force-dynamic";
export default async function PolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const c = await serverClient(); if (!c) redirect(`/${lang}/auth/login`);
  const u = await c.auth.getUser(); if (u.error || !u.data.user) redirect(`/${lang}/auth/login`);
  const context = await c.rpc("goos_context");
  if (!context.data?.has_platform_role) notFound();
  if (!context.data.staff_assured) return <main id="main" className="account-page"><h1>{lang === "th" ? "Policy และสิทธิ์ข้อมูล" : "Policy and data rights"}</h1><Link href={`/${lang}/account/security`}>{lang === "th" ? "ยืนยัน MFA ก่อนจัดการ" : "Verify MFA to continue"}</Link></main>;
  const r = await c.rpc("goos_policy_read");
  if (r.error) return <main id="main" className="account-page"><h1>{lang === "th" ? "Policy และสิทธิ์ข้อมูล" : "Policy and data rights"}</h1><p role="alert">{lang === "th" ? "โหลดนโยบายไม่สำเร็จ กรุณาลองใหม่" : "Unable to load policy. Please retry."}</p><Link href={`/${lang}/admin/policy`}>{lang === "th" ? "ลองใหม่" : "Retry"}</Link></main>;
  return <PolicyPanel lang={lang} initial={r.data} />;
}
