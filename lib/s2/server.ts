import { publicClient } from "../platform/server";
import type { CatalogResult } from "./model";
export async function readCatalog(
  filter: Record<string, string | number>,
  id: string | null = null,
): Promise<CatalogResult> {
  const c = publicClient();
  if (!c) throw Error("CATALOG_UNAVAILABLE");
  const r = await c.rpc("goos_s2_catalog", { p_filter: filter, p_id: id });
  if (r.error) throw Error("CATALOG_UNAVAILABLE");
  return r.data as CatalogResult;
}
