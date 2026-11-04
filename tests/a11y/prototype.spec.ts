import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const lang of ["th","en"]) for (const path of ["","/demo/partner","/demo/admin"]) {
  test(`${lang}${path}: prototype axe และ reflow`,async({page})=>{
    await page.goto(`/${lang}${path}`);
    const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
    expect(result.violations).toEqual([]);
    await page.setViewportSize({width:320,height:850});
    const mobileResult=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
    expect(mobileResult.violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator("main h1")).toBeVisible();
  });
}
for(const section of ["assessment","navigator","profile","plan"]){
  test(`th ${section}: ฟอร์มและสถานะเข้าได้`,async({page})=>{
    await page.goto(`/th?section=${section}`);
    expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag22aa"]).analyze()).violations).toEqual([]);
  });
}
