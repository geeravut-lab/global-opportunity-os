import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type APIResponse,
} from "@playwright/test";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authText } from "../../lib/auth/copy";
import {
  validationRuntime,
  fixtureAdmin,
  management,
  privateJson,
  cleanupFixtures,
  syntheticTotp,
  type FixtureManifest,
} from "../../scripts/validation-runtime";
const r = validationRuntime();
let manifest: FixtureManifest, manifestPath: string, admin: SupabaseClient;
const contexts: BrowserContext[] = [],
  pages: Page[] = [];
let orgA: string, orgB: string;
const checked = (ok: unknown, label: string) => {
  if (!ok) throw Error(label);
};
const post = (p: Page, path: string, data: unknown) =>
  p.request.post(path, { headers: { Origin: r.origin }, data });
async function body(response: APIResponse, status = 200) {
  checked(
    response.status() === status,
    "Unexpected BFF status: " + response.status(),
  );
  return (await response.json()).data;
}
const me = (p: Page) => p.request.get("/api/v1/me").then((x) => body(x));
const save = () => privateJson(manifestPath, manifest);
async function profile(p: Page, name: string) {
  const d = await me(p);
  if (d.profile) return d.profile;
  await body(
    await post(p, "/api/v1/subjects", {
      displayAlias: name,
      country: "TH",
      ageBand: "adult",
      noticeId: d.notices[0].id,
      confirmed: true,
    }),
  );
  return (await me(p)).profile;
}
async function assure(i: number) {
  const p = pages[i],
    a = manifest.actors[i],
    ctx = (await me(p)).context;
  if (ctx.staff_assured) return;
  if (!a.factorId) {
    const e = await body(await post(p, "/api/auth/mfa-enroll", {}));
    a.factorId = e.id;
    a.totp = e.secret;
    save();
  }
  checked(!!a.totp, "Missing synthetic TOTP");
  await body(
    await post(p, "/api/auth/mfa-verify", {
      factorId: a.factorId,
      code: syntheticTotp(a.totp!),
    }),
  );
  checked((await me(p)).context.staff_assured, "MFA assurance missing");
}
async function live(p: Page) {
  return body(
    await p.request.get("/api/live/token", { headers: { "X-Goos-Live": "1" } }),
  );
}
function jwtClient(token: string) {
  return createClient(r.apiUrl, r.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: "Bearer " + token } },
  });
}
test.beforeAll(async ({ browser }) => {
  manifest = {
    run: "gooss1" + randomBytes(8).toString("hex"),
    target: r.mode,
    project: r.project,
    apiOrigin: r.apiUrl,
    startedAt: new Date().toISOString(),
    actors: [],
    organizations: [],
    pending: [],
  };
  manifestPath = ".local/" + manifest.run + ".json";
  save();
  // No writes before both destinations and confirmation policy are proven usable.
  try {
    const probe = await fetch(r.origin + "/th/auth/signup", {
      signal: AbortSignal.timeout(12000),
    });
    checked(probe.status === 200, "Application network preflight failed");
    const settings = await fetch(r.apiUrl + "/auth/v1/settings", {
      headers: { apikey: r.key },
      signal: AbortSignal.timeout(12000),
    });
    checked(settings.ok, "Provider network preflight failed");
    const s = await settings.json();
    checked(
      s.mailer_autoconfirm === true,
      "Confirm email must be Off; aborting without sending emails",
    );
    if (r.mode === "hosted") {
      const cfg = await management("/config/auth");
      checked(
        cfg.mailer_autoconfirm === true,
        "Hosted confirmation policy changed",
      );
    }
  } catch {
    throw Error(
      "Validation preflight blocked or confirmation is On; no fixture signup was attempted",
    );
  }
  admin = await fixtureAdmin(r);
  for (let i = 0; i < 3; i++) {
    const c = await browser.newContext(),
      p = await c.newPage(),
      lang = i === 0 ? "th" : "en",
      email =
        manifest.run + "-" + String.fromCharCode(97 + i) + "@example.test",
      password = "S1-Fixture-" + randomBytes(18).toString("base64url");
    contexts.push(c);
    pages.push(p);
    manifest.pending!.push({ email, password });
    save();
    await p.goto("/" + lang + "/auth/signup");
    await p.locator("#auth-email").fill(email);
    await p.locator("#auth-password").fill(password);
    await p.getByRole("checkbox").check();
    const response = p.waitForResponse(
      (x) =>
        x.url().endsWith("/api/auth/signup") && x.request().method() === "POST",
    );
    await p
      .getByRole("button", { name: authText[lang].signUp, exact: true })
      .click();
    checked((await response).status() === 200, "Synthetic signup failed");
    await expect(p).toHaveURL(new RegExp("/" + lang + "/account$"));
    const d = await me(p),
      id = d.context.account_id;
    const u = await admin.auth.admin.getUserById(id);
    checked(
      !u.error && u.data.user?.email === email,
      "Synthetic identity mismatch",
    );
    const tag = await admin.auth.admin.updateUserById(id, {
      app_metadata: {
        ...u.data.user!.app_metadata,
        goos_fixture_run: manifest.run,
      },
    });
    checked(!tag.error, "Fixture ownership tagging failed");
    manifest.actors.push({ id, email, password });
    manifest.pending = manifest.pending!.filter((x) => x.email !== email);
    save();
  }
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
  if (manifest && admin) {
    try {
      await cleanupFixtures(r, manifest, admin);
    } finally {
      save();
    }
  }
});
test("Email Off: UI signup, Secure/HttpOnly cookies, reload and logout/login", async () => {
  const p = pages[0];
  await p.reload();
  checked(
    (await me(p)).context.account_id === manifest.actors[0].id,
    "Reload lost authenticated identity",
  );
  const cookies = await contexts[0].cookies();
  checked(
    cookies.some(
      (x) => x.name.startsWith("sb-") && x.name.includes("auth-token"),
    ),
    "No Auth cookie",
  );
  checked(
    cookies
      .filter((x) => x.name.startsWith("sb-") && x.name.includes("auth-token"))
      .every(
        (x) =>
          x.httpOnly &&
          x.sameSite === "Lax" &&
          (r.mode !== "hosted" || x.secure),
      ),
    "Auth cookie attributes",
  );
  const resp = await p.request.get("/api/v1/me");
  checked(
    resp.headers()["cache-control"]?.includes("no-store"),
    "Private API caching",
  );
  checked(
    !/"(?:access_token|refresh_token|service_role|password)"\s*:/.test(
      await resp.text(),
    ),
    "Credential leaked in account DTO",
  );
  await body(await post(p, "/api/auth/logout", {}));
  checked(
    (await p.request.get("/api/v1/me")).status() === 401,
    "Logout did not deny existing cookies",
  );
  await body(
    await post(p, "/api/auth/login", {
      email: manifest.actors[0].email,
      password: manifest.actors[0].password,
      locale: "th",
    }),
  );
  await p.goto("/th/account");
  checked(
    (await me(p)).context.account_id === manifest.actors[0].id,
    "Email login identity mismatch",
  );
});
test("cross-user BFF/RPC, tampered JWT, direct table access and metadata role injection are denied", async () => {
  const a = await profile(pages[0], manifest.run + " A"),
    b = await profile(pages[1], manifest.run + " B");
  checked(
    (await pages[0].request.get("/api/v1/subjects/" + b.id)).status() === 404,
    "Cross-user BFF read",
  );
  checked(
    (
      await pages[0].request.patch("/api/v1/subjects/" + b.id, {
        headers: { Origin: r.origin },
        data: {
          displayAlias: "Denied",
          coarseRegion: "",
          expectedVersion: b.version,
        },
      })
    ).status() === 404,
    "Cross-user BFF write",
  );
  const own = await live(pages[0]),
    c = jwtClient(own.token);
  checked(
    (await c.rpc("goos_profile", { p_subject_id: b.id })).error?.code ===
      "P0002",
    "Cross-user direct RPC",
  );
  const table = await fetch(r.apiUrl + "/rest/v1/subjects?select=id", {
    headers: {
      apikey: r.key,
      Authorization: "Bearer " + own.token,
      "Accept-Profile": "app",
    },
  });
  checked(table.status !== 200, "Direct app schema exposed");
  const parts = own.token.split("."),
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  claims.role = "service_role";
  parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const tampered = await fetch(r.apiUrl + "/rest/v1/rpc/goos_context", {
    method: "POST",
    headers: {
      apikey: r.key,
      Authorization: "Bearer " + parts.join("."),
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  checked(tampered.status === 401, "Tampered JWT accepted");
  const injected = await fetch(r.apiUrl + "/auth/v1/user", {
    method: "PUT",
    headers: {
      apikey: r.key,
      Authorization: "Bearer " + own.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: { role: "platform_admin", organization_id: orgB },
    }),
  });
  checked(injected.ok, "Metadata test update failed");
  checked(
    (await me(pages[0])).context.has_platform_role === false,
    "Metadata escalated platform role",
  );
  checked(
    (await pages[1].request.get("/api/v1/subjects/" + a.id)).status() === 404,
    "Reverse cross-user read",
  );
});
test("read-only delegation and revocation deny the previously valid JWT", async () => {
  const p = pages[0],
    helper = pages[2],
    s = await profile(p, manifest.run + " A");
  await profile(helper, manifest.run + " C");
  const d = await me(p),
    grant = await body(
      await post(p, "/api/v1/delegations", {
        subjectId: s.id,
        delegateId: manifest.actors[2].id,
        scopes: ["profile:read"],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        noticeId: d.notices[0].id,
        confirmed: true,
      }),
    );
  const held = jwtClient((await live(helper)).token);
  checked(
    (await held.rpc("goos_profile", { p_subject_id: s.id })).data?.can_write ===
      false,
    "Read-only grant missing",
  );
  checked(
    (
      await held.rpc("goos_update_profile", {
        p_subject_id: s.id,
        p_display_alias: "Denied",
        p_coarse_region: "",
        p_safe_contact: null,
        p_expected_version: s.version,
      })
    ).error?.code === "P0002",
    "Read-only grant wrote profile",
  );
  const fingerprint = (await body(await helper.request.get("/api/live"))).fingerprint;
  await body(await p.request.patch("/api/v1/subjects/" + s.id, {
    headers: { Origin: r.origin },
    data: { displayAlias: manifest.run + " Delegated update", coarseRegion: "", expectedVersion: s.version },
  }));
  checked((await body(await helper.request.get("/api/live"))).fingerprint !== fingerprint,
    "Active delegate missed an authorized profile change");
  await body(
    await post(p, "/api/v1/delegations/" + grant + "/revoke", {
      expectedVersion: 1,
    }),
  );
  checked(
    (await held.rpc("goos_profile", { p_subject_id: s.id })).error?.code ===
      "P0002",
    "Revoked grant worked with old JWT",
  );
  checked(
    (await me(helper)).context.account_id === manifest.actors[2].id,
    "Revocation blocked helper own account",
  );
});
test("MFA organizations, cross-tenant denial and live membership revocation", async () => {
  await assure(0);
  await assure(1);
  await assure(2);
  orgA = await body(
    await post(pages[0], "/api/v1/organizations", {
      name: manifest.run + " Org A",
      country: "TH",
    }),
  );
  manifest.organizations.push(orgA);
  save();
  orgB = await body(
    await post(pages[1], "/api/v1/organizations", {
      name: manifest.run + " Org B",
      country: "TH",
    }),
  );
  manifest.organizations.push(orgB);
  save();
  checked(
    (
      await pages[1].request.get("/api/v1/organizations/" + orgA + "/members")
    ).status() === 404,
    "Cross-tenant members read",
  );
  const invite = await body(
    await post(pages[0], "/api/v1/organizations/" + orgA + "/invitations", {
      recipientId: manifest.actors[2].id,
      role: "admin",
    }),
  );
  await body(
    await post(pages[2], "/api/v1/invitations/" + invite + "/accept", {}),
  );
  const held = jwtClient((await live(pages[2])).token);
  checked(
    !(await held.rpc("goos_members", { p_org: orgA })).error,
    "Accepted member cannot read own tenant",
  );
  checked(
    (await held.rpc("goos_members", { p_org: orgB })).error?.code === "P0002",
    "Member crossed tenant",
  );
  await pages[2].goto("/en/account/organizations");
  await expect(pages[2].locator("main")).toContainText(manifest.run + " Org A");
  const members = await body(
      await pages[0].request.get("/api/v1/organizations/" + orgA + "/members"),
    ),
    member = members.find(
      (x: { account_id: string }) => x.account_id === manifest.actors[2].id,
    );
  checked(!!member, "Fixture membership missing");
  await body(
    await post(
      pages[0],
      "/api/v1/organizations/" + orgA + "/members/" + member.id + "/revoke",
      { expectedVersion: member.version },
    ),
  );
  checked(
    (await held.rpc("goos_members", { p_org: orgA })).error?.code === "P0002",
    "Revoked member old JWT still authorized",
  );
  await expect(pages[2].locator("main")).not.toContainText(
    manifest.run + " Org A",
    { timeout: 20000 },
  );
});
test('revoked delegates and former members receive no later activity signals',async()=>{
 const a=pages[0],c=pages[2],s=await profile(a,manifest.run+' A');
 const before=(await body(await c.request.get('/api/live'))).fingerprint;
 await body(await a.request.patch('/api/v1/subjects/'+s.id,{headers:{Origin:r.origin},data:{displayAlias:manifest.run+' After withdrawal',coarseRegion:'',expectedVersion:s.version}}));
 checked((await body(await c.request.get('/api/live'))).fingerprint===before,'Revoked delegate still received later profile activity');
 await body(await post(a,'/api/v1/organizations/'+orgA+'/invitations',{recipientId:manifest.actors[1].id,role:'catalog_editor'}));
 checked((await body(await c.request.get('/api/live'))).fingerprint===before,'Revoked member still received unrelated tenant activity');
});
declare global {
  interface Window {
    goosValidationSocket?: {
      client: SupabaseClient;
      pings: number;
      payloadSafe: boolean;
    };
    supabase: {
      createClient: (
        url: string,
        key: string,
        options: unknown,
      ) => SupabaseClient;
    };
  }
}
test("private WebSocket own-topic allowed, foreign-topic denied and mutation carries no record data", async () => {
  const p = pages[0],
    d = await live(p);
  await p.addScriptTag({
    path: resolve("node_modules/@supabase/supabase-js/dist/umd/supabase.js"),
  });
  const result = await p.evaluate(
    async ({ url, key, token, own, foreign }) => {
      const c = window.supabase.createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      await c.realtime.setAuth(token);
      window.goosValidationSocket = { client: c, pings: 0, payloadSafe: true };
      const join = (topic: string, listen: boolean) =>
        new Promise<string>((resolve) => {
          const timer = setTimeout(() => resolve("TIMEOUT"), 12000);
          const ch = c.channel(topic, { config: { private: true } });
          if (listen)
            ch.on("broadcast", { event: "ping" }, (event) => {
              const state = window.goosValidationSocket!;
              state.pings++;
              const payload = event.payload ?? {};
              state.payloadSafe &&=
                Object.keys(payload).every((k) => k === "id") &&
                (payload.id === undefined ||
                  (typeof payload.id === "string" &&
                    /^[a-f0-9-]{36}$/i.test(payload.id)));
            });
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
              clearTimeout(timer);
              resolve(status);
            }
          });
        });
      const ownStatus = await join(own, true),
        foreignStatus = await join(foreign, false);
      return { ownStatus, foreignStatus };
    },
    {
      url: d.url,
      key: d.key,
      token: d.token,
      own: d.topics[0],
      foreign: "goos:u:" + manifest.actors[1].id,
    },
  );
  checked(
    result.ownStatus === "SUBSCRIBED",
    "Own private WebSocket join failed: " + result.ownStatus,
  );
  checked(
    result.foreignStatus === "CHANNEL_ERROR",
    "Foreign private WebSocket join was not denied",
  );
  const s = await profile(p, manifest.run + " A");
  await body(
    await p.request.patch("/api/v1/subjects/" + s.id, {
      headers: { Origin: r.origin },
      data: {
        displayAlias: manifest.run + " Broadcast",
        coarseRegion: "",
        expectedVersion: s.version,
      },
    }),
  );
  await expect
    .poll(() => p.evaluate(() => window.goosValidationSocket?.pings ?? 0), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  checked(
    await p.evaluate(() => window.goosValidationSocket?.payloadSafe),
    "Broadcast leaked record data",
  );
  await p.evaluate(async () => {
    await window.goosValidationSocket?.client.removeAllChannels();
    delete window.goosValidationSocket;
  });
});
test("two windows refresh without manual reload and preserve an unsaved draft/conflict", async ({
  browser,
}) => {
  const other = await browser.newContext(),
    p = await other.newPage();
  contexts.push(other);
  await body(
    await post(p, "/api/auth/login", {
      email: manifest.actors[0].email,
      password: manifest.actors[0].password,
      locale: "en",
    }),
  );
  await p.goto("/en/account");
  await pages[0].goto("/th/account");
  let s = await profile(p, manifest.run + " A");
  await body(
    await p.request.patch("/api/v1/subjects/" + s.id, {
      headers: { Origin: r.origin },
      data: {
        displayAlias: manifest.run + " Live A",
        coarseRegion: "",
        expectedVersion: s.version,
      },
    }),
  );
  await expect(pages[0].locator("main")).toContainText(
    manifest.run + " Live A",
    { timeout: 20000 },
  );
  await pages[0].goto("/th/account/profile");
  await pages[0].locator("#profile-alias").fill("ร่างที่ยังไม่บันทึก");
  await pages[0].locator("main h1").click();
  s = (await me(p)).profile;
  await body(
    await p.request.patch("/api/v1/subjects/" + s.id, {
      headers: { Origin: r.origin },
      data: {
        displayAlias: manifest.run + " Remote B",
        coarseRegion: "",
        expectedVersion: s.version,
      },
    }),
  );
  await expect(pages[0].locator(".live-state")).toBeVisible({ timeout: 20000 });
  await expect(pages[0].locator("#profile-alias")).toHaveValue(
    "ร่างที่ยังไม่บันทึก",
  );
  await pages[0]
    .getByRole("button", { name: authText.th.updateProfile, exact: true })
    .click();
  await expect(pages[0].locator("main [role=alert]")).toBeVisible();
  await expect(pages[0].locator("#profile-alias")).toHaveValue(
    "ร่างที่ยังไม่บันทึก",
  );
});
test("cleanup refuses mismatched fixture identity without deleting either account", async () => {
  const forged: FixtureManifest = {
    ...manifest,
    actors: [{ ...manifest.actors[1], email: manifest.actors[0].email }],
    pending: [],
  };
  await expect(cleanupFixtures(r, forged, admin)).rejects.toThrow();
  checked(
    (await me(pages[0])).context.account_id === manifest.actors[0].id,
    "Cleanup guard damaged account A",
  );
  checked(
    (await me(pages[1])).context.account_id === manifest.actors[1].id,
    "Cleanup guard damaged account B",
  );
});
test("fixture MFA replacement removes old assurance and requires a newly verified factor", async () => {
  const helper = pages[2], actor = manifest.actors[2];
  await assure(2);
  const before = (await body(await helper.request.get("/api/live"))).fingerprint;
  checked(!!actor.factorId, "Missing fixture MFA factor");
  const removed = await admin.auth.admin.mfa.deleteFactor({ userId: actor.id, id: actor.factorId! });
  checked(!removed.error, "Fixture lost-factor removal failed");
  actor.factorId = undefined;
  actor.totp = undefined;
  save();
  checked(!(await me(helper)).context.staff_assured, "Deleted factor still authorized old aal2 session");
  checked((await body(await helper.request.get("/api/live"))).fingerprint !== before,
    "Polling missed Auth-side factor removal");
  await assure(2);
  checked((await me(helper)).context.staff_assured, "Replacement factor failed to restore verified assurance");
});
test("global sign-out causes another open account window to leave and old cookies are denied", async ({
  browser,
}) => {
  const c = await browser.newContext(),
    p = await c.newPage();
  contexts.push(c);
  await body(
    await post(p, "/api/auth/login", {
      email: manifest.actors[1].email,
      password: manifest.actors[1].password,
      locale: "en",
    }),
  );
  await p.goto("/en/account");
  await body(await post(pages[1], "/api/auth/logout", {}));
  await expect(p).toHaveURL(/\/en\/auth\/login/, { timeout: 20000 });
  checked(
    (await p.request.get("/api/v1/me")).status() === 401,
    "Old session cookie survived global signout",
  );
});
