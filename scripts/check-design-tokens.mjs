// Gate สี/สเกลใน source UI เท่านั้น; SVG/ภาพใน assets เป็น artwork และ manifest มี absolute color ที่ทดสอบเทียบ tokens
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const issues = [];
for (const file of [...files("app"), ...files("components")].filter(
  (f) => /\.(css|tsx)$/.test(f) && f !== "app/theme.css",
)) {
  const source = readFileSync(file, "utf8");
  if (/#[a-f0-9]{3,8}\b|rgba?\(/i.test(source))
    issues.push(file + ": literal color outside theme");
  for (const m of source.matchAll(/font-size:\s*([.\d]+)(px|rem)/g)) {
    const px = Number(m[1]) * (m[2] === "rem" ? 16 : 1);
    if (px < 14) issues.push(file + ": font below14 outside tiny token");
  }
}
if (issues.length) {
  console.error(issues.join("\n"));
  process.exit(1);
}
console.log(
  "UI colors use design tokens; no raw colors or text below14px outside the tiny token",
);
