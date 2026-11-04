import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { validationRuntime } from "./scripts/validation-runtime";
const r = validationRuntime(),
  proxy =
    r.mode === "hosted"
      ? (process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY)
      : undefined;
export default defineConfig({
  testDir: "./tests/validation",
  workers: 1,
  retries: 0,
  maxFailures: 1,
  fullyParallel: false,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  outputDir: ".local/validation-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: r.origin,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      ...(proxy
        ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } }
        : {}),
    },
  },
  ...(r.mode === "local"
    ? {
        webServer: {
          command: "npm run start -- --hostname 127.0.0.1 --port 3100",
          url: r.origin + "/th/auth/signup",
          reuseExistingServer: false,
          timeout: 60000,
          env: {
            AUTH_ENABLED: "true",
            AUTH_GOOGLE_ENABLED: "false",
            APP_ORIGIN: r.origin,
            NEXT_PUBLIC_SUPABASE_URL: r.apiUrl,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: r.key,
            NEXT_PUBLIC_LIVE_REALTIME: "1",
            NEXT_TELEMETRY_DISABLED: "1",
          },
        },
      }
    : {}),
});
