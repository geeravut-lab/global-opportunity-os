import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const css = readFileSync("app/theme.css", "utf8"),
  token = (name: string) => {
    const v = css.match(
      new RegExp("--goos-" + name + ":\\s*(#[a-f0-9]{6})", "i"),
    )?.[1];
    if (!v) throw Error("Missing token " + name);
    return v;
  };
function luminance(h: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a: string, b: string) {
  const x = luminance(token(a)),
    y = luminance(token(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("Opp4All readable design contracts", () => {
  it("body, secondary text, actions, states and cards retain normal-text contrast", () => {
    for (const bg of [
      "surface",
      "page",
      "highlight-bg",
      "success-bg",
      "warning-bg",
      "danger-bg",
      "info-bg",
    ])
      for (const fg of ["ink", "muted"])
        expect(contrast(fg, bg), fg + " on " + bg).toBeGreaterThanOrEqual(4.5);
    for (const [fg, bg] of [
      ["surface", "primary"],
      ["surface", "primary-hover"],
      ["surface", "primary-pressed"],
      ["nav-text", "nav-bg"],
      ["nav-muted", "nav-bg"],
      ["success-fg", "success-bg"],
      ["danger-fg", "danger-bg"],
      ["warning-fg", "warning-bg"],
      ["info-fg", "info-bg"],
      ["primary-hover", "highlight-bg"],
    ])
      expect(contrast(fg, bg), fg + " on " + bg).toBeGreaterThanOrEqual(4.5);
  });
  it("field borders and focus rings are visible independently from decorative lines", () => {
    expect(contrast("field-border", "surface")).toBeGreaterThanOrEqual(3);
    expect(contrast("primary", "surface")).toBeGreaterThanOrEqual(3);
    expect(contrast("focus-on-dark", "nav-bg")).toBeGreaterThanOrEqual(3);
  });
  it("manifest colors match the central palette", () => {
    const manifest = readFileSync("app/manifest.ts", "utf8");
    expect(manifest).toContain(token("page"));
    expect(manifest).toContain(token("nav-bg"));
  });
});
