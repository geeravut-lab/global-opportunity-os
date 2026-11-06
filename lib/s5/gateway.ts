import { resolveCitations, safePublicSource, type NavigatorFilter, type Source } from "./model";
export type PublicPrompt = { filters: NavigatorFilter; sources: Pick<Source, "id" | "title" | "quote">[]; locale: "th" | "en" };
export type NavigatorAdapter = (prompt: PublicPrompt, signal: AbortSignal) => Promise<unknown>;
const failures = new WeakMap<NavigatorAdapter, { failures: number; until: number }>();
// Optional adapters can only select source IDs. They receive no free query, identity or mutation tools.
export async function groundedSelection(filters: NavigatorFilter, sources: Source[], locale: "th" | "en", adapter?: NavigatorAdapter, now = Date.now()) {
  const safe = sources.filter(s => safePublicSource(s, now));
  const fallback = { mode: "source_guidance" as const, sources: safe.slice(0, 5), reason: safe.length ? "verified_public_sources" : "no_current_sources" };
  if (!adapter) return fallback;
  const circuit = failures.get(adapter); if (circuit && circuit.until > now) return { ...fallback, reason: "provider_unavailable" };
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error("timeout")); }, 2500); });
    const result = await Promise.race([adapter({ filters: { ...filters }, locale, sources: safe.slice(0, 10).map(({ id, title, quote }) => ({ id, title, quote })) }, controller.signal), timeout]);
    if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).some(k => k !== "source_ids")) throw Error("invalid_output");
    const selected = resolveCitations((result as { source_ids: unknown }).source_ids, safe, now);
    failures.delete(adapter); return { mode: "assisted_sources" as const, sources: selected, reason: selected.length ? "verified_public_sources" : "no_current_sources" };
  } catch {
    const count = (circuit?.failures ?? 0) + 1; failures.set(adapter, { failures: count, until: count >= 3 ? now + 60000 : 0 });
    return { ...fallback, reason: "provider_unavailable" };
  } finally { if (timer) clearTimeout(timer); controller.abort(); }
}
