import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { parseSettings, defaultSettings } from "./settings";
// Public branding needs no user session. Auth flags never control authorization of image/settings writes.
export function publicClient(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL,
    key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const u = new URL(url);
    if (
      u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(u.hostname)
      )
    )
      return null;
    if (!key.startsWith("sb_publishable_")) {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1] ?? "", "base64url").toString(),
      );
      if (payload.role !== "anon") return null;
    }
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, options) =>
          fetch(input, {
            ...options,
            cache: "no-store",
            signal: options?.signal ?? AbortSignal.timeout(4000),
          }),
      },
    });
  } catch {
    return null;
  }
}
export const publicSettings = cache(async () => {
  try {
    const c = publicClient();
    if (!c) return defaultSettings;
    const r = await c.rpc("goos_public_settings");
    return r.error ? defaultSettings : parseSettings(r.data);
  } catch {
    return defaultSettings;
  }
});
