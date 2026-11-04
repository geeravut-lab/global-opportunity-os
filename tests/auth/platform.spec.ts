import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import {
  actor,
  signIn,
  post,
  totp,
  runtime,
  noticeId,
  origin,
} from "./helpers";
async function sql(query: string, values: unknown[] = []) {
  const c = new pg.Client({ connectionString: runtime.dbUrl });
  await c.connect();
  try {
    return (await c.query(query, values)).rows;
  } finally {
    await c.end();
  }
}
async function admin(page: Page, lang = "en") {
  const u = await actor();
  await sql(
    "insert into private.platform_role_grants(account_id,role_code,granted_by) values($1,'platform_admin',$1)",
    [u.id],
  );
  await signIn(page, u, lang);
  const e = await post(page.request, "/api/auth/mfa-enroll", {});
  expect(e.status()).toBe(200);
  const d = (await e.json()).data;
  expect(
    (
      await post(page.request, "/api/auth/mfa-verify", {
        factorId: d.id,
        code: totp(d.secret),
      })
    ).status(),
  ).toBe(200);
  return u;
}
test("ordinary users cannot open real admin pages or mutate branding", async ({
  page,
}) => {
  await signIn(page, await actor());
  const r = await page.goto("/en/admin");
  expect(r?.status()).toBe(404);
  expect(
    (
      await post(page.request, "/api/platform", {
        action: "settings",
        nameTh: "x",
        nameEn: "x",
        flags: {},
        expectedVersion: 1,
      })
    ).status(),
  ).toBe(404);
});
test("MFA-protected PNG upload, versioned favicon and restore default", async ({
  page,
}) => {
  await admin(page);
  await page.goto("/en/admin/branding");
  await expect(page.locator("#brand-logo")).toBeVisible();
  const file = page.locator("#brand-logo");
  await file.setInputFiles("public/brand-defaults/logo.png");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/platform") && r.request().method() === "POST",
  );
  await file.locator("..").locator("button").click();
  const r = await response;
  expect(r.status()).toBe(200);
  await expect(page.locator(".platform-page")).toHaveAttribute(
    "data-live-busy",
    "false",
  );
  const image = await page.request.get("/brand/logo");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  const etag = image.headers().etag;
  expect(Boolean(etag)).toBe(true);
  expect(
    (
      await page.request.get("/brand/logo", {
        headers: { "If-None-Match": etag },
      })
    ).status(),
  ).toBe(304);
  await expect(page.locator("#brand-favicon")).toBeEnabled();
  await page
    .locator("#brand-favicon")
    .setInputFiles("public/brand-defaults/favicon.png");
  const fv = page.waitForResponse(
    (r) => r.url().endsWith("/api/platform") && r.request().method() === "POST",
  );
  await page.locator("#brand-favicon").locator("..").locator("button").click();
  expect((await fv).status()).toBe(200);
  await expect(page.locator("link[rel=icon]")).not.toHaveAttribute(
    "href",
    /v=default/,
  );
  const favicon = await page.request.get("/brand/favicon?size=192");
  expect(favicon.status()).toBe(200);
  await page
    .getByRole("button", { name: "Use default image", exact: true })
    .first()
    .click();
  await expect
    .poll(async () =>
      (await page.request.get("/brand/logo", { maxRedirects: 0 })).status(),
    )
    .toBe(307);
  const badFile = page.locator("#brand-logo");
  await badFile.setInputFiles({
    name: "evil.png",
    mimeType: "image/png",
    buffer: Buffer.from('<svg onload="alert(1)">' + "x".repeat(80)),
  });
  const bad = page.waitForResponse(
    (r) => r.url().endsWith("/api/platform") && r.request().method() === "POST",
  );
  await badFile.locator("..").locator("button").click();
  expect((await bad).status()).toBe(422);
  await expect(page.locator("main [role=alert]")).toContainText(
    "Invalid image",
  );
});
test("two signed-in windows update automatically and preserve dirty form drafts", async ({
  page,
  browser,
}) => {
  const u = await actor();
  await signIn(page, u);
  const other = await browser.newContext();
  const p = await other.newPage();
  await signIn(p, u);
  expect(
    (
      await post(p.request, "/api/v1/subjects", {
        displayAlias: "Live profile A",
        country: "TH",
        ageBand: "adult",
        noticeId,
        confirmed: true,
      })
    ).status(),
  ).toBe(200);
  await expect(page.locator("main")).toContainText("Live profile A", {
    timeout: 15000,
  });
  await page.goto("/en/account/profile");
  await page.locator("#profile-alias").fill("Unsaved local draft");
  await page.locator("main h1").click();
  const me = (await (await p.request.get("/api/v1/me")).json()).data;
  expect(
    (
      await p.request.patch(`/api/v1/subjects/${me.profile.id}`, {
        headers: { Origin: origin },
        data: {
          displayAlias: "Remote profile B",
          coarseRegion: "",
          expectedVersion: me.profile.version,
        },
      })
    ).status(),
  ).toBe(200);
  await expect(page.locator(".live-state")).toContainText(
    "Updates are waiting",
    { timeout: 15000 },
  );
  await expect(page.locator("#profile-alias")).toHaveValue(
    "Unsaved local draft",
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toContainText("changed");
  await expect(page.locator("#profile-alias")).toHaveValue(
    "Unsaved local draft",
  );
  await other.close();
});
test("global logout causes the other open account page to leave automatically", async ({
  page,
  browser,
}) => {
  const u = await actor();
  await signIn(page, u);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await signIn(p, u);
  expect((await post(p.request, "/api/auth/logout", {})).status()).toBe(200);
  await expect(page).toHaveURL(/\/en\/auth\/login/, { timeout: 15000 });
  await ctx.close();
});
test("changing password requires correct current password, then rejects old credentials", async ({
  page,
}) => {
  const u = await actor();
  await signIn(page, u);
  expect(
    (
      await post(page.request, "/api/auth/password", {
        password: "Synthetic-New-Password-2026",
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(page.request, "/api/auth/password", {
        password: "Synthetic-New-Password-2026",
        currentPassword: "wrong",
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await post(page.request, "/api/auth/password", {
        password: "Synthetic-New-Password-2026",
        currentPassword: u.password,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(page.request, "/api/auth/login", {
        email: u.email,
        password: u.password,
        locale: "en",
      })
    ).status(),
  ).toBe(401);
});
for (const lang of ["th", "en"])
  test(`${lang}: real platform pages WCAG and mobile reflow`, async ({
    page,
  }) => {
    await admin(page, lang);
    for (const section of ["", "branding", "features", "admins", "audit"]) {
      await page.goto(`/${lang}/admin/${section}`);
      await expect(page.locator("main h1")).toBeVisible();
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(a.violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  });
