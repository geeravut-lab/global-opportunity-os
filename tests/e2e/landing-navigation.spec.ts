import { test, expect } from "@playwright/test";
import { demoNav } from "../../lib/prototype";
for (const lang of ["th", "en"] as const) for (const role of ["beneficiary", "partner", "admin"] as const)
  test(`${lang}/${role}: current mobile menu highlights More and scrolls the selected item fully into view`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    const path = role === "beneficiary" ? `/${lang}` : `/${lang}/demo/${role}`, last = demoNav[role].at(-1)!;
    await page.goto(`${path}?section=${last.id}`);
    const bottom = page.locator(".mobile-bottom-nav"), more = bottom.getByRole("button", { name: lang === "th" ? "เพิ่มเติม" : "More", exact: true });
    await expect(more).toHaveAttribute("aria-current", "true"); await expect(bottom.locator('a[aria-current="page"]')).toHaveCount(0);
    expect(await more.evaluate(n => getComputedStyle(n).backgroundColor)).not.toBe(await bottom.locator("a").first().evaluate(n => getComputedStyle(n).backgroundColor));
    if (lang === "th" && role === "admin") await page.screenshot({ path: "docs/ux-review/mobile-more-active.png" });
    await more.click(); const selected = page.locator('#app-navigation a[aria-current="page"]');
    await expect(selected).toHaveCount(1); await expect(selected).toHaveText(last.label[lang]); await expect(selected).toBeInViewport({ ratio: 1 });
    expect(await selected.evaluate(n => { const box = n.getBoundingClientRect(), parent = n.closest(".sheet-scroll")!.getBoundingClientRect(); return box.top >= parent.top && box.bottom <= parent.bottom + 1; })).toBe(true);
    if (lang === "th" && role === "admin") await page.screenshot({ path: "docs/ux-review/mobile-more-selected-scroll.png" });
    await page.locator(".sheet-scroll").evaluate(n => { n.scrollTop = 0; });
    await page.getByRole("dialog").getByRole("button", { name: lang === "th" ? "ปิดเมนู" : "Close menu", exact: true }).click(); await expect(page.getByRole("dialog")).toBeHidden();
    await more.click(); await expect(selected).toBeInViewport({ ratio: 1 });
    await page.goBack(); await expect(page.getByRole("dialog")).toBeHidden(); await expect(more).toHaveAttribute("aria-current", "true");
    await page.goto(path); await expect(bottom.locator('a[aria-current="page"]')).toHaveCount(1); await expect(more).not.toHaveAttribute("aria-current");
  });
for (const role of ["beneficiary", "partner", "admin"])
  test(`${role}: illustrated cards, bottom bar and more sheet`, async ({
    page,
  }) => {
    const path = role === "beneficiary" ? "/th" : `/th/demo/${role}`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator(".home-menu-card").first()).toBeVisible();
    expect(await page.locator(".menu-art").count()).toBeGreaterThan(3);
    await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const before = page.url();
    await page.getByRole("button", { name: "เพิ่มเติม", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(page.url()).toBe(before);
    await page.getByRole("button", { name: "เพิ่มเติม", exact: true }).click();
    const link = page.locator("#app-navigation .side-link").nth(1);
    const href = await link.getAttribute("href");
    await link.click();
    await expect(page).toHaveURL(new URL(href!, before).toString());
    await page.goBack();
    expect(page.url()).toBe(before);
    await expect(page.getByRole("dialog")).toBeHidden();
  });
test("short desktop sidebar scrolls independently without hiding its footer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto("/th/demo/admin");
  const sidebar = page.locator(".app-sidebar"),
    nav = sidebar.locator("nav");
  expect(await nav.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true);
  await nav.evaluate((n) => {
    n.scrollTop = n.scrollHeight;
  });
  await expect(nav.locator("a").last()).toBeVisible();
  await expect(sidebar.locator(".sidebar-bottom")).toBeInViewport();
});
test("home screenshots for all roles from the generated menu artwork", async ({
  page,
}) => {
  for (const role of ["beneficiary", "partner", "admin"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(role === "beneficiary" ? "/th" : `/th/demo/${role}`);
    await page.screenshot({
      path: `docs/ux-review/${role}-cards-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: `docs/ux-review/${role}-cards-desktop.png`,
      fullPage: true,
    });
  }
});
