import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { noStore } from "@/lib/auth/http";
export function requestClient(request: NextRequest) {
  const config = authConfig();
  if (!config) return null;
  const changes = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  const client = createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: config.origin.startsWith("https:"),
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const item of items) {
          request.cookies.set(item.name, item.value);
          changes.set(item.name, {
            ...item,
            options: {
              ...item.options,
              httpOnly: true,
              secure: config.origin.startsWith("https:"),
              sameSite: "lax",
              path: "/",
            },
          });
        }
      },
    },
    global: {
      fetch: (input, options) =>
        fetch(input, { ...options, cache: "no-store" }),
    },
  });
  const apply = (response: NextResponse) => {
    for (const item of changes.values())
      response.cookies.set(item.name, item.value, item.options);
    return noStore(response);
  };
  return { client, config, apply };
}
