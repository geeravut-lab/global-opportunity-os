import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import pg from "pg";
import { syntheticTotp } from "../../scripts/validation-runtime";
import { localRuntime } from "../../scripts/local-runtime";
const f = JSON.parse(readFileSync(".local/s4-fixtures.json", "utf8")) as {
  sourceCase: string;
  sourceApplication: string;
  targetListing: string;
  targetOrg: string;
  targetMembers: Record<string, string>;
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
const origin = "http://127.0.0.1:3400",
  pages: Record<string, Page> = {},
  contexts: BrowserContext[] = [];
let referral = "",
  destinationCase = "",
  outcome = "";
const post = (p: Page, path: string, data: unknown) =>
  p.request.post("/api/s4/" + path, { headers: { Origin: origin }, data });
async function detail(p: Page, kind: string, id: string) {
  const r = await p.request.get("/api/s4/" + kind + "/" + id);
  expect(r.status()).toBe(200);
  return (await r.json()).data;
}
const done = (p: Page) =>
  expect(p.locator(".activity-spinner")).toHaveCount(0, { timeout: 20000 });
async function metadata(query: string, values: unknown[] = []) {
  const c = new pg.Client({ connectionString: localRuntime().dbUrl });
  await c.connect();
  try {
    return (await c.query(query, values)).rows;
  } finally {
    await c.end();
  }
}
test.beforeAll(async ({ browser }) => {
  for (const name of [
    "user",
    "outsider",
    "replacement",
    "reviewer",
    "impact",
    "privacy",
    "safety",
  ]) {
    const c = await browser.newContext({ timezoneId: "Asia/Bangkok" });
    contexts.push(c);
    const p = await c.newPage();
    pages[name] = p;
    p.setDefaultTimeout(20000);
    const a = f.actors[name];
    await p.goto("/en/auth/login");
    await p.locator("#auth-email").fill(a.email);
    await p.locator("#auth-password").fill(a.password);
    await p.locator("form button[type=submit]").click();
    await expect(p).toHaveURL(/\/en\/account$/, { timeout: 25000 });
    await done(p);
    if (a.factorId) {
      const r = await p.request.post("/api/auth/mfa-verify", {
        headers: { Origin: origin },
        data: { factorId: a.factorId, code: syntheticTotp(a.totp!) },
      });
      expect(r.status()).toBe(200);
    }
    await p.goto("about:blank");
  }
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});
test("private pages require login; anonymous reporting returns only a receipt/status and blocks CSRF", async ({
  page,
}) => {
  await page.goto("/en/coordination");
  await expect(page).toHaveURL(/\/en\/auth\/login/);
  expect((await page.request.get("/api/s4/referrals")).status()).toBe(401);
  await page.goto("/en/report");
  const form = page.getByRole("form", { name: "Report an issue", exact: true });
  await form
    .getByLabel("Details", { exact: true })
    .fill("Synthetic anonymous browser concern");
  await form.getByRole("button", { name: "Submit request" }).click();
  await done(page);
  await expect(
    page.getByRole("heading", { name: "Save your tracking receipt" }),
  ).toBeVisible();
  const id = await page
      .getByLabel("Report number", { exact: true })
      .first()
      .inputValue(),
    receipt = await page
      .getByLabel("Private tracking key", { exact: true })
      .first()
      .inputValue();
  expect(receipt).toMatch(/^[a-f0-9]{64}$/);
  const status = await post(page, "guest", {
    operation: "status",
    kind: null,
    body: null,
    id,
    receipt,
  });
  expect(status.status()).toBe(200);
  expect(Object.keys((await status.json()).data).sort()).toEqual([
    "created_at",
    "id",
    "kind",
    "state",
  ]);
  expect(status.headers()["cache-control"]).toContain("no-store");
  const wrong = await post(page, "guest", {
    operation: "status",
    kind: null,
    body: null,
    id,
    receipt: "0".repeat(64),
  });
  expect(wrong.status()).toBe(404);
  const csrf = await page.request.post("/api/s4/guest", {
    headers: { Origin: "https://other.example.test" },
    data: {
      operation: "create",
      kind: "safety",
      body: "Synthetic CSRF",
      id: null,
      receipt: null,
    },
  });
  expect(csrf.status()).toBe(403);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => /report|receipt/i.test(k)),
    ),
  ).toBe(false);
});
test("beneficiary reviews exact fields and destination accepts a single coordination case; two windows live sync", async () => {
  const user = pages.user;
  await user.goto("/en/coordination/referrals");
  const form = user.getByRole("form", {
    name: "Propose a referral",
    exact: true,
  });
  await form.locator("select[name=case]").selectOption(f.sourceCase);
  await form.locator("select[name=opportunity]").selectOption(f.targetListing);
  await form
    .getByRole("button", { name: "Propose a referral", exact: true })
    .click();
  await expect(user).toHaveURL(/\/coordination\/referrals\/[a-f0-9-]{36}$/, {
    timeout: 20000,
  });
  referral = user.url().split("/").at(-1)!;
  await done(user);
  const review = user.getByRole("form", {
    name: "Review before sharing",
    exact: true,
  });
  await review.locator("input[value=display_alias]").check();
  await review.locator("input[value=country_code]").check();
  await review
    .getByRole("button", { name: "Review before sharing", exact: true })
    .click();
  await done(user);
  await expect(
    user.getByRole("form", { name: "Submit request", exact: true }),
  ).toBeVisible();
  const confirm = user.getByRole("form", {
    name: "Submit request",
    exact: true,
  });
  await confirm.getByRole("checkbox").check();
  await confirm
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await done(user);
  await expect(
    user.getByText("Awaiting destination response", { exact: true }),
  ).toBeVisible();
  const manager = pages.outsider;
  await manager.goto("/en/coordination/referrals");
  const accept = manager.getByRole("form", {
    name: "Accept case coordination",
    exact: true,
  });
  await accept
    .getByLabel("Assigned caseworker")
    .selectOption(f.targetMembers.replacement);
  await accept
    .getByRole("button", { name: "Accept case coordination", exact: true })
    .click();
  await done(manager);
  await expect(
    user.getByText("Coordination accepted", { exact: true }),
  ).toBeVisible({ timeout: 25000 });
  destinationCase = (await detail(user, "referrals", referral)).case.id;
  await pages.replacement.goto("/en/coordination/referrals/" + referral);
  await expect(
    pages.replacement.getByRole("form", { name: "Add note", exact: true }),
  ).toBeVisible();
});
test("internal destination notes remain private, and a revoked member loses a dirty page without refresh", async () => {
  const p = pages.replacement;
  const form = p.getByRole("form", { name: "Add note", exact: true });
  await form
    .getByLabel("Details", { exact: true })
    .fill("S4 UI INTERNAL CANARY");
  await form.getByLabel("Note visibility").selectOption("internal");
  await form.getByRole("button", { name: "Add note", exact: true }).click();
  await done(p);
  await expect(
    p.getByText("S4 UI INTERNAL CANARY", { exact: true }),
  ).toBeVisible();
  expect(
    JSON.stringify(await detail(pages.user, "referrals", referral)),
  ).not.toContain("S4 UI INTERNAL CANARY");
  await form
    .getByLabel("Details", { exact: true })
    .fill("Synthetic unsaved draft");
  await metadata(
    "update app.org_memberships set status='revoked' where id=$1",
    [f.targetMembers.replacement],
  );
  try {
    await expect(p).toHaveURL(/\/en\/coordination$/, { timeout: 25000 });
    expect(
      (await p.request.get("/api/s4/referrals/" + referral)).status(),
    ).toBe(404);
    await expect(
      p.getByText("S4 UI INTERNAL CANARY", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await metadata(
      "update app.org_memberships set status='active' where id=$1",
      [f.targetMembers.replacement],
    );
  }
});
test("outcome evidence stays quarantined until the real restricted inspector; independent review then user dispute", async () => {
  const provider = pages.replacement;
  await provider.goto("/en/coordination/outcomes");
  const form = provider.getByRole("form", {
    name: "Report an outcome",
    exact: true,
  });
  await form.getByLabel("Case", { exact: true }).selectOption(destinationCase);
  await form.locator("select[name=kind]").selectOption("service_delivered");
  await form.getByLabel("Service period start").fill("2026-11-01");
  await form.getByLabel("Service period end").fill("2026-11-03");
  await form.getByLabel("Outcome time").fill("2026-11-03T15:00");
  await form
    .getByLabel("Details", { exact: true })
    .fill("Synthetic browser service delivery");
  await form
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(provider).toHaveURL(/\/coordination\/outcomes\/[a-f0-9-]{36}$/, {
    timeout: 20000,
  });
  outcome = provider.url().split("/").at(-1)!;
  await done(provider);
  const upload = provider.getByRole("form", {
    name: "Upload for inspection",
    exact: true,
  });
  await upload.locator("input[type=file]").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  });
  await upload
    .getByRole("button", { name: "Upload for inspection", exact: true })
    .click();
  await done(provider);
  await expect(
    provider.getByText("Quarantined; download unavailable", { exact: true }),
  ).toBeVisible();
  execFileSync(process.execPath, ["scripts/process-s4-evidence.mjs"], {
    stdio: "pipe",
    timeout: 30000,
  });
  await expect(
    provider.getByRole("link", {
      name: "Download inspected evidence",
      exact: true,
    }),
  ).toBeVisible({ timeout: 25000 });
  await pages.user.goto("/en/coordination/outcomes/" + outcome);
  await pages.user
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  await done(pages.user);
  const row = (await detail(pages.user, "outcomes", outcome)).row;
  const assigned = await post(
    pages.reviewer,
    "outcomes/" + outcome + "/assign",
    {
      account: f.actors.impact.id,
      expires: new Date(Date.now() + 86400000).toISOString(),
      version: row.version,
    },
  );
  expect(assigned.status()).toBe(200);
  await pages.impact.goto("/en/coordination/outcomes/" + outcome);
  const verify = pages.impact.getByRole("form", {
    name: "Verify reviewed evidence",
    exact: true,
  });
  await verify
    .getByRole("button", { name: "Verify reviewed evidence", exact: true })
    .click();
  await done(pages.impact);
  await expect(
    pages.user.getByText("Verified · Independently reviewed evidence", {
      exact: true,
    }),
  ).toBeVisible({
    timeout: 25000,
  });
  await pages.user
    .getByRole("button", { name: "Dispute outcome", exact: true })
    .click();
  await done(pages.user);
  await expect(
    pages.user.getByText(/^Disputed; excluded from verified outcomes ·/),
  ).toBeVisible();
});
test("privacy export requires assigned identity review and exports only owned/shared records with no-store", async () => {
  const p = pages.user;
  await p.goto("/en/coordination/privacy");
  const form = p.getByRole("form", {
    name: "Request privacy rights",
    exact: true,
  });
  await form.getByLabel("Type", { exact: true }).selectOption("export");
  await form
    .getByLabel("Details", { exact: true })
    .fill("Synthetic browser export request");
  await form.getByRole("checkbox").check();
  await form
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(p).toHaveURL(/\/coordination\/privacy\/[a-f0-9-]{36}$/, {
    timeout: 20000,
  });
  const id = p.url().split("/").at(-1)!;
  await done(p);
  expect(
    (await p.request.get("/api/s4/privacy/" + id + "/export")).status(),
  ).toBe(404);
  let row = (await detail(p, "privacy", id)).row;
  expect(
    (
      await post(pages.reviewer, "privacy/" + id + "/assign", {
        account: f.actors.privacy.id,
        expires: new Date(Date.now() + 86400000).toISOString(),
        version: row.version,
      })
    ).status(),
  ).toBe(200);
  for (const action of ["verify_identity", "approve"]) {
    row = (await detail(pages.privacy, "privacy", id)).row;
    expect(
      (
        await post(pages.privacy, "privacy/" + id + "/action", {
          action,
          version: row.version,
          reason:
            action === "verify_identity"
              ? "authenticated_session_review"
              : null,
        })
      ).status(),
    ).toBe(200);
  }
  await expect(
    p.getByRole("link", { name: "Download my data", exact: true }),
  ).toBeVisible({ timeout: 25000 });
  const response = await p.request.get("/api/s4/privacy/" + id + "/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const json = await response.json();
  expect(json.assessment).toBeDefined();
  expect(JSON.stringify(json)).not.toContain("S4 UI INTERNAL CANARY");
  expect(
    (
      await pages.privacy.request.get("/api/s4/privacy/" + id + "/export")
    ).status(),
  ).toBe(404);
  const download = p.waitForEvent("download");
  await p.getByRole("link", { name: "Download my data", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("opp4all-data.json");
  await done(p);
});
test("slow submissions show a spinner, prevent double clicks and recover on failure", async ({
  page,
}) => {
  await page.goto("/en/report");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let count = 0;
  await page.route("**/api/s4/guest", async (route) => {
    count++;
    await gate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
    });
  });
  const form = page.getByRole("form", { name: "Report an issue", exact: true });
  await form
    .getByLabel("Details", { exact: true })
    .fill("Synthetic delayed report");
  const submit = form.getByRole("button", {
    name: "Submit request",
    exact: true,
  });
  await submit.click();
  await expect(page.locator(".activity-spinner")).toBeVisible();
  await expect(submit).toBeDisabled();
  await submit.dispatchEvent("click");
  expect(count).toBe(1);
  release();
  await expect(page.locator("#main").getByRole("alert")).toContainText(
    "Unable to complete",
  );
  await done(page);
  await expect(submit).toBeEnabled();
});
test("Thai/English core screens pass axe and fit a narrow smartphone; bottom navigation remains available", async ({
  page,
}) => {
  for (const url of ["/th/report", "/en/report"]) {
    await page.goto(url);
    await page.setViewportSize({ width: 360, height: 800 });
    const a = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(a.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const p = pages.user;
  await p.setViewportSize({ width: 360, height: 800 });
  for (const url of [
    "/th/coordination",
    "/th/coordination/referrals/" + referral,
    "/en/coordination/outcomes/" + outcome,
    "/th/coordination/privacy",
    "/en/coordination/reports",
  ]) {
    await p.goto(url);
    const a = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(a.violations).toEqual([]);
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(p.locator(".mobile-bottom-nav")).toBeVisible();
});
test("closing the DB release gate removes a protected dirty page without a manual refresh", async () => {
  const p = pages.replacement;
  await p.goto("/en/coordination/referrals/" + referral);
  await expect(
    p.getByText("S4 UI INTERNAL CANARY", { exact: true }),
  ).toBeVisible();
  const note = p.getByRole("form", { name: "Add note", exact: true });
  await note
    .getByLabel("Details", { exact: true })
    .fill("Synthetic unsaved gate-check draft");
  await metadata("update private.s4_release set enabled=false where singleton");
  try {
    await expect(p).toHaveURL(/\/en\/coordination$/, { timeout: 25000 });
    await expect(
      p.getByText("S4 UI INTERNAL CANARY", { exact: true }),
    ).toHaveCount(0);
    const denied = await p.request.get("/api/s4/referrals/" + referral);
    expect(denied.status()).toBe(404);
    const body = await denied.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body).not.toHaveProperty("data");
  } finally {
    await metadata(
      "update private.s4_release set enabled=true where singleton",
    );
  }
});
