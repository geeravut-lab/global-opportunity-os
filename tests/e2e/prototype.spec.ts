import { test, expect } from "@playwright/test";
import { demoNav, demoHref, demoText } from "../../lib/prototype";
for (const lang of ["th", "en"] as const) {
  const t = demoText[lang];
  test(`${lang}: ต้นแบบผู้ใช้ ประเมินเป้าหมาย แผน และการบันทึก`, async ({
    page,
  }) => {
    await page.goto(`/${lang}`);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(
      page.getByRole("heading", { name: new RegExp(t.greeting) }),
    ).toBeVisible();
    const save = page.locator(".save-button").first();
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "false");
    await page.goto(`/${lang}?section=assessment`);
    await page.getByRole("radio", { name: t.goalJob }).check();
    await page.getByRole("button", { name: t.confirm }).click();
    await expect(page.getByRole("status")).toContainText(t.confirmed);
    await expect(
      page.getByRole("link", { name: new RegExp(t.explore) }),
    ).toHaveAttribute("href", `/${lang}/opportunities?category=jobs`);
    await page.goto(`/${lang}?section=plan`);
    await expect(page.locator(".progress-ring")).toContainText("60%");
    await page
      .getByRole("button", {
        name: lang === "th" ? "ทำขั้นตอนสมมติแล้ว" : "Complete demo step",
      })
      .click();
    await expect(page.locator(".progress-ring")).toContainText("80%");
  });
  test(`${lang}: partner คิวงานและการตรวจเอกสารเป็นการจำลอง`, async ({
    page,
  }) => {
    await page.goto(`/${lang}/demo/partner`);
    await expect(page.getByRole("heading", { name: t.org })).toBeVisible();
    await expect(page.locator(".metric-card")).toHaveCount(4);
    await page.getByRole("button", { name: `${t.view} DEMO-001` }).click();
    await expect(page.locator(".demo-detail")).toContainText("DEMO-001");
    await page.getByRole("button", { name: t.close, exact: true }).click();
    await expect(page.locator(".demo-detail")).toHaveCount(0);
    await page.goto(`/${lang}/demo/partner?section=verification`);
    await page.getByRole("button", { name: t.reviewOrg }).click();
    await expect(page.getByRole("status")).toContainText(t.requested);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
  test(`${lang}: admin เปลี่ยนตัวกรองและแสดงเฉพาะข้อมูลจำลอง`, async ({
    page,
  }) => {
    await page.goto(`/${lang}/demo/admin`);
    await expect(page.getByRole("heading", { name: t.overview })).toBeVisible();
    await expect(page.locator(".metric-card strong").first()).toHaveText("128");
    await page.locator("#demo-country").selectOption("th");
    await expect(page.locator(".metric-card strong").first()).toHaveText("64");
    await page.locator("#demo-period").selectOption("7");
    await expect(page.locator(".metric-card strong").first()).toHaveText("32");
    await expect(page.locator("main")).toContainText(t.noMetrics);
    await page
      .getByRole("button", { name: t.notifications, exact: true })
      .click();
    await expect(page.locator("#top-notifications")).toBeVisible();
    await page.getByRole("button", { name: t.markRead }).click();
    await expect(page.locator("#top-notifications")).toHaveCount(0);
  });
  test(`${lang}: ทุกเมนูของสามมุมมองเปิดได้ แต่ไม่ใช่ระบบสิทธิ์`, async ({
    page,
  }) => {
    for (const role of ["beneficiary", "partner", "admin"] as const) {
      for (const item of demoNav[role]) {
        await page.goto(demoHref(lang, role, item.id));
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator(".prototype-banner")).toContainText(
          t.prototype,
        );
      }
    }
    await page.goto(`/${lang}/demo/admin?section=not-valid`);
    await expect(page.getByRole("heading", { name: t.overview })).toBeVisible();
  });
}
test("ต้นแบบไม่เรียก AI หรือส่งข้อมูลภายนอก และเปลี่ยนภาษาคงหน้า", async ({
  page,
  context,
}) => {
  const external: string[] = [];
  const mutation: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:3000")) external.push(r.url());
    if (r.method() !== "GET") mutation.push(r.url());
  });
  await page.goto("/th?section=navigator");
  await page.getByRole("button", { name: demoText.th.showGuidance }).click();
  await expect(page.getByRole("status")).toContainText(demoText.th.unknown);
  await page.getByRole("link", { name: "English", exact: false }).click();
  await expect(page).toHaveURL(/\/en\?section=navigator/);
  await expect(
    page.getByRole("heading", { name: demoText.en.aiOff }),
  ).toBeVisible();
  expect(external).toEqual([]);
  expect(mutation).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
});
test("เมนูมือถือใช้คีย์บอร์ดเปิดและเลือกมุมมองได้", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/th");
  await page
    .getByRole("button", { name: demoText.th.menu, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#app-navigation")).toBeVisible();
  await expect(
    page
      .locator("#app-navigation")
      .getByRole("button", { name: demoText.th.closeMenu, exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: demoText.th.menu, exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page
    .locator("#app-navigation")
    .getByRole("link", { name: "ค้นหาโอกาส", exact: true })
    .click();
  await expect(page).toHaveURL(/\/th\/opportunities$/);
  await expect(page.locator("#app-navigation")).toBeHidden();
  await page
    .getByRole("navigation", { name: demoText.th.switchRole })
    .getByRole("link", { name: "พันธมิตร NGO" })
    .click();
  await expect(page).toHaveURL(/\/demo\/partner$/);
});
