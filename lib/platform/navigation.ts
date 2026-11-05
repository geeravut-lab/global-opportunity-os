import { demoHref, demoNav, safeSection, type DemoRole } from "@/lib/prototype";
import { accountSections, authText } from "@/lib/auth/copy";
import { platformCopy, platformSections } from "./copy";
import { s3Copy } from "../s3/copy";
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
  workflow: { enabled?: boolean; hasOrg?: boolean; canRoute?: boolean } = {},
): NavEntry[] {
  const flowEntry = {
    href: `/${lang}/workflow`,
    label: s3Copy[lang].home,
    icon: "clipboard",
    active: false,
  };
  if (/^\/(th|en)\/workflow(\/|$)/.test(pathname)) {
    return (
      [
        "home",
        "applications",
        ...(workflow.hasOrg ? ["queue"] : []),
        ...(workflow.canRoute ? ["team", "automation"] : []),
        "settings",
        ...(canReview || workflow.canRoute ? ["delivery"] : []),
      ] as const
    ).map((key) => ({
      href: `/${lang}/workflow${key === "home" ? "" : "/" + key}`,
      label:
        s3Copy[lang][
          key as
            | "home"
            | "applications"
            | "queue"
            | "team"
            | "automation"
            | "settings"
            | "delivery"
        ],
      icon: key === "home" ? "home" : "clipboard",
      active:
        pathname === `/${lang}/workflow${key === "home" ? "" : "/" + key}`,
    }));
  }
  if (/^\/(th|en)\/workspace(\/|$)/.test(pathname))
    return [
      ...(workflow.enabled ? [flowEntry] : []),
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
      ...(workflow.enabled ? [flowEntry] : []),
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
      ...(workflow.enabled ? [flowEntry] : []),
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
  const publicS2 = s2 && role === "beneficiary";
  const destinations: Record<string, string> = {
    assessment: "workspace/assessment",
    saved: "workspace/bookmarks",
    profile: "account/profile",
  };
  return [
    ...demoNav[role]
      .filter(
        (s) =>
          !publicS2 ||
          ["home", "opportunities", "assessment", "saved", "profile"].includes(
            s.id,
          ),
      )
      .map((s) => ({
        href:
          publicS2 && destinations[s.id]
            ? `/${lang}/${destinations[s.id]}`
            : demoHref(lang, role, s.id),
        label: s.label[lang],
        icon: s.icon,
        active: current === s.id,
      })),
    ...(workflow.enabled ? [flowEntry] : []),
  ];
}
export function backTarget(pathname: string, from: string | null) {
  const locale = pathname.startsWith("/en") ? "en" : "th";
  const parents: [RegExp, string][] = [
    [/^\/(th|en)\/workflow\/.+$/, `/${locale}/workflow`],
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
