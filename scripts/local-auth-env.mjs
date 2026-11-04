import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { localRuntime } from "./local-runtime.ts";
const runtime = localRuntime();
const marker =
  "# Generated for isolated local S1 tests by scripts/local-auth-env.mjs";
if (
  existsSync(".env.local") &&
  !readFileSync(".env.local", "utf8").startsWith(marker)
)
  throw Error(
    "มี .env.local เดิมอยู่ ไม่เขียนทับ กรุณาใช้ runtime config แยกสำหรับ test",
  );
const settings = {
  NEXT_PUBLIC_SUPABASE_URL: runtime.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: runtime.anonKey,
  APP_ORIGIN: "http://127.0.0.1:3000",
  AUTH_ENABLED: "true",
  AUTH_GOOGLE_ENABLED: "false",
};
writeFileSync(
  ".env.local",
  marker +
    "\n" +
    Object.entries(settings)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") +
    "\n",
  { mode: 0o600 },
);
chmodSync(".env.local", 0o600);
console.log(
  "เขียน .env.local สำหรับ local stack สำเร็จ ไม่แสดง keys และไม่ใช้ hosted Project",
);
