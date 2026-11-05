import { entries } from "@/lib/fixtures";
import { publicEntry } from "@/lib/directory";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Prototype } from "@/components/prototype";
import { s2Enabled } from "@/lib/s2/model";
import { s2Text } from "@/lib/s2/copy";
import { HomeMenuGrid, S2HomeMenus } from "@/components/home-menu-cards";
export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { section } = await searchParams;
  if (s2Enabled()) {
    const destinations: Record<string, string> = {
      assessment: "workspace/assessment",
      saved: "workspace/bookmarks",
      profile: "account/profile",
    };
    if (section && Object.hasOwn(destinations, section))
      redirect(`/${lang}/${destinations[section]}`);
    if (!section || section === "home") {
      const t = s2Text[lang];
      return (
        <main id="main" className="account-page s2-page">
          <h1>
            {lang === "th"
              ? "เริ่มต้นโอกาสใหม่ในแบบของคุณ"
              : "Your next opportunity starts here"}
          </h1>
          <p>
            {lang === "th"
              ? "ค้นหาได้โดยไม่ต้องสมัคร เมื่อเข้าสู่ระบบ คุณจะบันทึกโอกาสและประเมินความต้องการได้"
              : "Browse without an account. Sign in to save opportunities and explore your needs."}
          </p>
          <p className="notice">{t.demo}</p>
          <HomeMenuGrid
            label={t.search}
            items={[
              {
                href: `/${lang}/opportunities`,
                label: t.search,
                description:
                  lang === "th"
                    ? "สำรวจรายการที่เผยแพร่และยังไม่หมดอายุ"
                    : "Explore published opportunities that are still current",
                art: 0,
                wide: true,
              },
              {
                href: `/${lang}/account`,
                label:
                  lang === "th"
                    ? "บัญชีและความเป็นส่วนตัว"
                    : "Account and privacy",
                description:
                  lang === "th"
                    ? "เข้าสู่ระบบและจัดการข้อมูลของคุณ"
                    : "Sign in and manage your information",
                art: 3,
                wide: true,
              },
            ]}
          />
          <S2HomeMenus lang={lang} canReview={false} />
        </main>
      );
    }
  }
  return (
    <Prototype
      key={section ?? "home"}
      lang={lang}
      role="beneficiary"
      section={section ?? "home"}
      cards={[...entries]
        .filter((e) => e.status === "current")
        .sort(
          (a, b) =>
            Number(b.category === "jobs") - Number(a.category === "jobs"),
        )
        .map((e) => publicEntry(e))}
    />
  );
}
