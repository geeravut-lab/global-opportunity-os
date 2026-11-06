import Link from "@/components/busy-link";
import { Icon } from "./icon";
import { demoNav, demoHref, demoText, type DemoRole } from "@/lib/prototype";
import { authText, accountSections } from "@/lib/auth/copy";
import { platformCopy, platformSections } from "@/lib/platform/copy";
import { s2Text } from "@/lib/s2/copy";
export interface HomeMenuItem {
  href: string;
  label: string;
  description: string;
  art: number;
  wide?: boolean;
  tone?: number;
  demo?: boolean;
}
const captions = {
  th: {
    opportunities: "ค้นหาเส้นทางและบริการที่เหมาะกับคุณ",
    navigator: "สำรวจแนวทางและคำแนะนำตัวอย่าง",
    applications: "ดูขั้นตอนและความคืบหน้าตัวอย่าง",
    plan: "ค่อย ๆ ก้าวไปสู่เป้าหมายของคุณ",
    referrals: "ค้นหาความช่วยเหลือและเครือข่าย",
    messages: "ติดตามเรื่องสำคัญในที่เดียว",
    saved: "กลับมาดูโอกาสที่คุณสนใจ",
    profile: "ข้อมูลของคุณในแบบที่คุณควบคุมได้",
    catalog: "ดูแลโอกาสและรายการบริการ",
    cases: "ติดตามงานและการช่วยเหลือตัวอย่าง",
    team: "พื้นที่ทำงานสำหรับทีมของคุณ",
    impact: "มองเห็นผลลัพธ์และการเปลี่ยนแปลง",
    verification: "ตรวจข้อมูลและความน่าเชื่อถือ",
    settings: "ดูแลพื้นที่ของคุณให้น่าใช้",
    organizations: "ดูแลองค์กรและสิทธิ์สมาชิก",
    security: "ปกป้องบัญชีและการเข้าถึง",
    privacy: "อ่านประกาศและประวัติการให้สิทธิ์",
    delegations: "เลือกผู้ช่วยและกำหนดขอบเขตสิทธิ์",
    invitations: "ตรวจคำเชิญก่อนเข้าร่วมองค์กร",
    notifications: "รับรู้เมื่อมีเรื่องของคุณเปลี่ยนแปลง",
    branding: "เปลี่ยนโลโก้ ไอคอน และชื่อที่แสดง",
    features: "เปิดหรือหยุดฟีเจอร์ที่พร้อมใช้งาน",
    admins: "ดูแลสิทธิ์ผู้ดูแลแพลตฟอร์ม",
    audit: "ย้อนดูว่าใครเปลี่ยนแปลงอะไร",
    assessment: "เริ่มจากเป้าหมายเล็ก ๆ ของคุณ",
  },
  en: {
    opportunities: "Find paths and services that fit your needs",
    navigator: "Explore example guidance and next steps",
    applications: "View example steps and application progress",
    plan: "Take small steps towards your goals",
    referrals: "Explore support and community connections",
    messages: "Keep important updates together",
    saved: "Return to opportunities that interest you",
    profile: "Your information, under your control",
    catalog: "Care for opportunity and service listings",
    cases: "Explore example support and case workflows",
    team: "A shared place for your team",
    impact: "See outcomes and positive change",
    verification: "Review information and trust",
    settings: "Make your workspace work for you",
    organizations: "Manage organizations and member access",
    security: "Protect your account and access",
    privacy: "Read notices and permission history",
    delegations: "Choose helpers and their permissions",
    invitations: "Review invitations before joining",
    notifications: "Know when something relevant changes",
    branding: "Update the logo, icon and displayed names",
    features: "Enable or pause available features",
    admins: "Manage platform administrator permissions",
    audit: "Review who changed what",
    assessment: "Start with a small goal of your own",
  },
};
const arts: Record<string, number> = {
  opportunities: 0,
  assessment: 1,
  plan: 2,
  profile: 3,
  navigator: 4,
  messages: 5,
  referrals: 6,
  applications: 7,
  organizations: 8,
  catalog: 0,
  verification: 9,
  cases: 6,
  team: 10,
  impact: 11,
  audit: 12,
  settings: 13,
  branding: 13,
  security: 14,
  notifications: 15,
  saved: 2,
  privacy: 14,
  delegations: 10,
  invitations: 7,
  features: 13,
  admins: 10,
};
export function HomeMenuGrid({
  items,
  label,
}: {
  items: HomeMenuItem[];
  label: string;
}) {
  return (
    <section className="home-menu-grid" aria-label={label}>
      {items.map((it, i) => (
        <Link
          href={it.href}
          key={it.href}
          className={`home-menu-card card-tone-${it.tone ?? i % 6} ${it.wide ? "is-wide" : ""}`}
        >
          <div className="home-card-copy">
            <h2>{it.label}</h2>
            <p>{it.description}</p>
            {it.demo && (
              <span className="home-demo-label">
                {label === "เมนูหลัก"
                  ? "ต้นแบบ · ข้อมูลสมมติ"
                  : "Demo · Fictional data"}
              </span>
            )}
          </div>
          <span
            className="menu-art"
            aria-hidden="true"
            style={{
              backgroundPosition: `${((it.art % 4) * 100) / 3}% ${(Math.floor(it.art / 4) * 100) / 3}%`,
            }}
          />
          <span className="home-card-arrow" aria-hidden="true">
            <Icon name="arrow" />
          </span>
        </Link>
      ))}
    </section>
  );
}
export function DemoHomeMenus({
  lang,
  role,
}: {
  lang: "th" | "en";
  role: DemoRole;
}) {
  const c = captions[lang];
  const entries = demoNav[role].filter((i) => i.id !== "home");
  const items: HomeMenuItem[] = entries.map((it, i) => ({
    href: demoHref(lang, role, it.id),
    label: it.label[lang],
    description: c[it.id as keyof typeof c] ?? c.settings,
    art: arts[it.id] ?? 13,
    wide: i === 0 || i === 3 || i === entries.length - 1,
    demo: it.id !== "opportunities",
  }));
  return <HomeMenuGrid items={items} label={demoText[lang].mainNav} />;
}
export function AccountHomeMenus({
  lang,
  s2 = false,
}: {
  lang: "th" | "en";
  s2?: boolean;
}) {
  const c = captions[lang];
  return (
    <HomeMenuGrid
      label={demoText[lang].mainNav}
      items={[
        ...accountSections
          .filter((s) => s !== "home")
          .map((s, i) => ({
            href: `/${lang}/account/${s}`,
            label: authText[lang][s],
            description: c[s],
            art: arts[s],
            wide: i === 0 || i === 3,
          })),
        ...(s2
          ? (
              [
                "assessment",
                "bookmarks",
                "matches",
                "organizations",
                "catalog",
              ] as const
            ).map((s, i) => ({
              href: `/${lang}/workspace/${s}`,
              label: s2Text[lang][s],
              description: s2Text[lang].home,
              art: [1, 5, 0, 7, 8][i],
              wide: i === 0,
            }))
          : []),
      ]}
    />
  );
}
export function AdminHomeMenus({
  lang,
  s2 = false,
}: {
  lang: "th" | "en";
  s2?: boolean;
}) {
  const c = captions[lang];
  return (
    <HomeMenuGrid
      label={demoText[lang].mainNav}
      items={[
        { href: `/${lang}/admin/policy`, label: lang === "th" ? "Policy และทีมผู้ตรวจ" : "Policy and review team", description: lang === "th" ? "notice ระยะเก็บ และสิทธิ์เจ้าหน้าที่" : "Notices, retention and staff scopes", art: 3 },
        { href: `/${lang}/admin/purge`, label: lang === "th" ? "คำขอลบข้อมูล" : "Deletion requests", description: lang === "th" ? "ตรวจขอบเขต hold และ restore ledger" : "Review scope, holds and restore ledger", art: 7 },
        ...platformSections.map((s, i) => ({
          href: `/${lang}/admin/${s}`,
          label: platformCopy[lang][s],
          description: c[s],
          art: arts[s],
          wide: i === 0 || i === 3,
        })),
        ...(s2
          ? [
              {
                href: `/${lang}/workspace/review`,
                label: s2Text[lang].review,
                description: s2Text[lang].organizations,
                art: 7,
                wide: true,
              },
            ]
          : []),
      ]}
    />
  );
}

