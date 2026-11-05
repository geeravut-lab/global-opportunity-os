import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  parseSettings,
  brandText,
  defaultSettings,
  validName,
  imageUrl,
} from "../../lib/platform/settings";
import { validateBrandImage } from "../../lib/platform/image";
import {
  liveDeadlineDelay,
  nextLiveDelay,
  mayRefresh,
  ownLiveTopics,
} from "../../lib/platform/live";
import { backTarget, navigationFor } from "../../lib/platform/navigation";
describe("Platform boundaries", () => {
  it("public expiry wakes a connected client without a refresh and avoids a past-deadline busy loop", () => {
    const now = Date.parse("2026-11-05T00:00:00Z");
    expect(liveDeadlineDelay(60000, "2026-11-05T00:00:02Z", now)).toBe(2100);
    expect(liveDeadlineDelay(60000, "2026-11-04T00:00:00Z", now)).toBe(250);
    expect(liveDeadlineDelay(4000, null, now)).toBe(4000);
    expect(liveDeadlineDelay(4000, "invalid", now)).toBe(4000);
  });
  it("malformed public settings fall back without opening new permissions", () => {
    const s = parseSettings({
      name_th: "<script>",
      flags: { live_sync: false, unknown: false, branding: true },
      version: -1,
    });
    expect(s.name_th).toBe(defaultSettings.name_th);
    expect(s.flags).toEqual({ live_sync: false });
    expect(s.version).toBe(0);
  });
  it("name replacement is a single pass even when new names contain the original", () => {
    expect(
      brandText(
        "Global Opportunity OS",
        { ...defaultSettings, name_en: "New Global Opportunity OS" },
        "en",
      ),
    ).toBe("New Global Opportunity OS");
  });
  it("brand names reject control characters and markup", () => {
    for (const name of ["", "<img>", "name\n", "a".repeat(61)])
      expect(validName(name)).toBe(false);
    expect(validName("โอกาสสำหรับทุกคน")).toBe(true);
  });
  it("image URLs change with the immutable asset ID", () => {
    expect(imageUrl({ ...defaultSettings, logo_id: "123" }, "logo")).toBe(
      "/brand/logo?v=123",
    );
  });
  it("only the actor personal topic and public settings topic are selected", () => {
    expect(ownLiveTopics("actor")).toEqual(["goos:u:actor", "goos:settings"]);
  });
  it("adaptive polling backs off; drafts and security forms do not refresh", () => {
    expect(nextLiveDelay(0, false)).toBe(4000);
    expect(nextLiveDelay(6, false)).toBe(8000);
    expect(nextLiveDelay(18, false)).toBe(16000);
    expect(nextLiveDelay(0, true)).toBe(60000);
    expect(mayRefresh(true, true, "/th/account")).toBe(false);
    expect(mayRefresh(true, false, "/th/account/security")).toBe(false);
    expect(mayRefresh(false, false, "/th/account")).toBe(false);
  });
  it("back targets use owned whitelist keys only", () => {
    expect(backTarget("/th/account/profile", "__proto__")).toBe("/th/account");
    expect(backTarget("/en/admin/audit", "https://evil.test")).toBe(
      "/en/admin",
    );
    expect(backTarget("/th/account", null)).toBeNull();
  });
  it("navigation includes all personal routes, not a separate mobile list", () => {
    const items = navigationFor(
      "th",
      "beneficiary",
      "/th/account/notifications",
      null,
    );
    expect(
      items.some((i) => i.href === "/th/account/notifications" && i.active),
    ).toBe(true);
  });
  it("default PNG favicon passes actual decoder and strips metadata", async () => {
    const r = await validateBrandImage(
      readFileSync("public/brand-defaults/favicon.png"),
      "favicon",
    );
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
    expect(Buffer.from(r.png, "base64").length).toBeLessThanOrEqual(524288);
  });
  it("rejects SVG disguised as PNG and oversized uploads", async () => {
    await expect(
      validateBrandImage(
        Buffer.from('<svg onload="alert(1)">' + ".".repeat(100)),
        "logo",
      ),
    ).rejects.toThrow("INVALID_IMAGE");
    await expect(
      validateBrandImage(Buffer.alloc(1048577), "logo"),
    ).rejects.toThrow();
  });
  it("rejects non-square and undersized favicon images", async () => {
    for (const [width, height] of [
      [192, 256],
      [128, 128],
    ]) {
      const image = await sharp({
        create: { width, height, channels: 4, background: "#5145cc" },
      })
        .png()
        .toBuffer();
      await expect(validateBrandImage(image, "favicon")).rejects.toThrow();
    }
  });
});
