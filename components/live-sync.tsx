"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mayRefresh, nextLiveDelay } from "@/lib/platform/live";
export function LiveSync({
  lang,
  active,
}: {
  lang: "th" | "en";
  active: boolean;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    [pending, setPending] = useState(false),
    [offline, setOffline] = useState(false);
  const enabled = active && !/\/auth\//.test(pathname);
  const protectedPage = /^\/(th|en)\/(account|admin)(\/|$)/.test(pathname);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false,
      running = false,
      connected = false,
      quiet = 0,
      baseline: string | undefined,
      client: SupabaseClient | undefined,
      timer: ReturnType<typeof setTimeout>,
      debounce: ReturnType<typeof setTimeout>,
      renew: ReturnType<typeof setTimeout>;
    const dirty = () =>
      !!document.querySelector(
        'form[data-live-dirty="true"], [data-live-busy="true"]',
      ) ||
      !!document.activeElement?.matches(
        "input:not([type=button]):not([type=submit]),textarea,[contenteditable=true]",
      );
    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!cancelled) timer = setTimeout(check, ms);
    };
    async function check() {
      if (cancelled || running) return;
      running = true;
      try {
        if (document.hidden) {
          schedule(30000);
          return;
        }
        const r = await fetch("/api/live", { cache: "no-store" });
        if (r.status === 401 || r.status === 404) {
          cancelled = true;
          setPending(false);
          if (client) {
            void client.removeAllChannels();
            client = undefined;
          }
          if (protectedPage) {
            router.replace(`/${lang}/auth/login`);
            router.refresh();
          }
          return;
        }
        if (!r.ok) {
          if (baseline === undefined) {
            cancelled = true;
            return;
          }
          throw Error();
        }
        const d = (await r.json()).data;
        setOffline(false);
        if (!d.enabled) {
          schedule(30000);
          return;
        }
        if (baseline === undefined) {
          baseline = d.fingerprint;
          quiet = 0;
        } else if (baseline !== d.fingerprint) {
          quiet = 0;
          if (mayRefresh(!document.hidden, dirty(), pathname)) {
            baseline = d.fingerprint;
            setPending(false);
            router.refresh();
          } else {
            setPending(true);
            schedule(3000);
            return;
          }
        } else quiet++;
        schedule(nextLiveDelay(quiet, connected));
      } catch {
        setOffline(true);
        connected = false;
        schedule(nextLiveDelay(quiet, false));
      } finally {
        running = false;
      }
    }
    const wake = () => {
      quiet = 0;
      clearTimeout(debounce);
      debounce = setTimeout(check, 300);
    };
    async function connect() {
      try {
        const r = await fetch("/api/live/token", {
          headers: { "X-Goos-Live": "1" },
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()).data;
        if (!d.enabled || cancelled) return;
        if (client) await client.removeAllChannels();
        client = createClient(d.url, d.key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        await client.realtime.setAuth(d.token);
        const ready = new Set<string>();
        for (const topic of d.topics as string[]) {
          client
            .channel(topic, { config: { private: true } })
            .on("broadcast", { event: "ping" }, wake)
            .subscribe((status) => {
              if (cancelled) return;
              if (status === "SUBSCRIBED") ready.add(topic);
              else ready.delete(topic);
              connected = ready.size === d.topics.length;
              if (connected) wake();
              else schedule(4000);
            });
        }
        renew = setTimeout(
          connect,
          Math.max(
            10000,
            Math.min(
              45 * 60000,
              Number(d.expiresAt) * 1000 - Date.now() - 60000,
            ),
          ),
        );
      } catch {
        /* Polling remains authoritative when WebSocket is unavailable. */
      }
    }
    void check();
    if (process.env.NEXT_PUBLIC_LIVE_REALTIME !== "0") void connect();
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("goos:saved", wake);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(debounce);
      clearTimeout(renew);
      if (client) void client.removeAllChannels();
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("goos:saved", wake);
    };
  }, [enabled, lang, pathname, protectedPage, router]);
  if (!enabled || (!pending && !offline)) return null;
  return (
    <div role="status" className="live-state">
      {pending
        ? lang === "th"
          ? "มีข้อมูลใหม่ ระบบจะอัปเดตหลังบันทึกหรือออกจากฟอร์ม"
          : "Updates are waiting until your form is saved or closed."
        : lang === "th"
          ? "การเชื่อมต่อสะดุด ระบบจะลองอัปเดตอีกครั้ง"
          : "Connection interrupted. Updates will retry automatically."}
    </div>
  );
}
