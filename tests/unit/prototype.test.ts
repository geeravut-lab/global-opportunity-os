import { it,expect } from "vitest";
import { demoHref,demoNav,isDemoRole,safeSection } from "../../lib/prototype";
it("รับเฉพาะมุมมองใน allowlist ไม่ถือว่าเป็น authorization",()=>{expect(isDemoRole("admin")).toBe(true);expect(isDemoRole("superuser")).toBe(false);});
it("section ที่ไม่รู้จักกลับหน้าหลัก",()=>{expect(safeSection("partner","assessment")).toBe("home");expect(safeSection("beneficiary","assessment")).toBe("assessment");expect(safeSection("admin","https://bad.invalid")).toBe("home");});
it("ทุกเมนูไปเส้นทางภายใน",()=>{for(const role of ["beneficiary","partner","admin"] as const)for(const item of demoNav[role])expect(demoHref("th",role,item.id)).toMatch(/^\/th(?:\/|\?|$)/);});
it("ลิงก์โอกาสไป public directory ไม่บังคับมีบัญชี",()=>expect(demoHref("th","beneficiary","opportunities")).toBe("/th/opportunities"));
