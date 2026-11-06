import { NextRequest, NextResponse } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { publicClient } from "@/lib/platform/server";
import { authConfig } from "@/lib/auth/config";
import { object, text, uuid, InputError } from "@/lib/auth/input";
import { success, problem, dbProblem, readBody, inputProblem, noStore, rateLimited } from "@/lib/auth/http";
import { signDeletionLedger } from "@/lib/maintenance/deletion-ledger.mjs";
import { purgeMutation } from "@/lib/policy/purge-input";
export const dynamic = "force-dynamic";
async function handle(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path ?? [];
  try {
    if (path.length === 1 && path[0] === "status" && req.method === "POST") {
      const c = publicClient(), config = authConfig(); if (!c || !config) return problem(503, "AUTH_NOT_CONFIGURED");
      if (rateLimited("purge-status", req.headers.get("x-real-ip") ?? "unknown")) return problem(429, "TRY_LATER");
      const d = object(await readBody(req, config.origin, 512), ["receipt"]), receipt = text(d.receipt, 64, 64); if (!/^[a-f0-9]{64}$/.test(receipt)) throw new InputError("invalid_input");
      const r = await c.rpc("goos_purge_status", { p_receipt: receipt }); return r.error ? dbProblem(r.error) : success(r.data);
    }
    const a = requestClient(req); if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
    const u = await a.client.auth.getUser(); if (u.error || !u.data.user?.email_confirmed_at) return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    if (req.method === "GET" && path.length === 2 && path[0] === "ledger") {
      const r = await a.client.rpc("goos_purge_ledger", { p_job: uuid(path[1]) });
      if (r.error) return a.apply(dbProblem(r.error));
      return a.apply(noStore(new NextResponse(JSON.stringify(signDeletionLedger(r.data, process.env.PURGE_LEDGER_SIGNING_KEY ?? process.env.MAINTENANCE_SECRET), null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="opp4all-deletion-ledger.json"', "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } })));
    }
    if (path.length) return a.apply(problem(404, "NOT_FOUND"));
    const op = req.method === "GET" ? { fn: "goos_purge_list", args: {} } : purgeMutation(await readBody(req, a.config.origin, 2048));
    const r = await a.client.rpc(op.fn, op.args); if (r.error) return a.apply(dbProblem(r.error));
    return a.apply(success(req.method === "GET" ? { ...r.data, authentication_configured: !!process.env.SUPABASE_PURGE_AUTH_KEY, runtime_worker_enabled: process.env.S4_PURGE_ENABLED === "true" } : r.data));
  } catch (e) { return inputProblem(e); }
}
export const GET = handle;
export const POST = handle;
