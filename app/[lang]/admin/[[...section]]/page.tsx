import { AdminHomeMenus } from "@/components/home-menu-cards";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { serverClient } from "@/lib/supabase/server";
import { platformCopy, platformSections } from "@/lib/platform/copy";
import { parseSettings } from "@/lib/platform/settings";
import { PlatformPanel } from "@/components/platform-panel";
export const dynamic = "force-dynamic";
export default async function AdminPage({
  params,
}: {
  params: Promise<{ lang: string; section?: string[] }>;
}) {
  const { lang, section: parts } = await params;
  if (!isLocale(lang) || (parts && parts.length > 1)) notFound();
  const section = parts?.[0] ?? "home";
  if (section !== "home" && !platformSections.some((s) => s === section))
    notFound();
  const c = await serverClient();
  if (!c) notFound();
  const u = await c.auth.getUser();
  if (u.error || !u.data.user?.email_confirmed_at)
    redirect(`/${lang}/auth/login`);
  const ctx = await c.rpc("goos_context");
  if (ctx.error || !ctx.data?.has_platform_role) notFound();
  const t = platformCopy[lang];
  if (!ctx.data.staff_assured)
    return (
      <main id="main" className="account-page">
        <h1>{t.platform}</h1>
        <p>{t.authOnly}</p>
        <Link className="button primary" href={`/${lang}/account/security`}>
          {t.mfa}
        </Link>
      </main>
    );
  if (section === "home")
    return (
      <main id="main" className="account-page">
        <div className="welcome-card">
          <div>
            <h1>{t.platform}</h1>
            <p>{t.authOnly}</p>
          </div>
        </div>
        <AdminHomeMenus lang={lang} />
      </main>
    );
  const [settings, admins, audit] = await Promise.all([
    c.rpc("goos_public_settings"),
    section === "admins"
      ? c.rpc("goos_admins")
      : Promise.resolve({ data: [], error: null }),
    section === "audit"
      ? c.rpc("goos_audit_events")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (settings.error || admins.error || audit.error) notFound();
  return (
    <PlatformPanel
      key={section}
      lang={lang}
      section={section as (typeof platformSections)[number]}
      settings={parseSettings(settings.data)}
      admins={admins.data}
      audit={audit.data}
    />
  );
}
