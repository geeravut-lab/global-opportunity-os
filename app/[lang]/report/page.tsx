import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { s4IntakeEnabled } from "@/lib/s4/model";
import { s4Text } from "@/lib/s4/copy";
import { GuestReport } from "@/components/guest-report";
export const dynamic = "force-dynamic";
export default async function Report({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang) || !s4IntakeEnabled()) notFound();
  return (
    <main id="main" className="account-page s4-page">
      <h1>{s4Text(lang, "anonymous_report")}</h1>
      <GuestReport lang={lang} />
    </main>
  );
}