export function S2HomeMenus({
  lang,
  canReview,
}: {
  lang: "th" | "en";
  canReview: boolean;
}) {
  const t = s2Text[lang];
  const sections = [
    "assessment",
    "bookmarks",
    "matches",
    "organizations",
    "catalog",
    "review",
  ] as const;
  const descriptions = {
    th: [
      "เลือกตอบเท่าที่สะดวก และกลับมาแก้ไขได้",
      "กลับมาดูโอกาสที่คุณสนใจ",
      "ดูเกณฑ์และเหตุผล พร้อมค้นหาด้วยตนเอง",
      "ดูแลองค์กรและส่งหลักฐานส่วนตัว",
      "สร้างและส่งรายการให้ผู้ตรวจพิจารณา",
      "ตรวจองค์กรและโอกาสก่อนเผยแพร่",
    ],
    en: [
      "Answer what you choose and edit later",
      "Return to opportunities that interest you",
      "See criteria and reasons, or search on your own",
      "Manage organizations and private evidence",
      "Create listings and send them for review",
      "Review organizations and listings before publication",
    ],
  };
  return (
    <HomeMenuGrid
      label={demoText[lang].mainNav}
      items={sections.flatMap((section, i) =>
        section === "review" && !canReview
          ? []
          : [
              {
                href: `/${lang}/workspace/${section}`,
                label: t[section],
                description: descriptions[lang][i],
                art: [1, 2, 4, 8, 0, 9][i],
                wide: i === 0 || section === "review",
              },
            ],
      )}
    />
  );
}
