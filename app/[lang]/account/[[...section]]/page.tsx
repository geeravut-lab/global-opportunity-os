import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { serverClient } from "@/lib/supabase/server";
import { loadAccount } from "@/lib/auth/account";
import { accountSections, authText } from "@/lib/auth/copy";
import { AccountPanel } from "@/components/account-panel";
import {s2Enabled} from "@/lib/s2/model";
export const dynamic = "force-dynamic";
export default async function AccountPage({
  params,
}: {
  params: Promise<{ lang: string; section?: string[] }>;
}) {
  const { lang, section: parts } = await params;
  if (!isLocale(lang) || (parts && parts.length > 1)) notFound();
  const section = parts?.[0] ?? "home";
  if (!accountSections.some((s) => s === section)) notFound();
  const client = await serverClient(),
    t = authText[lang];
  if (!client)
    return (
      <main id="main" className="account-page">
        <section className="panel">
          <h1>{t.account}</h1>
          <p>{t.unavailable}</p>
          <Link href={`/${lang}/opportunities`}>{t.search}</Link>
        </section>
      </main>
    );
  const user = await client.auth.getUser();
  if (user.error || !user.data.user?.email_confirmed_at)
    redirect(`/${lang}/auth/login`);
  const result = await loadAccount(client, lang);
  if (result.error || !result.data)
    return (
      <main id="main" className="account-page">
        <section className="panel">
          <h1>{t.account}</h1>
          <p>{t.sessionExpired}</p>
          <Link href={`/${lang}/auth/login`}>{t.backLogin}</Link>
        </section>
      </main>
    );
  return (
    <AccountPanel
      key={JSON.stringify({
        section,
        profile: result.data.profile?.version,
        ctx: result.data.context,
        delegations: result.data.delegations,
        invitations: result.data.invitations,
        notifications: result.data.notifications,
      })}
      lang={lang}
      section={section as (typeof accountSections)[number]}
      initial={result.data}
      s2={s2Enabled()}
    />
  );
}
