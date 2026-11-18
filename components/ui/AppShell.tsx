"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import { Footer } from "./Footer";
import { SCHOOL_NAME } from "@/lib/school";

export interface NavItem {
  href: string;
  label: string;
}

type IconName = "home" | "folder" | "scale" | "calendar" | "settings" | "menu" | "chevron" | "more" | "x";

const ICONS: Record<IconName, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  scale: "M12 3v18M5 7h14M5 7l-3 7a3.5 3.5 0 006 0L5 7zM19 7l-3 7a3.5 3.5 0 006 0l-3-7z",
  calendar: "M4 7h16M4 7v12a1 1 0 001 1h14a1 1 0 001-1V7M4 7V6a1 1 0 011-1h14a1 1 0 011 1v1M8 3v4M16 3v4",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  menu: "M4 6h16M4 12h16M4 18h16",
  chevron: "M6 9l6 6 6-6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  x: "M6 6l12 12M18 6L6 18",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** The teacher's links, gathered into sections like the administration's sidebar. */
const FILE_KEYS = [
  "achievement_file",
  "weekly_term_plan",
  "weekly_plan_admin",
  "teaching_strategies",
  "learning_outcomes",
  "parent_interaction",
  "professional_community",
  "achievements",
  "meetings_and_visits",
  "tasks_assignments",
  "general_files",
];
const GROUPS: { key: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { key: "home", label: "الرئيسية", icon: "home", match: (p) => p === "/teacher" },
  { key: "files", label: "ملفاتي", icon: "folder", match: (p) => FILE_KEYS.some((k) => p === `/teacher/portfolio/${k}`) },
  { key: "inquiries", label: "المسائلات والاستئذان", icon: "scale", match: (p) => p === "/teacher/portfolio/accountability" || p === "/teacher/portfolio/excuse_request" },
  { key: "schedules", label: "الجداول والتحويل", icon: "calendar", match: (p) => p === "/teacher/schedule" || p === "/teacher/student-referrals" || p.startsWith("/admin/") },
  { key: "settings", label: "الإعدادات", icon: "settings", match: (p) => p === "/teacher/settings" },
];

