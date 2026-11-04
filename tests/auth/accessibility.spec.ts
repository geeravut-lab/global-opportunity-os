import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { actor, signIn } from "./helpers";
for (const lang of ["th", "en"]) {
  for (const mode of ["login", "signup", "recover"])
    test(`${lang}/${mode}: WCAG 2.2 AA and keyboard`, async ({ page }) => {
      await page.goto(`/${lang}/auth/${mode}`);
      await expect(page.locator("main h1")).toBeVisible();
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(a.violations).toEqual([]);
      await page.locator("#auth-email").focus();
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => document.activeElement?.tagName !== "BODY"),
      ).toBe(true);
    });
  test(`${lang}: all account sections WCAG, 320px reflow and 200% text`, async ({
    page,
  }) => {
    await signIn(page, await actor(), lang);
    for (const section of [
      "",
      "profile",
      "security",
      "organizations",
      "delegations",
      "invitations",
      "privacy",
    ]) {
      await page.goto(`/${lang}/account/${section}`);
      await expect(page.locator("main h1")).toBeVisible();
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(a.violations).toEqual([]);
      await page.setViewportSize({ width: 320, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await page.goto(`/${lang}/account/profile`);
    await page.addStyleTag({ content: "html { font-size:200% !important; }" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("ภาพทบทวน S1 จากข้อมูลสมมติ", async ({ page }) => {
  await page.goto("/th/auth/login");
  await page.screenshot({
    path: "docs/ux-review/s1-login-th.png",
    fullPage: true,
  });
  await signIn(page, await actor(), "th");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/th/account/profile");
  await page.screenshot({
    path: "docs/ux-review/s1-profile-mobile-th.png",
    fullPage: true,
  });
});
