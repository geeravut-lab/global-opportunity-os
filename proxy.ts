import { NextRequest, NextResponse } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { noStore } from "@/lib/auth/http";
export async function proxy(request: NextRequest) {
  const auth = requestClient(request);
  if (!auth) return noStore(NextResponse.next());
  // ตรวจ token กับ Auth server; การอนุญาตข้อมูลยังต้องตรวจ DB ในทุก RPC
  await auth.client.auth.getUser();
  return auth.apply(NextResponse.next({ request }));
}
export const config = {
  matcher: [
    "/:lang/account/:path*",
    "/:lang/auth/:path*",
    "/:lang/admin/:path*",
    "/:lang/workspace/:path*",
  ],
};
