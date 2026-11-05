import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/s3",
  workers: 1,
  retries: 0,
  maxFailures: 1,
  fullyParallel: false,
  timeout: 90000,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  outputDir: ".local/s3-browser-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3300",
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
    command: "node scripts/s3-app.mjs start 3300",
    url: "http://127.0.0.1:3300/th/opportunities",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
