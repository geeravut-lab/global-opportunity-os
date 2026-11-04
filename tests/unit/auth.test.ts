import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { authConfig, callbackPath } from "../../lib/auth/config";
import {
  object,
  password,
  confirmed,
  version,
  uuid,
  text,
} from "../../lib/auth/input";
import {
  readBody,
  success,
  problem,
  dbProblem,
  rateLimited,
} from "../../lib/auth/http";
const env = {
  AUTH_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  APP_ORIGIN: "https://example.test",
};
describe("S1 config and input boundary", () => {
  it("fails closed until enabled and complete", () => {
    expect(authConfig({})).toBeNull();
    expect(authConfig({ ...env, AUTH_ENABLED: "false" })).toBeNull();
    expect(authConfig({ ...env, APP_ORIGIN: undefined })).toBeNull();
  });
  it("rejects privileged keys", () => {
    const key = `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.b`;
    expect(
      authConfig({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toBeNull();
  });
  it("rejects cleartext remote and injected path/userinfo", () => {
    for (const url of [
      "http://example.test",
      "https://user:pass@example.test",
      "https://example.test/path",
      "https://example.test?x=1",
    ])
      expect(authConfig({ ...env, APP_ORIGIN: url })).toBeNull();
  });
  it("allows loopback only for development http", () => {
    expect(
      authConfig({ ...env, APP_ORIGIN: "http://127.0.0.1:3000" })?.origin,
    ).toBe("http://127.0.0.1:3000");
  });
  it("callback never uses arbitrary next destinations", () => {
    expect(callbackPath("en", "https://evil.test")).toBe("/en/account");
    expect(callbackPath("th", "password")).toBe(
      "/th/account/security?recovery=1",
    );
  });
  it("rejects unknown ownership/roles and false consent", () => {
    expect(() => object({ owner: "x" }, ["alias"])).toThrow();
    expect(() => confirmed("true")).toThrow();
    expect(() => confirmed(false)).toThrow();
  });
  it("preserves password spaces and allows existing short passwords only on login", () => {
    expect(password("  long enough password  ")).toBe(
      "  long enough password  ",
    );
    expect(password("short", 1)).toBe("short");
    expect(() => password("short")).toThrow();
  });
  it("requires versions and valid identifiers without clearing malformed fields", () => {
    for (const n of [0, 1.2, "1"]) expect(() => version(n)).toThrow();
    expect(() => uuid("not-a-uuid")).toThrow();
    expect(() => text({}, 0, 80)).toThrow();
  });
});
describe("S1 HTTP boundary", () => {
  it("rejects absent/cross-site Origin", async () => {
    for (const origin of [undefined, "https://evil.test"]) {
      const r = new NextRequest("https://example.test/api", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(origin ? { origin } : {}),
        },
        body: "{}",
      });
      await expect(readBody(r, env.APP_ORIGIN)).rejects.toThrow(
        "origin_rejected",
      );
    }
  });
  it("rejects oversized JSON and form submissions", async () => {
    for (const [content, body] of [
      ["application/json", JSON.stringify({ x: "a".repeat(8200) })],
      ["application/x-www-form-urlencoded", "password=fixture"],
    ]) {
      const r = new NextRequest("https://example.test/api", {
        method: "POST",
        headers: { origin: env.APP_ORIGIN, "content-type": content },
        body,
      });
      await expect(readBody(r, env.APP_ORIGIN)).rejects.toThrow();
    }
  });
  it("private responses disable caches and hide database details", async () => {
    for (const r of [
      success({ ok: true }),
      problem(401, "SIGN_IN_REQUIRED"),
      dbProblem({ code: "XX000", message: "private SQL detail" }),
    ]) {
      expect(r.headers.get("cache-control")).toContain("no-store");
      expect(await r.text()).not.toContain("private SQL detail");
    }
  });
  it("bounds attempts per identity and expires the window", () => {
    for (let i = 0; i < 6; i++)
      expect(rateLimited("test", "synthetic@example.test", 1000)).toBe(false);
    expect(rateLimited("test", "synthetic@example.test", 1001)).toBe(true);
    expect(rateLimited("test", "synthetic@example.test", 62000)).toBe(false);
  });
});
