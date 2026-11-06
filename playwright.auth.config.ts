import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { localRuntime } from "./scripts/local-runtime";
const local = localRuntime();
export default defineConfig({
  globalSetup: "./tests/auth/setup.ts",
  testDir: "./tests/auth",
  workers: 1,
  retries: 0,
  fullyParallel: false,
  timeout: 45000,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "off",
    screenshot: "off",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
  },
  projects: [{ name: "auth-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/th/auth/login",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.anonKey,
      APP_ORIGIN: "http://127.0.0.1:3000",
      AUTH_ENABLED: "true",
      AUTH_GOOGLE_ENABLED: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
