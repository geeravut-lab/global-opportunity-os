"use client";
import Link from "@/components/busy-link";
import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useBusyRouter as useRouter } from "@/lib/ui/router";
import { LanguageSwitch } from "./language-switch";
import { Icon } from "./icon";
import { LiveSync } from "./live-sync";
import {
  demoHref,
  demoRoles,
  demoText,
  roleNames,
  type DemoRole,
} from "@/lib/prototype";
import { authText } from "@/lib/auth/copy";
import { platformCopy } from "@/lib/platform/copy";
import {
  navigationFor,
  backTarget,
  type NavEntry,
} from "@/lib/platform/navigation";
import {
  imageUrl,
  defaultSettings,
  type PlatformSettings,
} from "@/lib/platform/settings";
function Entries({
  items,
  onNavigate,
}: {
  items: NavEntry[];
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`side-link ${item.active ? "active" : ""}`}
          aria-current={item.active ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </>
  );
}
function ShellContent({
  lang,
  children,
  branding = defaultSettings,
  hasSessionCookie = false,
  s2 = false,
  canReview = false,
  workflow = {},
}: {
  lang: "th" | "en";
  children: React.ReactNode;
  branding?: PlatformSettings;
  hasSessionCookie?: boolean;
  s2?: boolean;
  canReview?: boolean;
  workflow?: {
    enabled?: boolean;
    hasOrg?: boolean;
    canRoute?: boolean;
    coordination?: boolean;
    intake?: boolean;
  };
}) {
  const pathname = usePathname(),
    params = useSearchParams(),
    router = useRouter(),
    pt = platformCopy[lang],
    t = demoText[lang];
  const accountMode =
      /^\/(th|en)\/(account|auth|admin|workspace|workflow|coordination)(\/|$)/.test(
        pathname,
      ),
    adminMode = /^\/(th|en)\/admin(\/|$)/.test(pathname);
  const role: DemoRole = pathname.includes("/demo/partner")
    ? "partner"
    : pathname.includes("/demo/admin")
      ? "admin"
      : "beneficiary";
  const items = navigationFor(
    lang,
    role,
    pathname,
    params.get("section"),
    s2,
    canReview,
    workflow,
  );
  const title = adminMode
      ? pt.platform
      : accountMode
        ? authText[lang].account
        : roleNames[role][lang],
    name = lang === "th" ? branding.name_th : branding.name_en;
  const [open, setOpen] = useState(false),
    [notice, setNotice] = useState(false),
    [canUp, setCanUp] = useState(false),
    [canDown, setCanDown] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    returnFocus = useRef<HTMLElement | null>(null),
    pushed = useRef(false),
    next = useRef<string | null>(null);
  function measure() {
    const n = scroll.current;
    if (n) {
      setCanUp(n.scrollTop > 4);
      setCanDown(n.scrollTop + n.clientHeight < n.scrollHeight - 4);
    }
  }
  function show(trigger: HTMLElement) {
    returnFocus.current = trigger;
    next.current = null;
    if (!pushed.current) {
      window.history.pushState(
        { ...window.history.state, goosMore: true },
        "",
        window.location.href,
      );
      pushed.current = true;
    }
    dialog.current?.showModal();
    setOpen(true);
    requestAnimationFrame(() => {
      const n = scroll.current,
        active = n?.querySelector<HTMLElement>("[aria-current=page]");
      if (n && active)
        n.scrollTop =
          active.offsetTop - n.clientHeight / 2 + active.clientHeight / 2;
      measure();
    });
  }
  function close() {
    if (pushed.current) window.history.back();
    else {
      dialog.current?.close();
      setOpen(false);
      returnFocus.current?.focus();
    }
  }
  useEffect(() => {
    function pop() {
      pushed.current = false;
      dialog.current?.close();
      setOpen(false);
      returnFocus.current?.focus();
      const to = next.current;
      next.current = null;
      if (to) setTimeout(() => router.push(to), 0);
    }
    window.addEventListener("popstate", pop);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("resize", measure);
    };
  }, [router]);
  useEffect(() => {
    const current = dialog.current;
    return () => current?.close();
  }, []);
  function navigate(e: MouseEvent<HTMLDialogElement>) {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (
      !a ||
      !pushed.current ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0 ||
      a.target === "_blank"
    )
      return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("//")) return;
    e.preventDefault();
    next.current = href;
    window.history.back();
  }
  const back = backTarget(pathname, params.get("from"));
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="sidebar-brand brand-image-link" href={`/${lang}`}>
          <Image
            src={imageUrl(branding, "logo")}
            alt={name}
            width={200}
            height={133}
            unoptimized
          />
          <span className="sr-only">{name}</span>
        </Link>
        <p className="sidebar-caption">{title}</p>
        <nav
          className="sidebar-scroll"
          aria-label={accountMode ? title : t.mainNav}
        >
          <Entries items={items} />
        </nav>
        <div className="sidebar-bottom">
          <Icon name="shield" />
          <p>
            {accountMode
              ? lang === "th"
                ? "บัญชีทดสอบ · ตรวจสิทธิ์จากเซิร์ฟเวอร์"
                : "Test accounts · Server-enforced permissions"
              : t.prototypeOnly}
          </p>
        </div>
      </aside>
      <div className="app-workspace">
        <div className="prototype-banner">
          {s2
            ? lang === "th"
              ? "พื้นที่ทดสอบ Opp4All · รองรับการเข้าสู่ระบบ · ใช้ข้อมูลสมมติ"
              : "Opp4All test environment · Sign-in supported · Fictional data"
            : accountMode
              ? authText[lang].development
              : t.prototype}
        </div>
        <header className="app-topbar">
          <div className="topbar-start">
            <button
              className="icon-button menu-toggle"
              type="button"
              aria-label={open ? t.closeMenu : t.menu}
              aria-expanded={open}
              aria-controls="app-navigation"
              onClick={(e) => (open ? close() : show(e.currentTarget))}
            >
              <Icon name="menu" />
            </button>
            <Link href={`/${lang}`} className="mobile-brand">
              <Image
                src={imageUrl(branding, "logo")}
                alt={name}
                width={54}
                height={36}
                unoptimized
              />
            </Link>
            <span className="topbar-title">{title}</span>
          </div>
          {!accountMode && (
            <nav className="role-switch" aria-label={t.switchRole}>
              {demoRoles.map((r) => (
                <Link
                  key={r}
                  href={demoHref(lang, r)}
                  aria-current={r === role ? "page" : undefined}
                >
                  {roleNames[r][lang]}
                </Link>
              ))}
            </nav>
          )}
          <div className="topbar-actions">
            <Link
              className="account-entry"
              href={`/${lang}/account`}
              prefetch={false}
            >
              {accountMode ? authText[lang].account : authText[lang].signIn}
            </Link>
            {!accountMode && (
              <button
                className="icon-button notification-button"
                type="button"
                aria-label={t.notifications}
                aria-expanded={notice}
                aria-controls="top-notifications"
                onClick={() => setNotice(!notice)}
              >
                <Icon name="bell" />
                <span className="notification-dot" />
              </button>
            )}
            <LanguageSwitch lang={lang} />
            {!accountMode && (
              <span className="avatar mini" aria-label={t.fictionalPerson}>
                {lang === "th" ? "อ" : "A"}
              </span>
            )}
          </div>
        </header>
        {notice && (
          <section
            className="notification-popover panel"
            id="top-notifications"
            aria-label={t.notifications}
          >
            <h2>{t.notifications}</h2>
            <p>{t.updateOne}</p>
            <p className="muted">{t.updateTime}</p>
            <button
              className="button primary"
              type="button"
              onClick={() => setNotice(false)}
            >
              {t.markRead}
            </button>
          </section>
        )}
        <LiveSync lang={lang} active={hasSessionCookie} />
        <div className="workspace-content">
          {back && (
            <Link className="back-link" href={back}>
              ‹ {pt.back}{" "}
              {back.includes("/admin") ? pt.platform : authText[lang].account}
            </Link>
          )}
          {children}
        </div>
        <footer className="app-footer">
          <p>
            {lang === "th"
              ? "พันธกิจทั่วโลก · ผู้รับประโยชน์ทุกกลุ่ม · ธุรกิจที่ยั่งยืน"
              : "Worldwide mission · All beneficiary groups · Sustainable business"}
          </p>
          <span>
            {name} · {t.demo}
          </span>
        </footer>
      </div>
      <nav
        className="mobile-bottom-nav"
        aria-label={lang === "th" ? "เมนูลัดมือถือ" : "Mobile shortcuts"}
      >
        {items.slice(0, 4).map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={i.active ? "page" : undefined}
          >
            <Icon name={i.icon} />
            <span>{i.label}</span>
          </Link>
        ))}
        <button
          className="more-button"
          type="button"
          aria-haspopup="dialog"
          aria-controls="app-navigation"
          aria-expanded={open}
          aria-current={
            items.slice(4).some((i) => i.active) ? "true" : undefined
          }
          onClick={(e) => (open ? close() : show(e.currentTarget))}
        >
          <Icon name="menu" />
          <span>{pt.more}</span>
        </button>
      </nav>
      <dialog
        className="nav-sheet"
        id="app-navigation"
        ref={dialog}
        aria-label={pt.more}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClickCapture={navigate}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="sheet-heading">
          <h2>{pt.more}</h2>
          <button
            className="icon-button sidebar-close"
            type="button"
            id="close-navigation"
            aria-label={pt.close}
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-scroll" ref={scroll} onScroll={measure}>
          <nav aria-label={title}>
            <Entries items={items} />
          </nav>
          <div className="sheet-account">
            <Link href={`/${lang}/account`}>{pt.account}</Link>
            <LanguageSwitch lang={lang} />
          </div>
        </div>
        {canUp && (
          <button
            className="sheet-arrow up"
            data-nobusy="true"
            type="button"
            aria-label={pt.scrollUp}
            onClick={() =>
              scroll.current?.scrollBy({
                top: -Math.max(120, scroll.current.clientHeight * 0.6),
                behavior: "smooth",
              })
            }
          >
            ↑
          </button>
        )}
        {canDown && (
          <button
            className="sheet-arrow down"
            data-nobusy="true"
            type="button"
            aria-label={pt.scrollDown}
            onClick={() =>
              scroll.current?.scrollBy({
                top: Math.max(120, scroll.current.clientHeight * 0.6),
                behavior: "smooth",
              })
            }
          >
            ↓
          </button>
        )}
      </dialog>
    </div>
  );
}
export function AppShell(props: {
  lang: "th" | "en";
  children: React.ReactNode;
  branding?: PlatformSettings;
  hasSessionCookie?: boolean;
  s2?: boolean;
  canReview?: boolean;
  workflow?: {
    enabled?: boolean;
    hasOrg?: boolean;
    canRoute?: boolean;
    coordination?: boolean;
    intake?: boolean;
  };
}) {
  return <ShellContent {...props} />;
}
