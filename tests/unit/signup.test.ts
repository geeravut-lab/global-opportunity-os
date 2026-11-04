import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const provider = vi.hoisted(() => ({
  signUp: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/request", () => ({
  requestClient: () => ({
    config: { origin: "http://127.0.0.1:3000" },
    client: {
      auth: { signUp: provider.signUp, signOut: provider.signOut },
      rpc: provider.rpc,
    },
    apply: (response: unknown) => response,
  }),
}));
import { POST } from "../../app/api/auth/[action]/route";
let fixtureNumber = 0;
function signup(locale = "en") {
  return POST(
    new NextRequest("http://127.0.0.1:3000/api/auth/signup", {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: `signup-contract-${++fixtureNumber}@example.test`,
        password: "Synthetic-Password-2026",
        locale,
        adultConfirmed: true,
      }),
    }),
    { params: Promise.resolve({ action: "signup" }) },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  provider.signUp.mockResolvedValue({
    data: {
      user: { email_confirmed_at: "2026-11-04T00:00:00Z" },
      session: {
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
      },
    },
    error: null,
  });
  provider.rpc.mockResolvedValue({
    data: "00000000-0000-4000-8000-000000000099",
    error: null,
  });
  provider.signOut.mockResolvedValue({ error: null });
});
describe("Signup contract for provider confirmation settings", () => {
  for (const locale of ["th", "en"])
    it(`${locale}: auto-confirm bootstraps through JWT/RLS and returns no credentials`, async () => {
      const r = await signup(locale);
      expect(r.status).toBe(200);
      expect((await r.json()).data).toEqual({
        accepted: true,
        redirect: `/${locale}/account`,
      });
      expect(provider.rpc).toHaveBeenCalledExactlyOnceWith(
        "goos_bootstrap_account",
        { p_locale: locale },
      );
      expect(r.headers.get("cache-control")).toContain("no-store");
    });
  it("confirmation-on waits for the email link without bootstrapping", async () => {
    provider.signUp.mockResolvedValue({
      data: { user: { email_confirmed_at: null }, session: null },
      error: null,
    });
    const r = await signup();
    expect((await r.json()).data).toEqual({ accepted: true });
    expect(provider.rpc).not.toHaveBeenCalled();
  });
  it("a session without a confirmed Auth identity cannot bootstrap", async () => {
    provider.signUp.mockResolvedValue({
      data: {
        user: { email_confirmed_at: null },
        session: { access_token: "synthetic-access" },
      },
      error: null,
    });
    const r = await signup();
    expect((await r.json()).data).toEqual({ accepted: true });
    expect(provider.rpc).not.toHaveBeenCalled();
  });
  it("duplicate-account provider errors remain generic", async () => {
    provider.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 422, code: "user_already_exists" },
    });
    const r = await signup();
    expect((await r.json()).data).toEqual({ accepted: true });
    expect(provider.rpc).not.toHaveBeenCalled();
  });
  it("a failed bootstrap clears the local session and denies account redirect", async () => {
    provider.rpc.mockResolvedValue({ data: null, error: { code: "28000" } });
    const r = await signup();
    expect(r.status).toBe(401);
    expect((await r.json()).data).toBeUndefined();
    expect(provider.signOut).toHaveBeenCalledExactlyOnceWith({
      scope: "local",
    });
  });
  it("provider outages cannot be reported as successful registration", async () => {
    provider.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 503 },
    });
    expect((await signup()).status).toBe(503);
    expect(provider.rpc).not.toHaveBeenCalled();
  });
});
