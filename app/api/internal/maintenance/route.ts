import { NextRequest, NextResponse } from "next/server";
import {
  authorized,
  maintain,
  failureReason,
} from "@/lib/maintenance/worker.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !authorized(
      request.headers.get("authorization"),
      process.env.MAINTENANCE_SECRET,
    )
  )
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404, headers });
  if (process.env.S2_ENABLED !== "true" || process.env.S3_ENABLED !== "true")
    return NextResponse.json(
      { code: "WORKER_DISABLED" },
      { status: 503, headers },
    );
  try {
    return NextResponse.json({ data: await maintain() }, { headers });
  } catch (error) {
    return NextResponse.json(
      { code: "MAINTENANCE_UNAVAILABLE", reason: failureReason(error) },
      { status: 503, headers },
    );
  }
}
