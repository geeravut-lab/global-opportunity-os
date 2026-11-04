import { test, expect } from "@playwright/test";
for (const lang of ["th", "en"]) {
  test(`${lang}: รายการ กรอง ผลว่าง และล้างกลับ`, async ({ page }) => {
    await page.goto(`/${lang}`);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByRole("status")).toContainText("2");
    await page.locator("#q").fill(lang === "th" ? "เข้าถึง" : "Bridge to Access");
    await expect(page.getByRole("status")).toContainText("1");
    await page.locator("#q").fill("not-in-dataset");
    await expect(page.getByRole("status")).toContainText("0");
    await expect(page.getByRole("heading", { name: lang === "th" ? "ยังไม่พบรายการที่ตรงกัน" : "No matching listings yet" })).toBeVisible();
    await page.getByRole("button", { name: lang === "th" ? "ล้างตัวกรอง" : "Clear filters" }).first().click();
    await expect(page.getByRole("status")).toContainText("2");
    await page.locator("#region").selectOption("asia");
    await expect(page.getByRole("status")).toContainText("1");
    await page.reload();
    await expect(page.locator("#region")).toHaveValue("asia");
  });
  test(`${lang}: รายละเอียดทุกสถานะและไม่มีส่งต่อจริง`, async ({ page }) => {
    for (const [slug, active] of [["open-path-skills", true], ["community-resource-circle", false], ["shared-horizon", false]] as const) {
      await page.goto(`/${lang}/directory/${slug}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator(".demo-bar")).toContainText(lang === "th" ? "ข้อมูลสมมติ" : "fictional");
      await expect(page.locator(".evidence-panel a")).toHaveCount(active ? 1 : 0);
      await expect(page.locator("form,input")).toHaveCount(0);
      await expect(page.locator('a[href^="http"]')).toHaveCount(0);
    }
  });
  test(`${lang}: ไม่พบรายการและตัวกรองผิดไม่ล่ม`, async ({ page }) => {
    const response = await page.goto(`/${lang}/directory/not-a-listing`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: lang === "th" ? "ไม่พบรายการนี้" : "Listing not found" })).toBeVisible();
    await page.goto(`/${lang}?status=javascript:alert(1)&category=__proto__`);
    await expect(page.getByRole("status")).toContainText("2");
    await expect(page.locator(".status-note")).toBeVisible();
  });
}
test("เปลี่ยนภาษาคงตัวกรองและรายการเดิม", async ({ page }) => {
  await page.goto("/th?category=access&region=asia");
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\?.*category=access/);
  await expect(page.locator("#region")).toHaveValue("asia");
  await page.locator("article h3 a").click();
  await page.getByRole("link", { name: "ภาษาไทย" }).click();
  await expect(page).toHaveURL(/\/th\/directory\/bridge-access/);
  await page.getByRole("link", { name: "กลับไปไดเรกทอรี" }).click();
  await expect(page.locator("#category")).toHaveValue("access");
});
test("คีย์บอร์ดข้ามเนื้อหาและพิมพ์คำค้นหลายคำได้", async ({ page }) => {
  await page.goto("/en"); await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.locator("#q").focus(); await page.keyboard.type("Open Path");
  await expect(page.locator("#q")).toHaveValue("Open Path");
  await expect(page.getByRole("status")).toContainText("1");
});
test("ไม่โหลดปลายทางภายนอก ไม่มีคุกกี้หรือข้อมูลเก็บใน browser", async ({ page, context }) => {
  const external: string[] = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://127.0.0.1:3000")) external.push(r.url()); });
  await page.goto("/en");
  await page.locator("#q").fill('<img src=x onerror="alert(1)">');
  await expect(page.getByRole("status")).toContainText("0");
  expect(external).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  const html = await page.content(); expect(html).not.toContain("fictional-organization");
});
test("ภาษาไม่รองรับตอบ 404 และไม่เปลี่ยนเส้นทางภายนอก", async ({ page }) => {
  const response = await page.goto("/xx"); expect(response?.status()).toBe(404);
  expect(new URL(page.url()).host).toBe("127.0.0.1:3000");
});
