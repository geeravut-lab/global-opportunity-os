import { notFound, redirect } from "next/navigation";
import Link from "@/components/busy-link";
import { serverClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { s3Enabled } from "@/lib/s3/model";
import type { S3Org } from "@/lib/s3/model";
import type { S3PageData, S3Section } from "@/lib/s3/page-data";
import { s3Copy } from "@/lib/s3/copy";
import { S3Panel } from "@/components/s3-panel";
export const dynamic = "force-dynamic";
export default async function Workflow({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, path = [] } = await params;
  if (!isLocale(lang) || !s3Enabled() || path.length > 2) notFound();
  const section = (path[0] ?? "home") as S3Section;
  if (
    ![
      "home",
      "apply",
      "application",
      "applications",
      "queue",
      "team",
      "settings",
      "automation",
      "delivery",
    ].includes(section)
  )
    notFound();
  if (
    ["apply", "application"].includes(section)
      ? path.length !== 2
      : path.length > 1
  )
    notFound();
  const id = path[1];
  if (id && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))
    notFound();
  const query = await searchParams,
    page = Number(query.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 100) notFound();
  const c = await serverClient();
  if (!c) redirect("/" + lang + "/auth/login");
  const u = await c.auth.getUser();
  if (u.error || !u.data.user) redirect("/" + lang + "/auth/login");
  const results = await Promise.all([
    c.rpc("goos_context"),
    c.rpc("goos_s3_orgs"),
    ["apply", "settings"].includes(section)
      ? c.rpc("goos_s3_subjects")
      : Promise.resolve({ data: [], error: null }),
    c.rpc("goos_s3_notices", { p_locale: lang, p_purpose: "application" }),
    c.rpc("goos_s3_notices", {
      p_locale: lang,
      p_purpose: "application_delegation",
    }),
    section === "settings"
      ? c.rpc("goos_delegations")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const t = s3Copy[lang];
  const errorPage = () => (
    <main id="main" className="account-page">
      <h1>{t[section === "application" ? "applications" : section]}</h1>
      <p role="alert">{t.error}</p>
      <Link href={"/" + lang + "/account"}>{t.reload}</Link>
    </main>
  );
  if (
    results.some((r) => r.error) ||
    !results[3].data?.[0] ||
    !results[4].data?.[0]
  ) {
    const codes = new Set(["57014", "42501", "28000", "P0002", "PGRST202"]);
    console.error(
      "S3_PAGE_UNAVAILABLE",
      results.flatMap((r, index) =>
        r.error
          ? [
              {
                index,
                code: codes.has(r.error.code) ? r.error.code : "TRANSPORT",
              },
            ]
          : [],
      ),
    );
    return errorPage();
  }
  const orgs = results[1].data as S3Org[];
  let org = typeof query.org === "string" ? query.org : null;
  if (org && !orgs.some((o) => o.id === org)) notFound();
  if (!org && ["queue", "team", "automation"].includes(section))
    org = orgs[0]?.id ?? null;
  const selected = orgs.find((o) => o.id === org);
  const data: S3PageData = {
    context: results[0].data,
    orgs,
    subjects: results[2].data ?? [],
    notice: results[3].data[0],
    delegationNotice: results[4].data[0],
    delegations: results[5].data ?? [],
    rows: [],
    detail: null,
    team: [],
    preferences: { in_app: true, email: false, timezone: "UTC", version: 0 },
    inbox: [],
    rules: [],
    jobs: [],
    listing: null,
    availability: null,
    org,
    page,
  };
  if (section === "apply") {
    const [listing, availability] = await Promise.all([
      c.rpc("goos_s2_catalog", { p_filter: {}, p_id: id }),
      c.rpc("goos_s3_availability", { p_id: id }),
    ]);
    if (listing.error || availability.error || !listing.data?.items?.[0])
      notFound();
    data.listing = listing.data.items[0];
    data.availability = availability.data;
  } else if (section === "application") {
    const result = await c.rpc("goos_s3_detail", { p_id: id });
    if (result.error?.code === "P0002" || result.error?.code === "42501")
      notFound();
    if (result.error) return errorPage();
    data.detail = result.data;
    if (data.detail?.state === "needs_information" && data.detail.can_submit) {
      const subjects = await c.rpc("goos_s3_subjects");
      if (subjects.error) return errorPage();
      data.subjects = subjects.data ?? [];
    }
  } else if (section === "applications" || (section === "queue" && org)) {
    const result = await c.rpc("goos_s3_list", {
      p_org: section === "queue" ? org : null,
      p_page: page,
    });
    if (result.error) return errorPage();
    data.rows = result.data;
  }
  if (org && selected?.can_route && ["queue", "team"].includes(section)) {
    const team = await c.rpc("goos_s3_team", { p_org: org });
    if (team.error) return errorPage();
    data.team = team.data;
  }
  if (section === "settings") {
    const [prefs, inbox] = await Promise.all([
      c.rpc("goos_s3_preferences"),
      c.rpc("goos_s3_inbox"),
    ]);
    if (prefs.error || inbox.error) return errorPage();
    data.preferences = prefs.data;
    data.inbox = inbox.data;
  }
  if (org && section === "automation") {
    const rules = await c.rpc("goos_s3_rules", { p_org: org });
    if (rules.error) return errorPage();
    data.rules = rules.data;
  }
  if (section === "delivery") {
    const jobs = await c.rpc("goos_s3_delivery_status", { p_org: org });
    if (jobs.error?.code === "P0002") notFound();
    if (jobs.error) return errorPage();
    data.jobs = jobs.data;
  }
  return (
    <S3Panel
      key={lang + section + (id ?? "") + (org ?? "")}
      lang={lang}
      section={section}
      initial={data}
    />
  );
}
