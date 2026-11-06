import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { success, problem, dbProblem, readBody, inputProblem, rateLimited } from "@/lib/auth/http";
import { policyMutation } from "@/lib/policy/model";
export const dynamic = "force-dynamic";
async function handle(req: NextRequest) {
  const a = requestClient(req); if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  try {
    const u = await a.client.auth.getUser();
    if (u.error || !u.data.user?.email_confirmed_at) return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    const operation = req.method === "GET" ? { fn: "goos_policy_read", args: {} } : policyMutation(await readBody(req, a.config.origin, 65536));
    if (operation.fn === "goos_policy_lookup" && rateLimited("policy-lookup", u.data.user.id)) return a.apply(problem(429, "TRY_LATER"));
    const r = await a.client.rpc(operation.fn, operation.args);
    return a.apply(r.error ? dbProblem(r.error) : success(r.data));
  } catch (e) { return a.apply(inputProblem(e)); }
}
export const GET = handle;
export const POST = handle;
