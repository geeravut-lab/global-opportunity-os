import { NextRequest, NextResponse } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { noStore, problem, success, readBody, dbProblem, inputProblem, rateLimited } from "@/lib/auth/http";
import { object, uuid, InputError } from "@/lib/auth/input";
import { s5Enabled } from "@/lib/s5/model";
export const dynamic = "force-dynamic";
function args(v: unknown) {
  const d = object(v, ["organization", "month"]);
  if (typeof d.month !== "string" || !/^\d{4}-\d{2}-01$/.test(d.month)) throw new InputError("invalid_input");
  return { p_org: d.organization === null ? null : uuid(d.organization), p_month: d.month };
}
async function handle(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!s5Enabled()) return problem(404, "NOT_FOUND");
  const path = (await context.params).path ?? [];
  if (path.length > 1 || path.length && !["export", "admin"].includes(path[0]) || req.method === "POST" && path[0] === "export") return problem(404, "NOT_FOUND");
  const a = requestClient(req); if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  try {
    const u = await a.client.auth.getUser(); if (u.error || !u.data.user) return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    if (rateLimited("impact", u.data.user.id)) return a.apply(problem(429, "RETRY_LATER"));
    if (path[0] === "admin") {
      if (req.method === "GET") { const r = await a.client.rpc("goos_impact_admin"); return a.apply(r.error ? dbProblem(r.error) : success(r.data)); }
      const d = object(await readBody(req, a.config.origin), ["account", "organization", "expires", "grant"]);
      if (typeof d.grant !== "boolean" || typeof d.expires !== "string" || !Number.isFinite(Date.parse(d.expires))) throw new InputError("invalid_input");
      const r = await a.client.rpc("goos_impact_grant", { p_account: uuid(d.account), p_org: d.organization === null ? null : uuid(d.organization), p_expires: new Date(d.expires).toISOString(), p_grant: d.grant });
      return a.apply(r.error ? dbProblem(r.error) : success(r.data));
    }
    const report = req.method === "POST" || path[0] === "export";
    const input = report ? args(req.method === "POST" ? await readBody(req, a.config.origin) : { organization: req.nextUrl.searchParams.get("organization") || null, month: req.nextUrl.searchParams.get("month") }) : {};
    const r = await a.client.rpc(report ? "goos_impact_report" : "goos_impact_scopes", input);
    if (r.error) return a.apply(dbProblem(r.error));
    if (path[0] === "export") {
      if (r.data.state !== "available") return a.apply(problem(409, "REPORT_INVALIDATED"));
      return a.apply(noStore(new NextResponse(JSON.stringify(r.data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="opp4all-impact.json"', "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } })));
    }
    return a.apply(success(r.data));
  } catch (e) { return a.apply(inputProblem(e)); }
}
export const GET = handle, POST = handle;
