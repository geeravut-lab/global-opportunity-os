import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { localRuntime } from "./scripts/local-runtime";
const r = localRuntime();
export default defineConfig({
  testDir: "./tests/s2",
  workers: 1,
  retries: 0,
  maxFailures: 1,
  fullyParallel: false,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  outputDir: ".local/s2-browser-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3200",
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
  },
  webServer: {
    command: "node scripts/s2-app.mjs start 3200",
    url: "http://127.0.0.1:3200/th/opportunities",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      S2_ENABLED: "true",
      AUTH_ENABLED: "true",
      AUTH_GOOGLE_ENABLED: "false",
      APP_ORIGIN: "http://127.0.0.1:3200",
      NEXT_PUBLIC_SUPABASE_URL: r.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: r.anonKey,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
