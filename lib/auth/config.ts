export interface AuthConfig {
  url: string;
  key: string;
  origin: string;
  google: boolean;
}
export function authConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AuthConfig | null {
  if (env.AUTH_ENABLED !== "true") return null;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const origin = env.APP_ORIGIN;
  if (!url || !key || !origin) return null;
  try {
    const service = new URL(url),
      app = new URL(origin);
    for (const value of [service, app]) {
      if (
        value.username ||
        value.password ||
        value.search ||
        value.hash ||
        value.pathname !== "/"
      )
        return null;
      if (
        value.protocol !== "https:" &&
        !(
          value.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(value.hostname)
        )
      )
        return null;
    }
    // รับเฉพาะ publishable/anon key ไม่ยอมใช้ service_role เป็น client key
    if (!key.startsWith("sb_publishable_")) {
      const parts = key.split(".");
      if (
        parts.length !== 3 ||
        JSON.parse(Buffer.from(parts[1], "base64url").toString()).role !==
          "anon"
      )
        return null;
    }
    return {
      url: service.origin,
      key,
      origin: app.origin,
      google: env.AUTH_GOOGLE_ENABLED === "true",
    };
  } catch {
    return null;
  }
}
export function callbackPath(lang: string, next?: string): string {
  const locale = lang === "en" ? "en" : "th";
  return next === "password"
    ? `/${locale}/account/security?recovery=1`
    : `/${locale}/account`;
}
