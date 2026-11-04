import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { authConfig } from "@/lib/auth/config";
import { SignInForm } from "@/components/sign-in-form";
export const dynamic = "force-dynamic";
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; mode: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { lang, mode } = await params;
  if (!isLocale(lang) || !["login", "signup", "recover"].includes(mode))
    notFound();
  const config = authConfig(),
    query = await searchParams;
  return (
    <SignInForm
      lang={lang}
      mode={mode as "login" | "signup" | "recover"}
      configured={!!config}
      google={!!config?.google}
      callbackError={query.status === "callback-error"}
    />
  );
}
