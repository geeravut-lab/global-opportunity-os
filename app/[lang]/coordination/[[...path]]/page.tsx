import { notFound, redirect } from "next/navigation";
import Link from "@/components/busy-link";
import { publicClient } from "@/lib/platform/server";
import { serverClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { s4Enabled, kinds } from "@/lib/s4/model";
import type { S4Kind } from "@/lib/s4/model";
import { s4Text } from "@/lib/s4/copy";
import { S4Panel } from "@/components/s4-panel";
export const dynamic = "force-dynamic";
export default async function Coordination({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, path = [] } = await params;
  if (!isLocale(lang) || !s4Enabled() || path.length > 2) notFound();
  const section = path[0] ?? "home";
  if (section !== "home" && !kinds.includes(section as S4Kind)) notFound();
  const id = path[1];
  if (id && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))
    notFound();
  const q = await searchParams,
    page = Number(q.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 100) notFound();
  const destinationQuery = typeof q.q === "string" ? q.q : "";
  if (destinationQuery.length > 100 || Array.isArray(q.q)) notFound();
  const c = await serverClient();
  if (!c) redirect("/" + lang + "/auth/login");
  const u = await c.auth.getUser();
  if (u.error || !u.data.user) redirect("/" + lang + "/auth/login");
  const results = await Promise.all([
    c.rpc("goos_context"),
    !id && ["home", "referrals", "outcomes", "reports"].includes(section)
      ? c.rpc("goos_s4_sources")
      : Promise.resolve({ data: [], error: null }),
    c.rpc("goos_s4_notice", { p_locale: lang }),
    c.rpc("goos_s4_staff"),
    section === "privacy"
      ? c.rpc("goos_s4_cessations")
      : Promise.resolve({ data: [], error: null }),
    !id && ["home", "referrals"].includes(section)
      ? (publicClient()?.rpc("goos_s2_catalog", {
          p_filter: { q: destinationQuery },
          p_id: null,
        }) ??
        Promise.resolve({ data: null, error: { code: "SERVICE_UNAVAILABLE" } }))
      : Promise.resolve({ data: { items: [] }, error: null }),
    c.rpc("goos_s3_orgs"),
  ]);
  const item = id
    ? await c.rpc("goos_s4_detail", { p_kind: section, p_id: id })
    : section === "home"
      ? null
      : await c.rpc("goos_s4_list", { p_kind: section, p_page: page });
  if (item?.error?.code === "P0002" || item?.error?.code === "42501")
    notFound();
  if (results.some((r) => r.error) || item?.error || !results[2].data) {
    const codes = new Set(["42501", "57014", "P0002", "28000", "PGRST202"]);
    console.error(
      "S4_PAGE_UNAVAILABLE",
      results
        .map((r, index) =>
          r.error
            ? {
                index,
                code: codes.has(r.error.code) ? r.error.code : "TRANSPORT",
              }
            : null,
        )
        .filter(Boolean),
      item?.error ? "ITEM_UNAVAILABLE" : "",
      !results[2].data ? "NOTICE_UNAVAILABLE" : "",
    );
    return (
      <main id="main" className="account-page">
        <h1>{s4Text(lang, "home")}</h1>
        <p role="alert">{s4Text(lang, "error")}</p>
        <Link href={"/" + lang + "/account"}>{s4Text(lang, "reload")}</Link>
      </main>
    );
  }
  const teams: Record<
    string,
    { id: string; account_id: string; name?: string; roles: string[] }[]
  > = {};
  for (const org of results[6].data ?? [])
    if (org.can_route) {
      const team = await c.rpc("goos_s4_team", { p_org: org.id });
      if (!team.error) teams[org.id] = team.data;
    }
  return (
    <S4Panel
      lang={lang}
      section={section as S4Kind | "home"}
      initial={{
        context: results[0].data,
        sources: results[1].data,
        notice: results[2].data,
        staff: results[3].data,
        cessations: results[4].data,
        destinations: results[5].data?.items ?? [],
        destinationQuery,
        teams,
        rows: id ? [] : (item?.data ?? []),
        detail: id ? item?.data : null,
        page,
      }}
    />
  );
}
