import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { success, problem, dbProblem } from "@/lib/auth/http";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const a = requestClient(req);
  if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  // Dedicated memory-only access token for private Realtime; never a refresh token or SSR session owner.
  if (
    req.headers.get("x-goos-live") !== "1" ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    return a.apply(problem(403, "ORIGIN_REJECTED"));
  try {
    const u = await a.client.auth.getUser();
    if (u.error || !u.data.user?.email_confirmed_at)
      return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    const ctx = await a.client.rpc("goos_context");
    if (ctx.error) return a.apply(dbProblem(ctx.error));
    const f = await a.client.rpc("goos_live_fingerprint");
    if (f.error) return a.apply(dbProblem(f.error));
    if (!f.data.enabled) return a.apply(success({ enabled: false }));
    const s = await a.client.auth.getSession();
    if (!s.data.session) return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    return a.apply(
      success({
        enabled: true,
        url: a.config.url,
        key: a.config.key,
        token: s.data.session.access_token,
        expiresAt: s.data.session.expires_at,
        topics: [`goos:u:${u.data.user.id}`, "goos:settings"],
      }),
    );
  } catch {
    return a.apply(problem(503, "SERVICE_UNAVAILABLE"));
  }
}
