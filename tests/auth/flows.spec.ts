import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import {
  actor,
  signIn,
  post,
  origin,
  runtime,
  noticeId,
  totp,
  mailLink,
} from "./helpers";
test("protected pages and APIs deny anonymous access", async ({ page }) => {
  await page.goto("/en/account/profile");
  await expect(page).toHaveURL(/\/en\/auth\/login/);
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
});
for (const lang of ["th", "en"])
  test(`${lang}: email/password UI login, private DTO and HttpOnly cookies`, async ({
    page,
  }) => {
    const user = await actor();
    await page.goto(`/${lang}/auth/login`);
    await page.locator("#auth-email").fill(user.email);
    await page.locator("#auth-password").fill(user.password);
    await page.locator("form button[type=submit]").click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account$`));
    const r = await page.request.get("/api/v1/me");
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toContain("no-store");
    const data = await r.json();
    expect(data.data.context.account_id === user.id).toBe(true);
    expect(
      /"(access_token|refresh_token|service_role|password)"\s*:/.test(
        JSON.stringify(data),
      ),
    ).toBe(false);
    const cookies = (await page.context().cookies()).filter((c) =>
      c.name.startsWith("sb-"),
    );
    expect(cookies.length > 0).toBe(true);
    expect(cookies.every((c) => c.httpOnly && c.sameSite === "Lax")).toBe(true);
    expect(await page.evaluate(() => document.cookie.includes("sb-"))).toBe(
      false,
    );
  });
test("Google initiation uses PKCE, minimal scopes and fixed callback; no live round-trip", async ({
  page,
}) => {
  const r = await post(page.request, "/api/auth/google", {
    locale: "en",
    adultConfirmed: true,
  });
  expect(r.status()).toBe(200);
  const url = new URL((await r.json()).data.redirect);
  expect(url.origin === runtime.apiUrl).toBe(true);
  expect(url.pathname).toBe("/auth/v1/authorize");
  expect(url.searchParams.get("provider")).toBe("google");
  expect(
    url.searchParams.get("redirect_to") === origin + "/en/auth/callback",
  ).toBe(true);
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  expect(Boolean(url.searchParams.get("code_challenge"))).toBe(true);
  expect(url.searchParams.get("scopes")).toBe("openid email profile");
  expect(
    (await page.context().cookies()).some(
      (c) => c.name.includes("code-verifier") && c.httpOnly,
    ),
  ).toBe(true);
  expect(
    (
      await post(page.request, "/api/auth/google", {
        locale: "en",
        adultConfirmed: false,
      })
    ).status(),
  ).toBe(422);
});
test("invalid callback cannot use next for an open redirect", async ({
  page,
}) => {
  const r = await page.request.get(
    "/en/auth/callback?code=invalid&next=https://evil.test",
    { maxRedirects: 0 },
  );
  expect(r.status()).toBe(307);
  const target = new URL(r.headers().location);
  expect(target.origin === origin).toBe(true);
  expect(target.pathname).toBe("/en/auth/login");
  expect(r.headers()["cache-control"]).toContain("no-store");
});
test("CSRF, unknown roles and missing age/consent are rejected", async ({
  page,
}) => {
  const user = await actor();
  await signIn(page, user);
  for (const headers of [{ Origin: "https://evil.test" }, {}] as Record<
    string,
    string
  >[]) {
    const r = await page.request.post("/api/v1/subjects", {
      headers,
      data: {},
    });
    expect(r.status()).toBe(403);
  }
  const profile = {
    displayAlias: "สมมติ",
    country: "TH",
    ageBand: "adult",
    noticeId,
    confirmed: true,
  };
  expect(
    (
      await post(page.request, "/api/v1/subjects", {
        ...profile,
        ownerId: user.id,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(page.request, "/api/v1/subjects", {
        ...profile,
        ageBand: "minor",
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(page.request, "/api/v1/subjects", {
        ...profile,
        confirmed: false,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(page.request, "/api/v1/organizations", {
        name: "สมมติ",
        country: "TH",
      })
    ).status(),
  ).toBe(403);
});
test("profile creation/edit, escaped text and optimistic concurrency", async ({
  page,
}) => {
  await signIn(page, await actor());
  await page.goto("/en/account/profile");
  await page.locator("#profile-alias").fill("<img src=x onerror=alert(1)>");
  await page.locator("form input[type=checkbox]").nth(0).check();
  await page.locator("form input[type=checkbox]").nth(1).check();
  await page
    .getByRole("button", { name: "Create fictional profile", exact: true })
    .click();
  await expect(page.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(page.locator("#profile-region")).toBeVisible();
  const me = (await (await page.request.get("/api/v1/me")).json()).data;
  expect(me.profile.display_alias.includes("<img")).toBe(true);
  expect(await page.locator("main img[src=x]").count()).toBe(0);
  await page.locator("#profile-region").fill("พื้นที่สมมติ");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/me")).json()).data.profile
          .version,
    )
    .toBe(2);
  const stale = await page.request.patch(`/api/v1/subjects/${me.profile.id}`, {
    headers: { Origin: origin },
    data: { displayAlias: "stale", coarseRegion: "", expectedVersion: 1 },
  });
  expect(stale.status()).toBe(409);
});
test("cross-owner direct API access returns no personal fields", async ({
  page,
  browser,
}) => {
  await signIn(page, await actor());
  const created = await post(page.request, "/api/v1/subjects", {
    displayAlias: "ข้อมูลสมมติส่วนตัว",
    country: "TH",
    ageBand: "adult",
    noticeId,
    confirmed: true,
  });
  expect(created.status()).toBe(200);
  const id = (await created.json()).data;
  const other = await browser.newContext();
  const p = await other.newPage();
  await signIn(p, await actor());
  const r = await p.request.get(`/api/v1/subjects/${id}`);
  expect(r.status()).toBe(404);
  expect((await r.text()).includes("ข้อมูลสมมติส่วนตัว")).toBe(false);
  await other.close();
});
test("MFA through UI gates draft organization and recipient-bound invitation cancellation", async ({
  page,
}) => {
  // The full MFA → organization → recipient invitation lifecycle includes several completed requests and refreshes.
  test.setTimeout(90000);
  await signIn(page, await actor());
  await page.goto("/en/account/security");
  const enrolled = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/mfa-enroll") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Set up MFA", exact: true }).click();
  const data = (await (await enrolled).json()).data;
  await page.locator("#mfa-code").fill(totp(data.secret));
  await page
    .getByRole("button", { name: "Verify MFA code", exact: true })
    .click();
  await expect(page.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(page.getByText("MFA verified", { exact: true })).toBeVisible();
  await page.goto("/en/account/organizations");
  await page.locator("#organization-name").fill("องค์กรสมมติ Browser");
  await page
    .getByRole("button", { name: "Create draft organization", exact: true })
    .click();
  await expect(page.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(
    page.getByRole("heading", { name: "องค์กรสมมติ Browser" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View members", exact: true }).click();
  await page.locator("#recipient-id").fill((await actor()).id);
  await page
    .getByRole("button", {
      name: "Create invitation (no email sent)",
      exact: true,
    })
    .click();
  await expect(page.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(
    page.getByRole("button", { name: "Cancel invitation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel invitation", exact: true })
    .click();
  await expect(page.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(
    page.getByRole("button", { name: "Cancel invitation", exact: true }),
  ).toHaveCount(0);
});
test("global logout denies still-held cookies in a second session", async ({
  page,
  browser,
}) => {
  const user = await actor();
  await signIn(page, user);
  const other = await browser.newContext();
  const p = await other.newPage();
  await signIn(p, user);
  expect((await p.request.get("/api/v1/me")).status()).toBe(200);
  expect((await post(page.request, "/api/auth/logout", {})).status()).toBe(200);
  expect((await p.request.get("/api/v1/me")).status()).toBe(401);
  await other.close();
});
test("email confirmation PKCE in same browser; no unconfirmed login", async ({
  page,
}) => {
  const email = `confirm-${randomBytes(8).toString("hex")}@example.test`,
    password = randomBytes(24).toString("base64url");
  expect(
    (
      await post(page.request, "/api/auth/signup", {
        email,
        password,
        locale: "en",
        adultConfirmed: true,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(page.request, "/api/auth/login", {
        email,
        password,
        locale: "en",
      })
    ).status(),
  ).toBe(401);
  await page.goto(await mailLink(email));
  await expect(page).toHaveURL(/\/en\/account$/);
  expect((await page.request.get("/api/v1/me")).status()).toBe(200);
});
test("password recovery PKCE, update and sign-out; existence-neutral response", async ({
  page,
}) => {
  const user = await actor();
  const unknown = await post(page.request, "/api/auth/recover", {
    email: `absent-${randomBytes(8).toString("hex")}@example.test`,
    locale: "en",
  });
  expect(unknown.status()).toBe(200);
  const r = await post(page.request, "/api/auth/recover", {
    email: user.email,
    locale: "en",
  });
  expect(r.status()).toBe(200);
  expect((await r.json()).data).toEqual((await unknown.json()).data);
  await page.goto(await mailLink(user.email));
  await expect(page).toHaveURL(/\/en\/account\/security\?recovery=1/);
  const next = randomBytes(24).toString("base64url");
  await page.locator("#new-password").fill(next);
  await page.locator("#repeat-password").fill(next);
  await page
    .getByRole("button", {
      name: "Set/change password and sign out",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/en\/auth\/login/);
  expect(
    (
      await post(page.request, "/api/auth/login", {
        email: user.email,
        password: user.password,
        locale: "en",
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await post(page.request, "/api/auth/login", {
        email: user.email,
        password: next,
        locale: "en",
      })
    ).status(),
  ).toBe(200);
});