/** The frame of the teacher's pages: a header, a sidebar in collapsible sections (a bottom bar on a phone). */
export function AppShell({
  title,
  userName,
  navItems,
  demoViewOnly = false,
  children,
}: {
  title: string;
  userName: string;
  navItems: NavItem[];
  /** Presentation account: can browse both /teacher and /admin, but every write is blocked server-side. */
  demoViewOnly?: boolean;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const isOnAdminSide = pathname.startsWith("/admin");
  // a staff account has only three links: a plain list, no sections and no bottom bar
  const grouped = navItems.some((n) => n.href === "/teacher") && navItems.length > 4;

  const active = useMemo(() => {
    const matches = navItems.filter((n) => pathname === n.href || (n.href !== "/teacher" && pathname.startsWith(`${n.href}/`)));
    return matches.sort((a, b) => b.href.length - a.href.length)[0];
  }, [navItems, pathname]);

  const sections = useMemo(() => {
    if (!grouped) return [{ key: "all", label: "", icon: "menu" as IconName, items: navItems }];
    const placed = new Set<string>();
    const result = GROUPS.map((g) => {
      const items = navItems.filter((n) => g.match(n.href));
      items.forEach((i) => placed.add(i.href));
      return { key: g.key, label: g.label, icon: g.icon, items };
    }).filter((g) => g.items.length > 0);
    const rest = navItems.filter((n) => !placed.has(n.href));
    if (rest.length > 0) result.push({ key: "other", label: "أخرى", icon: "menu", items: rest });
    return result;
  }, [navItems, grouped]);

  const isOpen = (key: string, hasActive: boolean) => openGroups[key] ?? hasActive;
  const inquiriesItem = navItems.find((n) => n.href === "/teacher/portfolio/accountability");
  const inquiriesBadge = Number(inquiriesItem?.label.match(/\((\d+)\)/)?.[1] ?? 0);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] overflow-x-hidden print:block print:overflow-visible print:bg-white">
      <div className="no-print h-1 w-full shrink-0 bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-accent)]" />
      {demoViewOnly && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span>🔒 حساب عرض فقط -- لا يمكن إضافة أو حذف أو تعديل أي شيء</span>
          <Link
            href={isOnAdminSide ? "/teacher" : "/admin"}
            className="rounded-lg border border-amber-400 dark:border-amber-700 px-2.5 py-1 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/60"
          >
            {isOnAdminSide ? "التبديل لعرض المعلم" : "التبديل لعرض الإدارة"}
          </Link>
        </div>
      )}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur px-3 sm:px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="فتح القائمة"
            className="shrink-0 rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <Icon name="menu" size={22} />
          </button>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Image src="/moe-logo.png" alt="شعار وزارة التعليم" width={70} height={40} className="h-7 w-auto object-contain sm:h-8" />
            <Image src="/vision2030-logo.png" alt="رؤية 2030" width={70} height={70} className="h-8 w-auto object-contain sm:h-9" />
            <Image src="/athar-emblem.png" alt="شعار أثر" width={70} height={70} className="h-8 w-auto object-contain sm:h-9" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-50 sm:text-lg">{title}</h1>
            <p className="truncate text-[11px] font-medium text-[var(--brand-primary)]">وثّق عطاءك.. ليبقى أثرك</p>
            <p className="truncate text-[11px] text-slate-400">{SCHOOL_NAME}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden max-w-40 truncate text-xs text-slate-500 dark:text-slate-400 sm:block">{userName}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="relative flex flex-1 print:block">
        {menuOpen && <div className="no-print fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} />}

        <nav
          className={`no-print fixed inset-y-0 right-0 z-40 w-72 shrink-0 overflow-y-auto border-l border-slate-200/70 bg-white p-3 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 md:static md:z-auto md:w-64 md:translate-x-0 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between md:hidden">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-50">القائمة</span>
            <button onClick={() => setMenuOpen(false)} aria-label="إغلاق" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Icon name="x" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {sections.map((section) => {
              const hasActive = section.items.some((i) => i.href === active?.href);
              const single = !grouped || section.items.length === 1;
              if (single) {
                return section.items.map((item) => (
                  <NavLink key={item.href} item={item} active={item.href === active?.href} icon={grouped ? section.icon : undefined} onClick={() => setMenuOpen(false)} />
                ));
              }
              const open = isOpen(section.key, hasActive);
              return (
                <div key={section.key} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((g) => ({ ...g, [section.key]: !open }))}
                    aria-expanded={open}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      hasActive ? "text-[var(--brand-primary)]" : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon name={section.icon} />
                      {section.label}
                    </span>
                    <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
                      <Icon name="chevron" size={16} />
                    </span>
                  </button>
                  {open && (
                    <div className="mr-4 mt-0.5 flex flex-col gap-0.5 border-r border-slate-200 pr-2 dark:border-slate-700">
                      {section.items.map((item) => (
                        <NavLink key={item.href} item={item} active={item.href === active?.href} onClick={() => setMenuOpen(false)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <main className={`min-w-0 flex-1 p-4 sm:p-6 ${grouped ? "pb-24 md:pb-6" : ""}`}>{children}</main>
      </div>

      {grouped && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur md:hidden">
          {[
            { href: "/teacher", label: "الرئيسية", icon: "home" as IconName, badge: 0 },
            { href: "/teacher/portfolio/accountability", label: "المسائلات", icon: "scale" as IconName, badge: inquiriesBadge },
            { href: "/teacher/schedule", label: "الجدول", icon: "calendar" as IconName, badge: 0 },
          ].map((t) => {
            const on = t.href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${on ? "text-[var(--brand-primary)] font-bold" : "text-slate-500 dark:text-slate-400"}`}>
                <Icon name={t.icon} size={22} />
                {t.label}
                {t.badge > 0 && <span className="absolute right-1/2 top-1 translate-x-4 rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{t.badge}</span>}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Icon name="more" size={22} />
            المزيد
          </button>
        </nav>
      )}

      <div className="no-print">
        <Footer />
      </div>
    </div>
  );
}

function NavLink({ item, active, icon, onClick }: { item: NavItem; active: boolean; icon?: IconName; onClick: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-[var(--brand-primary)]/10 font-semibold text-[var(--brand-primary)]" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {icon && <Icon name={icon} />}
      {item.label}
    </Link>
  );
}
