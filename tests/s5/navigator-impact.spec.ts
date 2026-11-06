import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { syntheticTotp } from "../../scripts/validation-runtime";
const f = JSON.parse(readFileSync(".local/s5-fixtures.json", "utf8")), origin = "http://127.0.0.1:3400";
const pages: Record<string, Page> = {}, contexts: BrowserContext[] = [];
const post = (p: Page, path: string, data: unknown) => p.request.post(path, { headers: { Origin: origin }, data });
test.beforeAll(async ({ browser }) => {
  for (const name of ["user", "second", "publisher", "reviewer"]) {
    const context = await browser.newContext(); contexts.push(context); const p = await context.newPage(); pages[name] = p; const a = f.actors[name];
    await p.goto("/en/auth/login"); await p.locator("#auth-email").fill(a.email); await p.locator("#auth-password").fill(a.password); await p.locator("form button[type=submit]").click(); await expect(p).toHaveURL(/\/en\/account$/, { timeout: 25000 });
    if (a.factorId) expect((await post(p, "/api/auth/mfa-verify", { factorId: a.factorId, code: syntheticTotp(a.totp) })).ok()).toBe(true);
  }
  expect((await post(pages.reviewer, "/api/impact/admin", { account: f.actors.publisher.id, organization: f.org, grant: true, expires: new Date(Date.now() + 86400000).toISOString() })).ok()).toBe(true);
});
test.afterAll(async () => { for (const c of contexts) await c.close(); });
async function query(p: Page, q: string, country?: string) {
  await p.locator('textarea[name="query"]').fill(q); await p.getByRole("button", { name: "Prepare filters for review", exact: true }).click();
  if (country) await p.locator('input[name="country"]').fill(country);
  await p.locator('input[name="confirmed"]').check(); await p.getByRole("button", { name: "Find sources", exact: true }).click();
  await expect(p.getByRole("heading", { name: "Guidance from reviewed sources", exact: true })).toBeVisible({ timeout: 25000 });
  await expect(p.locator(".activity-spinner")).toHaveCount(0);
}
test("Navigator reviews editable filters, shows source provenance and spinner while preventing duplicate requests", async () => {
  const p = pages.user; await p.goto("/en/navigator"); await expect(p.getByText(/No external AI model is used/)).toBeVisible();
  let calls = 0; await p.route("**/api/navigator", async route => { calls++; await new Promise(done => setTimeout(done, 500)); await route.continue(); });
  await p.locator('textarea[name="query"]').fill("free online course in Thailand"); await p.getByRole("button", { name: "Prepare filters for review" }).click();
  await expect(p.locator('select[name="category"]')).toHaveValue("skills"); await p.locator('input[name="confirmed"]').check();
  await p.getByRole("button", { name: "Find sources", exact: true }).click(); await expect(p.locator(".activity-spinner")).toBeVisible(); await expect(p.getByRole("button", { name: "Find sources", exact: true })).toBeDisabled();
  await expect(p.locator("blockquote").first()).toBeVisible({ timeout: 25000 }); await expect(p.locator(".activity-spinner")).toHaveCount(0); expect(calls).toBe(1);
  await expect(p.getByRole("link", { name: "Normal search without Navigator" })).toBeVisible(); expect(await p.evaluate(() => JSON.stringify(localStorage))).not.toContain("free online course");
  expect((await new AxeBuilder({ page: p }).include("#main").analyze()).violations).toEqual([]);
});
test("no-results, personal details and minor/urgent disclosures have safe manual alternatives", async () => {
  const p = pages.second; await p.goto("/en/navigator");
  await query(p, "job in Thailand", "ZZ"); await expect(p.getByText("No current sources match. Adjust the filters or use normal search.")).toBeVisible();
  for (const [q, message] of [["job email alice@example.test", "Remove personal and contact details"], ["I am 16 and want a job", "No child profile"], ["I am in immediate danger", "not an emergency channel"]]) {
    await query(p, q); await expect(p.getByText(new RegExp(message))).toBeVisible(); await expect(p.locator("blockquote")).toHaveCount(0);
  }
  await expect(p.getByRole("link", { name: "Normal search without Navigator" })).toBeVisible();
});
test("reports and exports share the same suppressed DTO; grants are rechecked after revocation", async () => {
  const p = pages.publisher; await p.goto("/en/impact"); await p.locator('input[name="month"]').fill(f.reportMonths[1].slice(0, 7)); await p.getByRole("button", { name: "View aggregate report" }).click();
  await expect(p.getByText("Suppressed for privacy").first()).toBeVisible({ timeout: 25000 }); await expect(p.locator(".activity-spinner")).toHaveCount(0);
  const reportResponse = await post(p, "/api/impact", { organization: f.org, month: f.reportMonths[1] }); const report = (await reportResponse.json()).data;
  const url = `/api/impact/export?organization=${f.org}&month=${f.reportMonths[1]}`, exportResponse = await p.request.get(url);
  expect(exportResponse.ok()).toBe(true); expect(await exportResponse.json()).toEqual(report); expect(exportResponse.headers()["cache-control"]).toContain("no-store");
  expect((await new AxeBuilder({ page: p }).include("#main").analyze()).violations).toEqual([]);
  expect((await post(pages.reviewer, "/api/impact/admin", { account: f.actors.publisher.id, organization: f.org, expires: new Date(Date.now() + 86400000).toISOString(), grant: false })).ok()).toBe(true);
  expect((await p.request.get(url)).status()).toBe(404);
  expect((await pages.user.request.get(url)).status()).toBe(404);
  await expect(p.locator("table")).toHaveCount(0, { timeout: 35000 });
});
test("administration needs real platform role/MFA and exposes no raw report members", async () => {
  expect((await pages.user.request.get("/api/impact/admin")).status()).toBe(404);
  const p = pages.reviewer; await p.goto("/th/admin/reporting"); await expect(p.getByRole("heading", { level: 1 })).toHaveText("สิทธิ์รายงานผลลัพธ์รวม");
  expect((await new AxeBuilder({ page: p }).include("#main").analyze()).violations).toEqual([]);
});
for (const lang of ["th", "en"]) test(`${lang}: mobile Navigator and report gates remain readable and accessible`, async () => {
  const p = pages.user; await p.setViewportSize({ width: 390, height: 844 }); await p.goto(`/${lang}/navigator`);
  expect((await new AxeBuilder({ page: p }).include("#main").analyze()).violations).toEqual([]); expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await p.goto(`/${lang}/impact`); await expect(p.getByRole("heading", { level: 1 })).toBeVisible(); expect((await new AxeBuilder({ page: p }).include("#main").analyze()).violations).toEqual([]);
});
test("guests can use normal search without signing in to Navigator", async ({ page }) => {
  await page.goto("/en/navigator"); await expect(page).toHaveURL(/\/en\/auth\/login/);
  expect((await post(page, "/api/navigator", { query: "job", locale: "en", confirmed: true })).status()).toBe(401);
  await page.goto("/en/opportunities"); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
