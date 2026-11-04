import { NextRequest, NextResponse } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { problem, dbProblem, noStore } from "@/lib/auth/http";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const a = requestClient(req);
  if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  try {
    const u = await a.client.auth.getUser();
    if (u.error || !u.data.user?.email_confirmed_at)
      return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    const r = await a.client.rpc("goos_export_audit");
    if (r.error) return a.apply(dbProblem(r.error));
    const columns = [
      "id",
      "actor_id",
      "action",
      "object_id",
      "organization_id",
      "occurred_at",
    ];
    const cell = (s: unknown) =>
      '"' +
      String(s ?? "")
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const csv =
      "\ufeff" +
      [
        columns.join(","),
        ...(r.data as Record<string, unknown>[]).map((row) =>
          columns.map((k) => cell(row[k])).join(","),
        ),
      ].join("\r\n");
    return a.apply(
      noStore(
        new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="opp4all-audit.csv"',
            "X-Content-Type-Options": "nosniff",
          },
        }),
      ),
    );
  } catch {
    return a.apply(problem(503, "SERVICE_UNAVAILABLE"));
  }
}
