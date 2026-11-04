import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth/config";
export async function serverClient() {
  const config = authConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: config.origin.startsWith("https:"),
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) {
        try {
          for (const item of items)
            jar.set(item.name, item.value, {
              ...item.options,
              httpOnly: true,
              secure: config.origin.startsWith("https:"),
              sameSite: "lax",
              path: "/",
            });
        } catch {
          /* Proxy/Route Handler เป็นผู้เขียน cookies และ no-store headers */
        }
      },
    },
    global: {
      fetch: (input, options) =>
        fetch(input, { ...options, cache: "no-store" }),
    },
  });
}
