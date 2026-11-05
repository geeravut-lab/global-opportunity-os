import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { syntheticTotp } from "../../scripts/validation-runtime";
import { s3Copy, s3Label } from "../../lib/s3/copy";
const f = JSON.parse(readFileSync(".local/s3-fixtures.json", "utf8")) as {
  run: string;
  org: string;
  subjects: Record<string, string>;
  members: Record<string, string>;
  listings: Record<string, string>;
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
const contexts: BrowserContext[] = [],
  pages: Record<string, Page> = {},
  origin = "http://127.0.0.1:3300";
let application = "",
  caseId = "";
const t = s3Copy.en;
const post = (p: Page, path: string, data: unknown) =>
  p.request.post("/api/s3/" + path, { headers: { Origin: origin }, data });
const busyDone = (p: Page) =>
  expect(p.locator(".activity-spinner")).toHaveCount(0, { timeout: 20000 });
async function detail(p = pages.user) {
  const r = await p.request.get("/api/s3/applications/" + application);
  expect(r.status()).toBe(200);
  return (await r.json()).data;
}
test.beforeAll(async ({ browser }) => {
  for (const name of [
    "user",
    "publisher",
    "worker",
    "replacement",
    "reviewer",
  ]) {
    const c = await browser.newContext();
    contexts.push(c);
    const p = await c.newPage();
    pages[name] = p;
    p.setDefaultTimeout(15000);
    const a = f.actors[name];
    await p.goto("/en/auth/login");
    await p.locator("#auth-email").fill(a.email);
    await p.locator("#auth-password").fill(a.password);
    await p.locator("form button[type=submit]").click();
    await expect(p).toHaveURL(/\/en\/account$/, { timeout: 20000 });
    if (a.factorId) {
      const r = await p.request.post("/api/auth/mfa-verify", {
        headers: { Origin: origin },
        data: { factorId: a.factorId, code: syntheticTotp(a.totp!) },
      });
      expect(r.status()).toBe(200);
    }
  }
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});
test("anonymous users cannot read workflow data and the public directory links to review-before-submit", async ({
  page,
}) => {
  await page.goto("/en/workflow");
  await expect(page).toHaveURL(/\/en\/auth\/login/);
  expect((await page.request.get("/api/s3/applications")).status()).toBe(401);
  await page.goto("/en/directory/" + f.listings.unlimited);
  await expect(
    page.getByRole("link", { name: "Prepare and review a request" }),
  ).toHaveAttribute("href", "/en/workflow/apply/" + f.listings.unlimited);
});
test("a slow user API shows a spinner, suppresses duplicate submission and clears on error", async ({
  page,
}) => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => (finish = resolve));
  let requests = 0;
  await page.route("**/api/auth/login", async (route) => {
    requests++;
    await gate;
    await route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
    });
  });
  await page.goto("/en/auth/login");
  await page.locator("#auth-email").fill("loading-fixture@example.test");
  await page.locator("#auth-password").fill("Synthetic-wrong-password-2026");
  await page.locator("form button[type=submit]").click();
  await expect(page.locator(".activity-indicator")).toBeVisible();
  await page
    .locator("form button[type=submit]")
    .evaluate((button: HTMLButtonElement) => button.click());
  expect(requests).toBe(1);
  finish();
  await busyDone(page);
  await expect(page.locator("#auth-feedback")).not.toBeEmpty();
  await expect(page.locator("form button[type=submit]")).toBeEnabled();
});
test("Next navigation and a native GET filter both show a spinner until their delayed document/data arrives", async ({
  page,
}) => {
  const p = pages.user;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await p.route("**/en/workflow/applications**", async (route) => {
    await gate;
    await route.continue();
  });
  await p.goto("/en/workflow");
  const nav = p.locator(
    'main .home-menu-grid a[href="/en/workflow/applications"]',
  );
  await nav.click({ noWaitAfter: true });
  await expect(p.locator(".activity-spinner").first()).toBeVisible();
  release();
  await expect(p).toHaveURL(/\/en\/workflow\/applications$/, {
    timeout: 20000,
  });
  await expect(p.locator("main h1")).toHaveText(t.applications);
  await busyDone(p);
  await p.unroute("**/en/workflow/applications**");
  let filterDone!: () => void;
  const filterGate = new Promise<void>((resolve) => (filterDone = resolve));
  await page.goto("/th/opportunities");
  await page.route("**/th/opportunities?q=spinner-filter*", async (route) => {
    await filterGate;
    await route.continue();
  });
  await page.getByLabel("คำค้น", { exact: true }).fill("spinner-filter");
  await page
    .locator("main form button[type=submit]")
    .click({ noWaitAfter: true });
  await expect(page.locator(".activity-indicator")).toBeVisible();
  filterDone();
  await page.waitForURL(/q=spinner-filter/);
  await busyDone(page);
});
test("beneficiary creates an exact-field preview and explicitly confirms one real local application", async () => {
  const p = pages.user;
  await p.goto("/en/workflow/apply/" + f.listings.unlimited);
  await p.getByRole("button", { name: t.preview, exact: true }).click();
  const preview = p.locator(".workflow-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Synthetic user");
  await expect(
    preview.getByLabel(t.confirm, { exact: true }),
  ).not.toBeChecked();
  await preview.getByLabel(t.confirm, { exact: true }).check();
  const sent = p.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/s3/applications" &&
      r.request().method() === "POST",
  );
  await preview.getByRole("button", { name: t.submit, exact: true }).click();
  const r = await sent;
  expect(r.status()).toBe(201);
  const receipt = (await r.json()).data;
  application = receipt.id;
  caseId = receipt.case_id;
  await expect(p).toHaveURL("/en/workflow/application/" + application);
  await busyDone(p);
  const d = await detail();
  expect(Object.keys(d.package.values).sort()).toEqual([
    "country_code",
    "display_alias",
  ]);
  expect(d.state).toBe("submitted");
});
async function queueRow() {
  const p = pages.publisher;
  await p.goto("/en/workflow/queue?org=" + f.org);
  const orgResponse = await p.request.get("/api/s3/organizations");
  const orgData = (await orgResponse.json()).data;
  expect(orgData.find((o: { id: string }) => o.id === f.org)?.can_assign).toBe(
    true,
  );
  await expect(p.locator("main h1")).toHaveText(t.queue);
  await expect(p.locator("article.panel")).toHaveCount(1);
  return p.locator("article.panel").filter({
    has: p.getByRole("heading", {
      name: "Synthetic unlimited " + f.run,
      exact: true,
    }),
  });
}
async function routeTo(member: string) {
  const row = await queueRow(),
    p = pages.publisher;
  await row.getByLabel(t.member, { exact: true }).selectOption(member);
  const updated = p.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/s3/cases/" + caseId + "/assign" &&
      r.request().method() === "POST",
  );
  await row.getByRole("button", { name: t.assign, exact: true }).click();
  expect((await updated).status()).toBe(200);
  await busyDone(p);
}
test("supervisor routes metadata only and assigned staff write internal/shared notes with correct visibility", async () => {
  await routeTo(f.members.worker);
  expect(
    (
      await pages.publisher.request.get("/api/s3/applications/" + application)
    ).status(),
  ).toBe(404);
  const worker = pages.worker;
  await worker.goto("/en/workflow/application/" + application);
  const note = worker.locator("form").filter({
    has: worker.getByRole("heading", { name: t.notes, exact: true }),
  });
  await note.getByLabel(t.visibility, { exact: true }).selectOption("internal");
  await note
    .getByLabel(t.noteBody, { exact: true })
    .fill("Synthetic internal staff-only note");
  await note.getByRole("button", { name: t.save, exact: true }).click();
  await busyDone(worker);
  expect((await detail()).notes).toHaveLength(0);
  await note
    .getByLabel(t.visibility, { exact: true })
    .selectOption("beneficiary_shared");
  await note
    .getByLabel(t.noteBody, { exact: true })
    .fill("Synthetic shared next step");
  await note.getByRole("button", { name: t.save, exact: true }).click();
  await busyDone(worker);
  await expect(pages.user.locator("main")).toContainText(
    "Synthetic shared next step",
    { timeout: 20000 },
  );
  await expect(pages.user.locator("main")).not.toContainText(
    "Synthetic internal staff-only note",
  );
});
test("reassignment removes a dirty staff view and its still-valid session cannot access the package", async () => {
  const p = pages.worker;
  await p
    .getByLabel(t.noteBody, { exact: true })
    .fill("Unsaved draft after access change");
  await routeTo(f.members.replacement);
  await expect(p).toHaveURL(/\/en\/workflow\/applications$/, {
    timeout: 20000,
  });
  expect(
    (await p.request.get("/api/s3/applications/" + application)).status(),
  ).toBe(404);
  await pages.replacement.goto("/en/workflow/application/" + application);
  await expect(pages.replacement.locator("main")).toContainText(
    "Synthetic shared next step",
  );
  await routeTo(f.members.worker);
  await p.goto("/en/workflow/application/" + application);
});
async function appStep(action: string) {
  const p = pages.worker,
    form = p
      .locator("form")
      .filter({ has: p.getByRole("heading", { name: t.action, exact: true }) });
  await form.getByLabel(t.action, { exact: true }).selectOption(action);
  await form.getByLabel(t.acknowledge, { exact: true }).check();
  const r = p.waitForResponse(
    (r) =>
      new URL(r.url()).pathname ===
      "/api/s3/applications/" + application + "/transition",
  );
  await form.getByRole("button", { name: t.change, exact: true }).click();
  expect((await r).status()).toBe(200);
  await busyDone(p);
}
test("human service workflow progresses through triage/start/resolve/complete and supervisor closure via the queue", async () => {
  const p = pages.worker;
  await appStep("start_review");
  await appStep("accept");
  for (const action of ["triage", "start", "resolve"]) {
    const form = p.locator("form").filter({
      has: p.getByRole("heading", { name: t.caseAction, exact: true }),
    });
    await form.getByLabel(t.caseAction, { exact: true }).selectOption(action);
    if (action === "resolve")
      await form
        .getByLabel(t.resolution, { exact: true })
        .selectOption("service_recorded");
    const sent = p.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/s3/cases/" + caseId + "/transition",
    );
    await form.getByRole("button", { name: t.save, exact: true }).click();
    expect((await sent).status()).toBe(200);
    await busyDone(p);
  }
  await appStep("complete");
  expect((await detail()).state).toBe("completed");
  const row = await queueRow();
  await row
    .getByRole("button", { name: s3Label("en", "close"), exact: true })
    .click();
  await busyDone(pages.publisher);
  expect((await detail()).case.state).toBe("closed");
});
test("notification settings preserve a second-window draft and reject a stale version", async ({
  browser,
}) => {
  const p = pages.user;
  await p.goto("/en/workflow/settings");
  await p.getByLabel(t.inApp, { exact: true }).uncheck();
  const c = await browser.newContext({
    storageState: await p.context().storageState(),
  });
  contexts.push(c);
  const other = await c.newPage();
  await other.goto("/en/workflow/settings");
  const initial = (
    await (await other.request.get("/api/s3/preferences")).json()
  ).data;
  expect(
    (
      await post(other, "preferences", {
        inApp: false,
        email: false,
        timezone: "Asia/Bangkok",
        version: initial.version,
      })
    ).status(),
  ).toBe(200);
  await expect(p.getByLabel(t.inApp, { exact: true })).not.toBeChecked();
  const saved = p.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/s3/preferences" &&
      r.request().method() === "POST",
  );
  await p
    .locator("form")
    .filter({ has: p.getByRole("heading", { name: t.settings, exact: true }) })
    .getByRole("button", { name: t.save, exact: true })
    .click();
  expect((await saved).status()).toBe(409);
  await expect(p.locator("main")).toContainText(t.conflict);
  await p.getByRole("button", { name: t.reload, exact: true }).click();
  await busyDone(p);
});
for (const lang of ["th", "en"] as const)
  test(
    lang +
      ": workflow views, shared typography and mobile/desktop accessibility",
    async ({ page }) => {
      test.setTimeout(180000);
      if (!application) {
        const rows = (
          await (await pages.user.request.get("/api/s3/applications")).json()
        ).data;
        application = rows.find(
          (r: { can_progress: boolean }) => r.can_progress,
        )?.id;
        expect(application).toBeTruthy();
      }
      const publicFonts: string[] = [];
      page.on("request", (request) => {
        if (/\.woff2?(\?|$)/.test(request.url()))
          publicFonts.push(request.url());
      });
      const targets: [Page, string][] = [
        [page, ""],
        [page, "/opportunities?q=" + f.run],
        [page, "/demo/partner"],
        [page, "/demo/admin"],
        [pages.user, "/workflow"],
        [pages.user, "/workflow/applications"],
        [pages.user, "/workflow/application/" + application],
        [pages.user, "/workflow/settings"],
        [pages.user, "/workflow/apply/" + f.listings.unlimited],
        [pages.publisher, "/workflow/queue?org=" + f.org],
        [pages.publisher, "/workflow/team?org=" + f.org],
        [pages.publisher, "/workflow/automation?org=" + f.org],
        [pages.reviewer, "/workflow/delivery"],
      ];
      for (const [p, path] of targets) {
        await p.setViewportSize({ width: 1280, height: 900 });
        await p.goto("/" + lang + path);
        await p.evaluate(() => document.fonts.ready);
        await busyDone(p);
        await expect(p.locator("main h1")).toBeVisible();
        expect(
          (
            await new AxeBuilder({ page: p })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        const sizes = await p.evaluate(() => ({
          body: parseFloat(getComputedStyle(document.body).fontSize),
          h1: parseFloat(
            getComputedStyle(document.querySelector("main h1")!).fontSize,
          ),
          controls: [
            ...document.querySelectorAll(
              "main input:not([type=checkbox]),main select,main textarea,main .button",
            ),
          ]
            .filter((e) => e.getBoundingClientRect().width > 0)
            .map((e) => parseFloat(getComputedStyle(e).fontSize)),
        }));
        expect(sizes.body).toBeGreaterThanOrEqual(16);
        expect(sizes.h1).toBeGreaterThanOrEqual(24);
        expect(
          sizes.controls.every((n) => n >= 16),
          JSON.stringify({ lang, path, sizes }),
        ).toBe(true);
        for (const width of [390, 320]) {
          await p.setViewportSize({ width, height: 844 });
          expect(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${lang}${path} at ${width}px`,
          ).toBe(true);
        }
        await p.keyboard.press("Tab");
        await p.keyboard.press("Enter");
        await p.setViewportSize({ width: 1280, height: 900 });
      }
      expect(publicFonts.every((url) => url.startsWith(origin + "/"))).toBe(
        true,
      );
      await page.goto("/" + lang);
      expect(
        await page.evaluate(() =>
          document.fonts.check('16px "Noto Sans Thai Variable"', "โอกาส"),
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() =>
          document.fonts.check('16px "Geist Variable"', "Opportunity 123"),
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: ".local/s3-public-" + lang + "-mobile.png",
        fullPage: true,
      });
      chmodSync(".local/s3-public-" + lang + "-mobile.png", 0o600);
    },
  );
test("typed automation preview and generic inbox do not expose case or package data", async () => {
  const p = pages.publisher;
  await p.goto("/en/workflow/automation?org=" + f.org);
  const form = p
    .locator("form")
    .filter({ has: p.getByRole("heading", { name: t.newRule, exact: true }) });
  await form.getByLabel(t.minutes, { exact: true }).fill("15");
  await form.getByRole("button", { name: t.save, exact: true }).click();
  await busyDone(p);
  await p.getByRole("button", { name: t.dryRun, exact: true }).click();
  await expect(p.locator("main")).toContainText(t.writes + ": 0");
  execFileSync(
    process.execPath,
    ["scripts/s3-worker.mjs", "--org", f.org, "--origin", origin],
    { stdio: "pipe", timeout: 30000 },
  );
  await pages.user.goto("/en/workflow/settings");
  await expect(pages.user.locator("main")).not.toContainText(
    "Synthetic internal staff-only note",
  );
});
test("withdraw future sharing on a completed application keeps its historical state and denies further recipient reads", async () => {
  const p = pages.user;
  await p.goto("/en/workflow/application/" + application);
  const form = p
    .locator("form")
    .filter({ has: p.getByRole("heading", { name: t.action, exact: true }) });
  await form.getByLabel(t.action, { exact: true }).selectOption("revoke_share");
  await form.getByLabel(t.acknowledge, { exact: true }).check();
  await form.getByRole("button", { name: t.change, exact: true }).click();
  await busyDone(p);
  expect((await detail()).state).toBe("completed");
  expect(
    (
      await pages.worker.request.get("/api/s3/applications/" + application)
    ).status(),
  ).toBe(404);
});
