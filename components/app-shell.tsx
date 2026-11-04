"use client";
import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LanguageSwitch } from "./language-switch";
import { BrandMark, Icon } from "./icon";
import { demoHref, demoNav, demoRoles, demoText, roleNames, safeSection, type DemoRole } from "@/lib/prototype";
import type { Locale } from "@/lib/i18n";
function SectionNavigation({ lang, role, mobile = false, onNavigate }: { lang: Locale; role: DemoRole; mobile?: boolean; onNavigate?: () => void }) {
  const pathname=usePathname(), params=useSearchParams();
  const section=pathname.includes("/opportunities")||pathname.includes("/directory/")?"opportunities":safeSection(role,params.get("section")??"home");
  const items=mobile?(role==="beneficiary"?["home","opportunities","navigator","messages","profile"].map(id=>demoNav[role].find(item=>item.id===id)!):demoNav[role].slice(0,5)):demoNav[role];
  return <nav className={mobile?"mobile-bottom-nav":undefined} aria-label={mobile?(lang==="th"?"เมนูลัดมือถือ":"Mobile shortcuts"):demoText[lang].mainNav}>{items.map(item=><Link key={item.id} href={demoHref(lang,role,item.id)} className={mobile?undefined:`side-link ${section===item.id?"active":""}`} aria-current={section===item.id?"page":undefined} onClick={onNavigate}><Icon name={item.icon}/><span>{item.label[lang]}</span></Link>)}</nav>;
}
function ShellContent({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const role: DemoRole = pathname.includes("/demo/partner") ? "partner" : pathname.includes("/demo/admin") ? "admin" : "beneficiary";
  const [open, setOpen] = useState(false), [notice, setNotice] = useState(false);
  const t = demoText[lang];
  const menuRef=useRef<HTMLButtonElement>(null);
  const closeMenu=()=>{setOpen(false);menuRef.current?.focus();};
  return <div className="app-shell">
    <aside className={`app-sidebar ${open ? "is-open" : ""}`} id="app-navigation" onKeyDown={event=>{if(event.key==="Escape")closeMenu();}}>
      <button id="close-navigation" className="icon-button sidebar-close" type="button" aria-label={t.closeMenu} onClick={closeMenu}><Icon name="close"/></button>
      <Link className="sidebar-brand" href={`/${lang}`} onClick={() => setOpen(false)}><BrandMark /><span>Global<br />Opportunity OS<small>Opportunity for Everyone, Everywhere</small></span></Link>
      <p className="sidebar-caption">{roleNames[role][lang]}</p>
      <Suspense fallback={null}><SectionNavigation lang={lang} role={role} onNavigate={()=>setOpen(false)}/></Suspense>
      <div className="sidebar-bottom"><Icon name="shield" /><p>{t.prototypeOnly}</p></div>
    </aside>
    <div className="app-workspace">
      <div className="prototype-banner">{t.prototype}</div>
      <header className="app-topbar"><div className="topbar-start"><button className="icon-button menu-toggle" ref={menuRef} type="button" aria-expanded={open} aria-controls="app-navigation" aria-label={open?t.closeMenu:t.menu} onClick={()=>{if(open)closeMenu();else{setOpen(true);requestAnimationFrame(()=>document.getElementById("close-navigation")?.focus());}}}><Icon name="menu" /></button><span className="topbar-title">{roleNames[role][lang]}</span></div>
        <nav className="role-switch" aria-label={t.switchRole}>{demoRoles.map((item)=><Link key={item} href={demoHref(lang,item)} aria-current={item===role?"page":undefined}>{roleNames[item][lang]}</Link>)}</nav>
        <div className="topbar-actions"><button type="button" className="icon-button notification-button" aria-label={t.notifications} aria-expanded={notice} aria-controls="top-notifications" onClick={()=>setNotice(!notice)}><Icon name="bell" /><span className="notification-dot" /></button><Suspense fallback={null}><LanguageSwitch lang={lang} /></Suspense><span className="avatar mini" aria-label={t.fictionalPerson}>{lang==="th"?"อ":"A"}</span></div>
      </header>
      {notice&&<section className="notification-popover panel" id="top-notifications" aria-label={t.notifications}><h2>{t.notifications}</h2><p>{t.updateOne}</p><p className="muted">{t.updateTime}</p><button className="button primary" type="button" onClick={()=>setNotice(false)}>{t.markRead}</button></section>}
      <div className="workspace-content">{children}</div>
      <footer className="app-footer"><p>{lang==="th"?"พันธกิจทั่วโลก · ผู้รับประโยชน์ทุกกลุ่ม · ธุรกิจที่ยั่งยืน":"Worldwide mission · All beneficiary groups · Sustainable business"}</p><span>Global Opportunity OS · {t.demo}</span></footer>
    </div>
    <Suspense fallback={null}><SectionNavigation lang={lang} role={role} mobile /></Suspense>
  </div>;
}
export function AppShell(props: { lang: Locale; children: React.ReactNode }) {
  return <ShellContent {...props}/>;
}
