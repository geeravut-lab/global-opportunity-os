import type { MetadataRoute } from "next";
import { publicSettings } from "@/lib/platform/server";
import { imageUrl } from "@/lib/platform/settings";
export const dynamic = "force-dynamic";
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await publicSettings();
  const src = imageUrl(s, "favicon");
  return {
    name: s.name_en,
    short_name: s.name_en.slice(0, 12),
    id: "/",
    start_url: "/th",
    display: "standalone",
    lang: "th",
    background_color: "#f6f7fc",
    theme_color: "#151c3b",
    icons: [
      {
        src: src + "&size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: src + "&size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "ค้นหาโอกาส / Find opportunities", url: "/th/opportunities" },
      { name: "บัญชีของฉัน / My account", url: "/th/account" },
    ],
  };
}
