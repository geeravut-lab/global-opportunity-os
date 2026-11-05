import { s4Enabled, kinds } from "@/lib/s4/model";
import { s3Enabled } from "@/lib/s3/model";
import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { success, problem, dbProblem } from "@/lib/auth/http";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const a = requestClient(req);
  if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  try {
    const u = await a.client.auth.getUser();
    if (u.error || !u.data.user?.email_confirmed_at)
      return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    const r = await a.client.rpc("goos_live_fingerprint");
    if (r.error) return a.apply(dbProblem(r.error));
    const s4kind = req.nextUrl.searchParams.get("s4_kind"),
      s4id = req.nextUrl.searchParams.get("s4_id");
    if (s4kind || s4id) {
      if (
        !kinds.includes(s4kind as (typeof kinds)[number]) ||
        !s4id ||
        !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s4id)
      )
        return a.apply(problem(422, "INVALID_INPUT"));
      if (!s4Enabled())
        return a.apply(success({ ...r.data, resource_allowed: false }));
      const access = await a.client.rpc("goos_s4_access", {
        p_kind: s4kind,
        p_id: s4id,
      });
      if (access.error?.code === "42501")
        return a.apply(success({ ...r.data, resource_allowed: false }));
      if (access.error) return a.apply(dbProblem(access.error));
      return a.apply(success({ ...r.data, resource_allowed: access.data }));
    }
    const application = req.nextUrl.searchParams.get("application");
    if (application && s3Enabled()) {
      if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(application))
        return a.apply(problem(422, "INVALID_INPUT"));
      const access = await a.client.rpc("goos_s3_access", {
        p_id: application,
      });
      if (access.error) return a.apply(dbProblem(access.error));
      return a.apply(success({ ...r.data, resource_allowed: access.data }));
    }
    return a.apply(success(r.data));
  } catch {
    return a.apply(problem(503, "SERVICE_UNAVAILABLE"));
  }
}
