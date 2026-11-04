import { PwaRegister } from "@/components/pwa-register";
import { AppShell } from "@/components/app-shell";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { copy, isLocale } from "@/lib/i18n";
import { publicSettings } from "@/lib/platform/server";
import { imageUrl } from "@/lib/platform/settings";
import { s2Enabled } from "@/lib/s2/model";
import { serverClient } from "@/lib/supabase/server";
import "../globals.css";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const s = await publicSettings(),
    name = lang === "en" ? s.name_en : s.name_th;
  return {
    title: { default: `${name} · Demo`, template: `%s · ${name}` },
    applicationName: name,
    description:
      "ไดเรกทอรีตัวอย่างไทย–อังกฤษ ใช้ข้อมูลสมมติเท่านั้น · Fictional bilingual directory demo",
    robots: { index: false, follow: false },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: { url: imageUrl(s, "favicon"), type: "image/png" },
      apple: { url: imageUrl(s, "favicon"), type: "image/png" },
    },
  };
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang],
    branding = await publicSettings(),
    jar = await cookies();
  const hasSessionCookie = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const context =
    s2Enabled() && hasSessionCookie
      ? await (await serverClient())?.rpc("goos_context")
      : null;
  return (
    <html lang={lang}>
      <body>
        <a className="skip-link" href="#main">
          {t.skip}
        </a>
        <PwaRegister />
        <AppShell
          lang={lang}
          branding={branding}
          hasSessionCookie={hasSessionCookie}
          s2={s2Enabled()}
          canReview={!!context?.data?.has_platform_role}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
