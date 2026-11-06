import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { problem, success, readBody, dbProblem, inputProblem, rateLimited } from "@/lib/auth/http";
import { navigatorInput, s5Enabled, type Source } from "@/lib/s5/model";
import { groundedSelection } from "@/lib/s5/gateway";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (!s5Enabled()) return problem(404, "NOT_FOUND");
  const a = requestClient(req); if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  try {
    const u = await a.client.auth.getUser(); if (u.error || !u.data.user) return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    const { draft, locale } = navigatorInput(await readBody(req, a.config.origin));
    if (rateLimited("navigator", u.data.user.id)) return a.apply(problem(429, "RETRY_LATER"));
    if (draft.mode !== "source_guidance" || draft.sensitive) return a.apply(success({ ...draft, sources: [], reason: draft.sensitive ? "remove_personal_details" : draft.mode, mode: draft.sensitive ? "clarify" : draft.mode }));
    const r = await a.client.rpc("goos_s5_sources", { p_filter: draft.filters, p_locale: locale, p_confirmed: true });
    if (r.error) return a.apply(r.error.code === "54000" ? problem(429, "BUDGET_EXHAUSTED") : dbProblem(r.error));
    // No provider is configured or called until an approved adapter and terms are selected.
    const selection = await groundedSelection(draft.filters, r.data as Source[], locale);
    const fresh = await a.client.rpc("goos_s5_resolve", { p_ids: selection.sources.map(s => s.id), p_locale: locale });
    if (fresh.error) return a.apply(dbProblem(fresh.error));
    const current = new Map((fresh.data as Source[]).map(s => [s.id, s]));
    const sources = selection.sources.flatMap(s => current.has(s.id) ? [current.get(s.id)!] : []);
    return a.apply(success({ ...draft, ...selection, sources, reason: sources.length ? selection.reason : "no_current_sources" }));
  } catch (e) { return a.apply(inputProblem(e)); }
}
