import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { s2Text } from "../../lib/s2/copy";
import { syntheticTotp } from "../../scripts/validation-runtime";
const fixture = JSON.parse(readFileSync(".local/s2-fixtures.json", "utf8")) as {
  run: string;
  org: string;
  suspendedOrg: string;
  current: string;
  expired: string;
  suspended: string;
  actors: Record<
    string,
    {
      id: string;
      email: string;
      password: string;
      factorId?: string;
      totp?: string;
    }
  >;
};
const origin = "http://127.0.0.1:3200",
  contexts: BrowserContext[] = [],
  pages: Record<string, Page> = {};
const post = (p: Page, path: string, data: unknown) =>
  p.request.post(path, { headers: { Origin: origin }, data });
test.beforeAll(async ({ browser }) => {
  for (const name of ["user", "publisher", "reviewer"]) {
    const c = await browser.newContext();
    contexts.push(c);
    const p = await c.newPage();
    pages[name] = p;
    const a = fixture.actors[name];
    await p.goto("/en/auth/login");
    await p.locator("#auth-email").fill(a.email);
    await p.locator("#auth-password").fill(a.password);
    await p.locator("form button[type=submit]").click();
    await expect(p).toHaveURL(/\/en\/account$/);
    if (a.factorId) {
      const r = await post(p, "/api/auth/mfa-verify", {
        factorId: a.factorId,
        code: syntheticTotp(a.totp!),
      });
      expect(r.status()).toBe(200);
    }
  }
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});
test("anonymous workspace is protected; public catalog contains only current approved synthetic rows", async ({
  page,
}) => {
  await page.goto("/en/workspace/assessment");
  await expect(page).toHaveURL(/\/en\/auth\/login/);
  expect((await page.request.get("/api/s2/assessment")).status()).toBe(401);
  const result = await page.request.get("/api/s2/catalog?q=" + fixture.run);
  expect(result.status()).toBe(200);
  const body = await result.json();
  expect(body.data.items).toHaveLength(1);
  expect(body.data.items[0].id === fixture.current).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(
    /actor_id|created_by|uploaded_by|safe_body|original_body|email|password/,
  );
  for (const id of [fixture.expired, fixture.suspended, "a".repeat(36)])
    expect((await page.goto("/en/directory/" + id))?.status()).toBe(404);
});
test("Thai backend search, filters, zero results and detail source/expiry work", async ({
  page,
}) => {
  await page.goto("/th");
  await expect(page.locator('main a[href="/th/opportunities"]')).toBeVisible();
  await expect(
    page.locator('main a[href="/th/workspace/assessment"]'),
  ).toBeVisible();
  await expect(page.locator('main a[href^="/th/directory/"]')).toHaveCount(0);
  await page.locator('main a[href="/th/opportunities"]').click();
  await expect(page).toHaveURL(/\/th\/opportunities$/);
  await page.goto("/th/opportunities?q=" + fixture.run);
  await expect(page.locator("main article")).toHaveCount(1);
  await page
    .getByLabel("คำค้น", { exact: true })
    .fill("ไม่มีรายการ " + fixture.run);
  await page.locator("main form button[type=submit]").click();
  await expect(page.locator("main")).toContainText("ไม่พบโอกาสตามเงื่อนไขนี้");
  await page.goto(
    "/th/opportunities?q=" +
      fixture.run +
      "&access=" +
      encodeURIComponent("คีย์บอร์ด") +
      "&country=TH&free=true",
  );
  await expect(page.locator("main article")).toHaveCount(1);
  await page.goto("/th/directory/" + fixture.current);
  await expect(page.locator("main")).toContainText("การตรวจองค์กรใช้ได้ถึง");
  await expect(
    page.locator("main a", { hasText: "แหล่งข้อมูล" }),
  ).toHaveAttribute("href", new RegExp("example\\.invalid"));
  expect((await page.request.get("/api/s2/catalog?page=101")).status()).toBe(
    422,
  );
});
test("authenticated bookmark persists and another account sees no bookmark", async () => {
  const p = pages.user;
  await p.goto("/en/directory/" + fixture.current);
  await p
    .getByRole("button", { name: "Save opportunity", exact: true })
    .click();
  await expect(p.locator("main")).toContainText("Saved");
  await p.goto("/en/workspace/bookmarks");
  await expect(p.locator("main article")).toHaveCount(1);
  const other = await pages.publisher.request.get("/api/s2/bookmarks");
  expect((await other.json()).data).toHaveLength(0);
});
test("skippable assessment stays draft without confirmation; confirmed unknown criteria are explained", async () => {
  const p = pages.user,
    t = s2Text.en;
  await p.goto("/en/workspace/assessment");
  await p.getByRole("button", { name: t.save, exact: true }).click();
  await expect(p.locator("main")).toContainText(t.saved);
  await p.goto("/en/workspace/matches");
  await expect(p.locator("main")).toContainText(t.needsConfirmed);
  await p.goto("/en/workspace/assessment");
  await p.getByLabel(t.country, { exact: true }).fill("TH");
  await p.getByLabel(t.confirm, { exact: true }).check();
  await p.getByRole("button", { name: t.save, exact: true }).click();
  await expect(p.locator("main")).toContainText(t.saved);
  await p.goto("/en/workspace/matches");
  await expect(p.locator("main")).toContainText(t.matchUnknown);
  await expect(p.locator("main")).toContainText("Hours per week");
});
test("known answers change deterministic suggestions and direct foreign assessment writes are denied", async () => {
  const p = pages.user,
    t = s2Text.en;
  await p.goto("/en/workspace/assessment");
  await p.getByLabel(t.hours, { exact: true }).fill("8");
  await p
    .getByRole("combobox", { name: t.remotePreference, exact: true })
    .selectOption("true");
  await p.getByLabel(t.confirm, { exact: true }).check();
  await p.getByRole("button", { name: t.save, exact: true }).click();
  await expect(p.locator("main")).toContainText(t.saved);
  await p.goto("/en/workspace/matches");
  await expect(p.locator("main")).toContainText(t.eligible);
  const account = (await (await p.request.get("/api/v1/me")).json()).data;
  const r = await post(pages.publisher, "/api/s2/assessment", {
    subject: account.profile.id,
    data: { goals: ["jobs"] },
    notice: "00000000-0000-4000-8000-000000000102",
    confirmed: true,
    expectedVersion: 3,
  });
  expect(r.status()).toBe(404);
  expect(
    (await pages.publisher.request.get("/api/s2/assessment")).headers()[
      "cache-control"
    ],
  ).toContain("no-store");
});
test("unassured staff cannot enter review; PNG downloads require authorized current session", async ({
  page,
}) => {
  const p = pages.user;
  expect((await p.goto("/en/workspace/review"))?.status()).toBe(404);
  const r = await pages.publisher.request.get(
    `/api/s2/organizations/${fixture.org}/evidence`,
  );
  const rows = (await r.json()).data;
  const id = rows.find((x: { status: string }) => x.status === "clean").id;
  expect((await p.request.get("/api/s2/evidence/" + id)).status()).toBe(404);
  expect((await page.request.get("/api/s2/evidence/" + id)).status()).toBe(401);
  const image = await pages.reviewer.request.get("/api/s2/evidence/" + id);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-disposition"]).toContain("attachment");
  expect(image.headers()["x-content-type-options"]).toBe("nosniff");
  expect(image.headers()["cache-control"]).toContain("no-store");
});
test("publisher can create an organization and quarantined evidence via the real UI", async () => {
  const p = pages.publisher,
    t = s2Text.en;
  await p.goto("/en/workspace/organizations");
  const form = p
    .locator("form")
    .filter({ has: p.getByRole("button", { name: t.create, exact: true }) });
  await form
    .getByLabel(t.name, { exact: true })
    .fill("Synthetic UI " + fixture.run);
  await form.getByRole("button", { name: t.create, exact: true }).click();
  await expect(p.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(p.locator("main")).toContainText("Synthetic UI " + fixture.run);
  const card = p.locator("article").filter({
    has: p.getByRole("heading", {
      name: "Synthetic UI " + fixture.run,
      exact: true,
    }),
  });
  await card
    .getByLabel(t.evidence, { exact: true })
    .setInputFiles("public/brand-defaults/favicon.png");
  const uploaded = p.waitForResponse(
    (r) =>
      new URL(r.url()).pathname.startsWith("/api/s2/evidence/") &&
      r.request().method() === "POST",
  );
  await card.getByRole("button", { name: t.upload, exact: true }).click();
  expect((await uploaded).status()).toBe(200);
  await expect(p.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(card).toContainText(t.quarantined);
});
test("CSRF, unsafe MIME and guessed organization IDs fail before a mutation", async () => {
  const p = pages.publisher;
  const before = (await (await p.request.get("/api/s2/organizations")).json())
    .data;
  const csrf = await p.request.post(
    `/api/s2/organizations/${fixture.org}/intent`,
    { headers: { Origin: "https://example.invalid" }, data: {} },
  );
  expect(csrf.status()).toBe(403);
  const fake = await post(
    p,
    "/api/s2/organizations/00000000-0000-4000-8000-000000000000/intent",
    {},
  );
  expect(fake.status()).toBe(404);
  const intent = await post(
      p,
      `/api/s2/organizations/${fixture.org}/intent`,
      {},
    ),
    id = (await intent.json()).data;
  const upload = await p.request.post("/api/s2/evidence/" + id, {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: "unsafe.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg onload="alert(1)"/>'),
      },
    },
  });
  expect(upload.status()).toBe(422);
  expect(
    (await (await p.request.get("/api/s2/organizations")).json()).data,
  ).toHaveLength(before.length);
});
test("bilingual listing editor accepts bounded Thai text and independent UI review publishes it", async () => {
  const p = pages.publisher,
    t = s2Text.en,
    title = "UI catalog " + fixture.run;
  await p.goto("/en/workspace/catalog");
  const form = p.locator("form").filter({
    has: p.getByRole("heading", { name: t.newListing, exact: true }),
  });
  await form.getByLabel(t.titleTh, { exact: true }).fill(title);
  await form.getByLabel(t.titleEn, { exact: true }).fill(title);
  await form
    .getByLabel(t.descriptionTh, { exact: true })
    .fill("ก".repeat(2000));
  await form
    .getByLabel(t.descriptionEn, { exact: true })
    .fill("a".repeat(2000));
  await form.getByLabel(t.accessTh, { exact: true }).fill("คีย์บอร์ด");
  await form.getByLabel(t.accessEn, { exact: true }).fill("Keyboard");
  await form
    .getByLabel(t.validUntil, { exact: true })
    .fill(new Date(Date.now() + 86400000 * 20).toISOString().slice(0, 10));
  await form
    .getByLabel(t.source, { exact: true })
    .fill("https://example.invalid/ui-catalog");
  await form.getByRole("button", { name: t.save, exact: true }).click();
  await expect(p.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  const row = p
    .locator("article")
    .filter({ has: p.getByRole("heading", { name: title, exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: t.submit, exact: true }).click();
  await expect(p.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(row).toContainText(t.in_review);
  const reviewer = pages.reviewer;
  await reviewer.goto("/en/workspace/review");
  const review = reviewer.locator("article").filter({
    has: reviewer.getByRole("heading", { name: title, exact: true }),
  });
  await review
    .getByLabel(t.reason, { exact: true })
    .fill("Synthetic independent browser review");
  const published = reviewer.waitForResponse(
    (r) =>
      new URL(r.url()).pathname.endsWith("/review") &&
      r.request().method() === "POST",
  );
  await review.getByRole("button", { name: t.save, exact: true }).click();
  expect((await published).status()).toBe(200);
  await expect(reviewer.locator(".activity-spinner")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(review).toContainText(t.published, { timeout: 15000 });
  const result = await p.request.get(
    "/api/s2/catalog?q=" + encodeURIComponent(title),
  );
  expect((await result.json()).data.items).toHaveLength(1);
});
test("two windows preserve an assessment draft and reject stale saves", async ({
  browser,
}) => {
  const p = pages.user,
    c = await browser.newContext({
      storageState: await p.context().storageState(),
    }),
    other = await c.newPage();
  contexts.push(c);
  await other.goto("/en/workspace/assessment");
  await other.getByLabel(s2Text.en.country, { exact: true }).fill("US");
  const own = (await (await p.request.get("/api/v1/me")).json()).data,
    current = (await (await p.request.get("/api/s2/assessment")).json()).data;
  const r = await post(p, "/api/s2/assessment", {
    subject: own.profile.id,
    data: {
      goals: ["skills"],
      country_code: "TH",
      remote_ok: true,
      available_hours_week: 10,
    },
    notice: "00000000-0000-4000-8000-000000000102",
    confirmed: true,
    expectedVersion: current.version,
  });
  expect(r.status()).toBe(200);
  await expect(
    other.getByText("Updates are waiting until your form is saved or closed.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 25000 });
  await expect(
    other.getByLabel(s2Text.en.country, { exact: true }),
  ).toHaveValue("US");
  await other
    .getByRole("button", { name: s2Text.en.save, exact: true })
    .click();
  await expect(other.locator("main")).toContainText(s2Text.en.conflict);
  await expect(
    other.getByLabel(s2Text.en.country, { exact: true }),
  ).toHaveValue("US");
  expect(
    (await (await p.request.get("/api/s2/assessment")).json()).data
      .country_code,
  ).toBe("TH");
});
for (const lang of ["th", "en"] as const)
  test(`${lang}: public and role-specific S2 pages pass axe, keyboard and mobile reflow`, async ({
    page,
  }) => {
    const targets: [Page, string][] = [
      [page, ""],
      [page, "/opportunities?q=" + fixture.run],
      [page, "/directory/" + fixture.current],
      [pages.user, "/workspace"],
      [pages.user, "/workspace/assessment"],
      [pages.user, "/workspace/bookmarks"],
      [pages.user, "/workspace/matches"],
      [pages.publisher, "/workspace/organizations"],
      [pages.publisher, "/workspace/catalog"],
      [pages.reviewer, "/workspace/review"],
    ];
    for (const [p, path] of targets) {
      await p.setViewportSize({ width: 1280, height: 900 });
      await p.goto("/" + lang + path);
      await expect(p.locator("main h1")).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page: p })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await p.keyboard.press("Tab");
      await p.keyboard.press("Enter");
      await p.setViewportSize({ width: 320, height: 850 });
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await p.setViewportSize({ width: 1280, height: 900 });
    }
  });

test("a public catalog pause updates an already open bookmark window", async () => {
  expect(
    (
      await post(pages.user, "/api/s2/bookmarks/" + fixture.current, {
        saved: true,
      })
    ).status(),
  ).toBe(200);
  const p = pages.user,
    initial = p.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/live" && r.status() === 200,
    );
  await p.goto("/en/workspace/bookmarks");
  await initial;
  const rows = (
    await (
      await pages.reviewer.request.get(
        "/api/s2/listings?review=true&org=" + fixture.org,
      )
    ).json()
  ).data;
  const row = rows.find((x: { id: string }) => x.id === fixture.current);
  const r = await post(
    pages.reviewer,
    "/api/s2/listings/" + fixture.current + "/review",
    {
      action: "pause",
      reason: "Synthetic live pause",
      expectedVersion: row.version,
    },
  );
  expect(r.status()).toBe(200);
  await expect(p.locator("main")).toContainText(s2Text.en.unavailable, {
    timeout: 20000,
  });
});
