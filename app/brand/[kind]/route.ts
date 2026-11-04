import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { publicClient } from "@/lib/platform/server";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (kind !== "logo" && kind !== "favicon")
    return new NextResponse(null, { status: 404 });
  try {
    const c = publicClient();
    const r = c ? await c.rpc("goos_brand_image", { p_kind: kind }) : null;
    if (r && !r.error && r.data) {
      const size =
        kind === "favicon" &&
        ["192", "512"].includes(request.nextUrl.searchParams.get("size") ?? "")
          ? Number(request.nextUrl.searchParams.get("size"))
          : null;
      const etag = `"${kind}-${r.data.hash}-${size ?? "original"}"`;
      const headers = {
        "Content-Type": "image/png",
        ETag: etag,
        "Cache-Control": "public, max-age=15, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      };
      if (request.headers.get("if-none-match") === etag)
        return new NextResponse(null, { status: 304, headers });
      let bytes = Buffer.from(r.data.body, "base64");
      if (size)
        bytes = await sharp(bytes, { limitInputPixels: 16777216 })
          .resize(size, size, { fit: "contain" })
          .png()
          .toBuffer();
      return new NextResponse(bytes, { headers });
    }
  } catch {
    /* Availability fallback is safe only for public branding, never authorization. */
  }
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: `/brand-defaults/${kind}${kind === "favicon" && request.nextUrl.searchParams.get("size") === "192" ? "-192" : ""}.png`,
      "Cache-Control": "public, max-age=15, must-revalidate",
    },
  });
}
