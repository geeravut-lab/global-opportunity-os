// Actual headful Chromium + Orca in an isolated container; synthetic validation stack only.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import {
  validationRuntime,
  fixtureAdmin,
  operatorSql,
  privateJson,
  cleanupFixtures,
  syntheticTotp,
  literal,
} from "./validation-runtime.ts";
if (process.env.GOOS_VALIDATION_TARGET === "hosted")
  throw Error("Orca fixture drill is local only");
const r = validationRuntime(),
  run = "gooss1" + randomBytes(8).toString("hex"),
  name = "goos-orca-" + randomBytes(4).toString("hex");
mkdirSync(".local", { recursive: true, mode: 0o700 });
const dir = resolve(mkdtempSync(".local/orca-"));
chmodSync(dir, 0o700);
const manifest = {
  run,
  target: "local",
  project: r.project,
  apiOrigin: r.apiUrl,
  startedAt: new Date().toISOString(),
  actors: [],
  organizations: [],
};
privateJson(dir + "/manifest.json", manifest);
const env = {
  ...process.env,
  AUTH_ENABLED: "true",
  AUTH_GOOGLE_ENABLED: "false",
  APP_ORIGIN: "http://127.0.0.1:3100",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:18000",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: r.key,
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const k of [
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
env.DOCKER_HOST = "unix:///var/run/docker.sock";
function docker(args, label) {
  const out = spawnSync(
    "docker",
    ["--host=unix:///var/run/docker.sock", ...args],
    { env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  writeFileSync(
    dir + "/" + label + ".log",
    (out.stdout ?? "") + (out.stderr ?? ""),
    { mode: 0o600 },
  );
  if (out.status !== 0)
    throw Error("Orca container " + label + " failed; inspect private log");
  return out.stdout;
}
const checked = (v, m) => {
  if (!v) throw Error(m);
};
const admin = await fixtureAdmin(r);
let browser,
  started = false,
  actor;
const results = [];
try {
  const email = run + "-orca@example.test",
    password = "S1-Orca-" + randomBytes(18).toString("base64url"),
    created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { goos_fixture_run: run },
    });
  checked(!created.error && created.data.user, "Orca fixture creation");
  actor = { id: created.data.user.id, email, password };
  manifest.actors.push(actor);
  privateJson(dir + "/manifest.json", manifest);
  const c = createClient(r.apiUrl, r.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  checked(
    !(await c.auth.signInWithPassword({ email, password })).error,
    "Orca fixture login",
  );
  checked(
    !(await c.rpc("goos_bootstrap_account", { p_locale: "en" })).error,
    "Orca fixture bootstrap",
  );
  const enrollment = await c.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Orca fixture",
  });
  checked(!enrollment.error, "Orca MFA enrollment");
  actor.factorId = enrollment.data.id;
  actor.totp = enrollment.data.totp.secret;
  privateJson(dir + "/manifest.json", manifest);
  await operatorSql(
    r,
    `insert into private.platform_role_grants(account_id,role_code,granted_by) values(${literal(actor.id)}::uuid,'platform_admin',${literal(actor.id)}::uuid)`,
    false,
  );
  const network = docker(
    [
      "inspect",
      "--format",
      "{{range $n,$v := .NetworkSettings.Networks}}{{$n}}{{end}}",
      "supabase_kong_global-opportunity-os-s1-validation",
    ],
    "network",
  ).trim();
  checked(
    network === "supabase_network_global-opportunity-os-s1-validation",
    "Validation network guard",
  );
  const args = [
    "run",
    "-d",
    "--name",
    name,
    "--label",
    "goos.fixture=" + run,
    "--network",
    network,
    "--publish",
    "127.0.0.1:59222:9223",
    "--mount",
    `type=bind,src=${dir},dst=/results`,
  ];
  for (const path of [
    "app",
    "components",
    "lib",
    "public",
    "node_modules",
    ".next",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
  ])
    args.push(
      "--mount",
      `type=bind,src=${resolve(path)},dst=/app/${path},readonly`,
    );
  for (const k of [
    "AUTH_ENABLED",
    "AUTH_GOOGLE_ENABLED",
    "APP_ORIGIN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_TELEMETRY_DISABLED",
  ])
    args.push("-e", k);
  args.push("goos-a11y:node24-orca");
  started = true;
  docker(args, "start");
  let endpoint;
  for (let i = 0; i < 45; i++) {
    try {
      const v = await fetch("http://127.0.0.1:59222/json/version", {
        signal: AbortSignal.timeout(1000),
      });
      if (v.ok) {
        const d = await v.json(),
          u = new URL(d.webSocketDebuggerUrl);
        u.hostname = "127.0.0.1";
        u.port = "59222";
        endpoint = u.href;
        break;
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 1000));
  }
  checked(endpoint, "Orca Chromium CDP unavailable");
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0],
    page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 900 });
  for (let i = 0; i < 30; i++) {
    try {
      const response = await page.goto("http://127.0.0.1:3100/en", {
        waitUntil: "domcontentloaded",
      });
      if (response?.ok()) break;
    } catch {}
    await new Promise((done) => setTimeout(done, 1000));
  }
  docker(
    [
      "exec",
      "-e",
      "DISPLAY=:99",
      name,
      "xdotool",
      "search",
      "--onlyvisible",
      "--class",
      "chromium",
      "windowactivate",
      "--sync",
    ],
    "native-window-focus",
  );
  docker(
    [
      "exec",
      "-e",
      "DBUS_SESSION_BUS_ADDRESS=" +
        readFileSync(dir + "/session-bus.txt", "utf8"),
      name,
      "gdbus",
      "call",
      "--session",
      "--dest",
      "org.a11y.Bus",
      "--object-path",
      "/org/a11y/bus",
      "--method",
      "org.freedesktop.DBus.Properties.GetAll",
      "org.a11y.Status",
    ],
    "atspi-status",
  );
  const nativeTab = (label) =>
    docker(["exec", "-e", "DISPLAY=:99", name, "xdotool", "key", "Tab"], label);
  const focusVisible = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return false;
      const b = a.getBoundingClientRect();
      return (
        b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight
      );
    });
  const post = async (path, data) =>
    page.evaluate(
      async ({ path, data }) => {
        const r = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        return { status: r.status, data: (await r.json()).data };
      },
      { path, data },
    );
  for (const lang of ["en", "th"]) {
    await page.goto("http://127.0.0.1:3100/" + lang + "/opportunities");
    await page.locator("main h1").waitFor();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.getByRole("searchbox").first().focus();
    nativeTab("native-public-" + lang);
    checked(await focusVisible(), "Public keyboard focus is obscured");
    await new Promise((done) => setTimeout(done, 1500));
    checked(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.length === 0,
      "Public axe violations",
    );
    await page.setViewportSize({ width: 320, height: 900 });
    checked(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Public 320px reflow",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    results.push({
      lang,
      area: "directory",
      axe: true,
      reflow: true,
      keyboard: true,
    });
  }
  await page.goto("http://127.0.0.1:3100/en/auth/login");
  checked(
    (
      await post("/api/auth/login", {
        email: actor.email,
        password: actor.password,
        locale: "en",
      })
    ).status === 200,
    "Orca browser login",
  );
  await page.goto("http://127.0.0.1:3100/en/account/security");
  checked(
    (
      await post("/api/auth/mfa-verify", {
        factorId: actor.factorId,
        code: syntheticTotp(actor.totp),
      })
    ).status === 200,
    "Orca browser MFA",
  );
  for (const lang of ["en", "th"])
    for (const path of [
      "/account/profile",
      "/admin/branding",
      "/admin/admins",
    ]) {
      await page.goto("http://127.0.0.1:3100/" + lang + path);
      await page.locator("main h1").waitFor();
      const field = page.locator("main input").first();
      if (await field.count()) {
        await field.focus();
        nativeTab("native-protected-" + lang + path.replaceAll("/", "-"));
        checked(await focusVisible(), "Protected keyboard focus is obscured");
        await new Promise((done) => setTimeout(done, 800));
      }
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      checked(a.violations.length === 0, "Protected axe violations");
      await page.setViewportSize({ width: 390, height: 844 });
      checked(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Protected mobile reflow",
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      results.push({
        lang,
        area: path,
        axe: true,
        reflow: true,
        keyboard: true,
      });
    }
  await page.goto("http://127.0.0.1:3100/en/auth/login");
  await page.locator("#auth-email").focus();
  nativeTab("native-login-password");
  nativeTab("native-login-toggle");
  await new Promise((done) => setTimeout(done, 2000));
  const orca = existsSync(dir + "/orca.log")
    ? readFileSync(dir + "/orca.log", "utf8")
    : "";
  const speech = orca
    .split("\n")
    .filter((l) => /SPEECH OUTPUT|speak:|Speaking:/.test(l));
  checked(speech.length > 0, "Orca speech output was not observed");
  checked(
    speech.some((l) =>
      /Email|Password|email|password|Sign in|sign in|entry|text/.test(l),
    ),
    "Orca did not announce focused form controls",
  );
  docker(
    [
      "exec",
      name,
      "bash",
      "-c",
      'kill -INT "$(cat /results/audio.pid)"; sleep 1',
    ],
    "finish-audio",
  );
  const audio = readFileSync(dir + "/orca-speech.wav");
  checked(audio.length > 1000, "Orca audio was not captured");
  const versions = docker(
    ["exec", name, "bash", "-c", "orca --version; chromium --version"],
    "versions",
  ).trim();
  privateJson(dir + "/result.json", {
    passed: true,
    checks: results,
    orcaSpeechLines: speech.length,
    recordedAudioBytes: audio.length,
    versions,
    scope:
      "Orca Linux speech/focus smoke + axe/reflow; no NVDA/VoiceOver or human Thai speech comprehension claim",
  });
  console.log(
    "Orca/Chromium accessibility smoke passed: spoken focus output captured, 8 public/protected language-path checks, axe and reflow.",
  );
} finally {
  if (browser) await browser.close();
  if (started) {
    docker(["logs", name], "container-output");
    docker(["rm", "-f", name], "stop");
  }
  if (actor) {
    await operatorSql(
      r,
      `delete from private.platform_role_grants where account_id=${literal(actor.id)}::uuid and granted_by=${literal(actor.id)}::uuid and not exists(select 1 from private.platform_owner where account_id=${literal(actor.id)}::uuid)`,
      false,
    );
    try {
      await cleanupFixtures(r, manifest, admin);
    } finally {
      privateJson(dir + "/manifest.json", manifest);
    }
  }
}
