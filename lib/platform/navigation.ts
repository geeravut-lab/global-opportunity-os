import { demoHref, demoNav, safeSection, type DemoRole } from "@/lib/prototype";
import { accountSections, authText } from "@/lib/auth/copy";
import { platformCopy, platformSections } from "./copy";
import { s2Sections, s2Text } from "../s2/copy";
export interface NavEntry {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}
export function navigationFor(
  lang: "th" | "en",
  role: DemoRole,
  pathname: string,
  section: string | null,
  s2 = false,
  canReview = false,
): NavEntry[] {
  if (/^\/(th|en)\/workspace(\/|$)/.test(pathname))
    return [
      ...s2Sections
        .filter((s) => s !== "review" || canReview)
        .map((s) => ({
          href: `/${lang}/workspace${s === "home" ? "" : "/" + s}`,
          label: s2Text[lang][s],
          icon:
            s === "organizations"
              ? "building"
              : s === "assessment"
                ? "clipboard"
                : s === "bookmarks"
                  ? "heart"
                  : "home",
          active:
            pathname === `/${lang}/workspace${s === "home" ? "" : "/" + s}`,
        })),
      {
        href: `/${lang}/account`,
        label: authText[lang].account,
        icon: "user",
        active: false,
      },
    ];
  if (/^\/(th|en)\/admin(\/|$)/.test(pathname))
    return [
      {
        href: `/${lang}/admin`,
        label: platformCopy[lang].platform,
        icon: "home",
        active: pathname === `/${lang}/admin`,
      },
      ...platformSections.map((s) => ({
        href: `/${lang}/admin/${s}`,
        label: platformCopy[lang][s],
        icon:
          s === "branding"
            ? "globe"
            : s === "admins"
              ? "people"
              : s === "audit"
                ? "clipboard"
                : "settings",
        active: pathname === `/${lang}/admin/${s}`,
      })),
      {
        href: `/${lang}/account`,
        label: authText[lang].account,
        icon: "user",
        active: false,
      },
      ...(s2
        ? [
            {
              href: `/${lang}/workspace/review`,
              label: s2Text[lang].review,
              icon: "shield",
              active: false,
            },
          ]
        : []),
    ];
  if (/\/(account|auth)(\/|$)/.test(pathname))
    return [
      ...accountSections.map((s, i) => ({
        href: `/${lang}/account${s === "home" ? "" : "/" + s}`,
        label: authText[lang][s],
        icon:
          [
            "home",
            "user",
            "shield",
            "building",
            "people",
            "clipboard",
            "shield",
            "bell",
          ][i] ?? "clipboard",
        active: pathname === `/${lang}/account${s === "home" ? "" : "/" + s}`,
      })),
      ...(s2
        ? [
            {
              href: `/${lang}/workspace`,
              label: s2Text[lang].home,
              icon: "home",
              active: false,
            },
          ]
        : []),
    ];
  const current =
    pathname.includes("/opportunities") || pathname.includes("/directory/")
      ? "opportunities"
      : safeSection(role, section ?? "home");
  return demoNav[role].map((s) => ({
    href: demoHref(lang, role, s.id),
    label: s.label[lang],
    icon: s.icon,
    active: current === s.id,
  }));
}
export function backTarget(pathname: string, from: string | null) {
  const locale = pathname.startsWith("/en") ? "en" : "th";
  const parents: [RegExp, string][] = [
    [/^\/(th|en)\/workspace\/.+$/, `/${locale}/workspace`],
    [/^\/(th|en)\/admin\/.+$/, `/${locale}/admin`],
    [/^\/(th|en)\/account\/.+$/, `/${locale}/account`],
  ];
  const parent = parents.find(([pattern]) => pattern.test(pathname))?.[1];
  if (!parent) return null;
  const origins: Record<string, string> = {
    account: `/${locale}/account`,
    admin: `/${locale}/admin`,
    home: `/${locale}`,
  };
  const target = from && Object.hasOwn(origins, from) ? origins[from] : parent;
  return target === pathname ? parent : target;
}
