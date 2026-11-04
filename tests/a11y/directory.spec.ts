import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const lang of ["th", "en"]) {
  for (const route of ["", "/directory/open-path-skills", "/directory/community-resource-circle", "/directory/shared-horizon", "?q=no-matching-service", "/directory/not-a-listing"]) {
    test(`${lang}${route}: axe WCAG 2.2 AA`, async ({ page }) => {
      await page.goto(`/${lang}${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations).toEqual([]);
    });
  }
  test(`${lang}: จัดหน้าใหม่ 320 CSS px และข้อความยาว`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${lang}?status=all`);
    await expect(page.locator("article")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator("article h3 a").first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
