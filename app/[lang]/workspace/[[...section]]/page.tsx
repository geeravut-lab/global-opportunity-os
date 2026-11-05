import Link from "@/components/busy-link";
import { notFound, redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { loadAccount } from "@/lib/auth/account";
import { s2Enabled, type S2Org } from "@/lib/s2/model";
import { s2Sections, s2Text, type S2Section } from "@/lib/s2/copy";
import { S2Panel } from "@/components/s2-panel";
export const dynamic = "force-dynamic";
export default async function Workspace({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, section: parts } = await params;
  if (!isLocale(lang) || (parts && parts.length > 1)) notFound();
  const section = (parts?.[0] ?? "home") as S2Section;
  const page = Number((await searchParams).page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 100) notFound();
  if (!s2Sections.includes(section)) notFound();
  const t = s2Text[lang];
  if (!s2Enabled())
    return (
      <main id="main" className="account-page">
        <h1>{t[section]}</h1>
        <p>
          {lang === "th"
            ? "ส่วนนี้ยังไม่เปิดใช้งาน"
            : "This feature is not enabled yet."}
        </p>
        <Link href={`/${lang}/opportunities`}>{t.search}</Link>
      </main>
    );
  const c = await serverClient();
  if (!c) redirect(`/${lang}/auth/login`);
  const user = await c.auth.getUser();
  if (user.error || !user.data.user) redirect(`/${lang}/auth/login`);
  const loaded = await loadAccount(c, lang);
  if (loaded.error || !loaded.data) redirect(`/${lang}/auth/login`);
  const account = loaded.data;
  if (section === "review" && !account.context.has_platform_role) notFound();
  const [
    orgs,
    listings,
    assessment,
    bookmarks,
    matches,
    notices,
    consentEvents,
  ] = await Promise.all([
    c.rpc("goos_s2_orgs", {
      p_review: section === "review" && account.context.staff_assured,
      p_page: page,
    }),
    (section === "catalog" || section === "review") &&
    account.context.staff_assured
      ? c.rpc("goos_s2_listings", {
          p_review: section === "review",
          p_org: null,
          p_page: page,
        })
      : Promise.resolve({ data: [], error: null }),
    c.rpc("goos_s2_assessment"),
    c.rpc("goos_s2_bookmarks"),
    section === "matches"
      ? c.rpc("goos_s2_matches")
      : Promise.resolve({ data: [], error: null }),
    c.rpc("goos_s2_notices", { p_locale: lang }),
    section === "assessment"
      ? c.rpc("goos_s2_assessment_events")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const failure = [
    orgs,
    listings,
    assessment,
    bookmarks,
    notices,
    consentEvents,
  ].some((x) => x.error);
  if (failure || !notices.data?.[0])
    return (
      <main id="main" className="account-page">
        <h1>{t[section]}</h1>
        <p role="alert">{t.error}</p>
      </main>
    );
  const batch =
    (section === "organizations" || section === "review") &&
    account.context.staff_assured
      ? await c.rpc("goos_s2_evidence_batch", {
          p_orgs: ((orgs.data ?? []) as S2Org[]).map((o) => o.id),
        })
      : { data: {}, error: null };
  if (batch.error)
    return (
      <main id="main" className="account-page">
        <h1>{t[section]}</h1>
        <p role="alert">{t.error}</p>
      </main>
    );
  const initialEvidence = batch.data ?? {};
  return (
    <S2Panel
      key={lang + section}
      lang={lang}
      section={section}
      account={account}
      orgs={orgs.data ?? []}
      listings={listings.data ?? []}
      assessment={assessment.data}
      bookmarks={bookmarks.data ?? []}
      matches={matches.data ?? []}
      needsConfirmed={!!matches.error}
      initialEvidence={initialEvidence}
      assessmentNotice={notices.data[0]}
      consentEvents={consentEvents.data ?? []}
      page={page}
    />
  );
}
