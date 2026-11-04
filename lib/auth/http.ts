import { randomUUID, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { InputError } from "./input";
export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie");
  return response;
}
export function success(data: unknown, status = 200) {
  return noStore(
    NextResponse.json({ data, meta: { request_id: randomUUID() } }, { status }),
  );
}
export function problem(status: number, code: string) {
  return noStore(
    NextResponse.json(
      {
        type: "about:blank",
        title: code,
        status,
        code,
        request_id: randomUUID(),
      },
      { status, headers: { "Content-Type": "application/problem+json" } },
    ),
  );
}
export async function readBody(
  request: NextRequest,
  origin: string,
  maxBytes = 8192,
): Promise<unknown> {
  if (
    request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new InputError("origin_rejected");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new InputError("invalid_content_type");
  if (Number(request.headers.get("content-length") ?? "0") > maxBytes)
    throw new InputError("body_too_large");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new InputError("body_too_large");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InputError("invalid_input");
  }
}
export function inputProblem(error: unknown) {
  if (error instanceof InputError)
    return problem(
      error.message === "origin_rejected" ? 403 : 422,
      error.message.toUpperCase(),
    );
  return problem(503, "SERVICE_UNAVAILABLE");
}
export function dbProblem(error: { code?: string; message?: string }) {
  if (error.message === "mfa_required") return problem(403, "MFA_REQUIRED");
  if (error.code === "28000") return problem(401, "SESSION_UNAVAILABLE");
  if (error.code === "P0002" || error.code === "42501")
    return problem(404, "NOT_FOUND");
  if (
    error.code === "40001" ||
    error.code === "23505" ||
    error.message === "last_owner"
  )
    return problem(409, "STATE_CONFLICT");
  if (
    error.code?.startsWith("22") ||
    error.code === "23514" ||
    error.code === "23503"
  )
    return problem(422, "INVALID_INPUT");
  return problem(503, "DATABASE_NOT_READY");
}
// ป้องกันเบื้องต้นต่อ instance ไม่ใช่ distributed rate limit; ก่อน pilot ต้องเพิ่ม edge/provider protection
const attempts = new Map<string, { count: number; until: number }>();
export function rateLimited(
  action: string,
  identity: string,
  now = Date.now(),
): boolean {
  const key = createHash("sha256")
    .update(`${action}:${identity}`)
    .digest("hex");
  if (attempts.size > 1000)
    for (const [key, item] of attempts)
      if (item.until < now) attempts.delete(key);
  if (attempts.size >= 10000 && !attempts.has(key)) return true;
  const current = attempts.get(key);
  if (!current || current.until <= now) {
    attempts.set(key, { count: 1, until: now + 60000 });
    return false;
  }
  current.count += 1;
  return current.count > 6;
}
