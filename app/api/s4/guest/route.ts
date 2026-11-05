import { NextRequest } from "next/server";
import { publicClient } from "@/lib/platform/server";
import { authConfig } from "@/lib/auth/config";
import {
  success,
  problem,
  readBody,
  inputProblem,
  dbProblem,
  rateLimited,
} from "@/lib/auth/http";
import { object, text, uuid, InputError } from "@/lib/auth/input";
import { choice } from "@/lib/s3/input";
import { s4Enabled } from "@/lib/s4/model";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (!s4Enabled()) return problem(503, "S4_NOT_ENABLED");
  const config = authConfig(),
    c = publicClient();
  if (!config || !c) return problem(503, "SERVICE_UNAVAILABLE");
  try {
    if (rateLimited("s4.guest", req.headers.get("x-real-ip") ?? "unknown"))
      return problem(429, "RATE_LIMITED");
    const raw = await readBody(req, config.origin),
      d = object(raw, ["operation", "kind", "body", "id", "receipt"]);
    let fn: string, args: Record<string, unknown>;
    if (d.operation === "status") {
      const receipt = text(d.receipt, 64, 64);
      if (!/^[a-f0-9]{64}$/.test(receipt))
        throw new InputError("invalid_input");
      fn = "goos_s4_guest_status";
      args = { p_id: uuid(d.id), p_receipt: receipt };
    } else if (d.operation === "create") {
      const receipt = d.receipt === null ? null : text(d.receipt, 64, 64);
      if (receipt !== null && !/^[a-f0-9]{64}$/.test(receipt))
        throw new InputError("invalid_input");
      fn = "goos_s4_guest_report";
      args = {
        p_kind: choice(d.kind, ["service", "safety"]),
        p_body: text(d.body, 1, 2000),
        p_appeal: d.id === null ? null : uuid(d.id),
        p_receipt: receipt,
      };
    } else throw new InputError("invalid_input");
    const r = await c.rpc(fn, args);
    return r.error ? dbProblem(r.error) : success(r.data);
  } catch (e) {
    return inputProblem(e);
  }
}
