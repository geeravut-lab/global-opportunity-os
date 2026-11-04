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
    return a.apply(r.error ? dbProblem(r.error) : success(r.data));
  } catch {
    return a.apply(problem(503, "SERVICE_UNAVAILABLE"));
  }
}
