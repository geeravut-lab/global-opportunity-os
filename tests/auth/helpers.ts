import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { localRuntime, type FixtureActor } from "../../scripts/local-runtime";
export const runtime = localRuntime();
export const origin = "http://127.0.0.1:3000";
export const noticeId = "00000000-0000-4000-8000-000000000001";
export async function actor(): Promise<FixtureActor> {
  const email = `browser-${randomBytes(8).toString("hex")}@example.test`,
    password = randomBytes(24).toString("base64url");
  const admin = createClient(runtime.apiUrl, runtime.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (r.error || !r.data.user) throw Error("local fixture creation failed");
  const client = createClient(runtime.apiUrl, runtime.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (
    (await client.auth.signInWithPassword({ email, password })).error ||
    (await client.rpc("goos_bootstrap_account", { p_locale: "en" })).error
  )
    throw Error("fixture account bootstrap failed");
  await client.auth.signOut({ scope: "local" });
  return { id: r.data.user.id, email, password };
}
export function post(request: APIRequestContext, path: string, data: unknown) {
  return request.post(path, { headers: { Origin: origin }, data });
}
export async function signIn(page: Page, user: FixtureActor, lang = "en") {
  const r = await post(page.request, "/api/auth/login", {
    email: user.email,
    password: user.password,
    locale: lang,
  });
  expect(r.status()).toBe(200);
  await page.goto(`/${lang}/account`);
  await expect(page.locator("main h1")).toBeVisible();
}
export function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.toUpperCase().replace(/=/g, "")) {
    const n = alphabet.indexOf(ch);
    if (n < 0) throw Error("invalid fixture TOTP");
    bits += n.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
      parseInt(bits.slice(i * 8, i * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const d = createHmac("sha1", key).update(counter).digest(),
    o = d[d.length - 1] & 15;
  return ((d.readUInt32BE(o) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export async function mailLink(address: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const data = await (
          await fetch(
            `${runtime.mailUrl}/api/v1/search?query=${encodeURIComponent("to:" + address)}`,
          )
        ).json();
        id = data.messages?.[0]?.ID;
        return Boolean(id);
      },
      { timeout: 10000 },
    )
    .toBe(true);
  const mail = await (
    await fetch(`${runtime.mailUrl}/api/v1/message/${id}`)
  ).json();
  const matches =
    String(mail.HTML ?? mail.Text).match(/https?:[^\s"<>]+/g) ?? [];
  const link = matches
    .map((s) => s.replaceAll("&amp;", "&"))
    .find((s) => {
      try {
        const u = new URL(s);
        return u.origin === runtime.apiUrl && u.pathname === "/auth/v1/verify";
      } catch {
        return false;
      }
    });
  if (!link) throw Error("local verification link missing");
  return link;
}
