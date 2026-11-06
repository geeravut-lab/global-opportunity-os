import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { syntheticTotp } from "../../scripts/validation-runtime";
const f = JSON.parse(readFileSync(".local/s4-fixtures.json", "utf8")), origin = "http://127.0.0.1:3400";
async function login(p: Page, name: string) {
  await p.goto("/en/auth/login"); await p.locator("#auth-email").fill(f.actors[name].email); await p.locator("#auth-password").fill(f.actors[name].password);
  await p.locator("form button[type=submit]").click(); await expect(p).toHaveURL(/\/en\/account$/, { timeout: 25000 });
}
test("policy requires MFA; draft saving shows loading and blocks duplicate submission", async ({ page }) => {
  await login(page, "reviewer"); await page.goto("/en/admin/policy"); await expect(page.getByText("Verify MFA to continue")).toBeVisible();
  const r = await page.request.post("/api/auth/mfa-verify", { headers: { Origin: origin }, data: { factorId: f.actors.reviewer.factorId, code: syntheticTotp(f.actors.reviewer.totp) } }); expect(r.ok()).toBe(true);
  await page.goto("/en/admin/policy"); await expect(page.getByRole("heading", { level: 1 })).toContainText("Policy");
  let calls = 0; await page.route("**/api/policy", async route => { calls++; await new Promise(done => setTimeout(done, 600)); await route.continue(); });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".activity-spinner")).toBeVisible(); await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible(); await expect(page.locator(".activity-spinner")).toHaveCount(0); expect(calls).toBe(1);
  await expect(page.getByRole("button", { name: "Enable S4 workflow" })).toBeDisabled();
  expect((await new AxeBuilder({ page }).include("#main").analyze()).violations).toEqual([]);
  await page.goto("/th/admin/purge"); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await new AxeBuilder({ page }).include("#main").analyze()).violations).toEqual([]);
});
test("ordinary users cannot open policy administration or retrieve its API", async ({ page }) => {
  await login(page, "second"); expect((await page.request.get("/api/policy")).status()).toBe(404);
  const r = await page.goto("/en/admin/policy"); expect(r?.status()).toBe(404);
});
for (const lang of ["th", "en"]) test(`${lang}: public notice and anonymous deletion tracking are accessible without exposing IDs`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`/${lang}/policy`);
  await expect(page.locator('.mobile-bottom-nav .more-button')).toHaveAttribute("aria-current", "true");
  expect((await new AxeBuilder({ page }).include("#main").analyze()).violations).toEqual([]);
  await page.goto(`/${lang}/deletion-status`); await expect(page.locator("main input")).toHaveAttribute("autocomplete", "off");
  await expect(page.locator('.mobile-bottom-nav .more-button')).toHaveAttribute("aria-current", "true");
  expect((await new AxeBuilder({ page }).include("#main").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
