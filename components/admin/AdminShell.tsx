"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { Footer } from "@/components/ui/Footer";
import { SCHOOL_NAME } from "@/lib/school";

export interface AdminNavItem {
  href: string;
  label: string;
}

export interface AdminAlert {
  label: string;
  count: number;
  href: string;
  tone: "red" | "amber" | "blue";
}

type IconName = "home" | "users" | "scale" | "calendar" | "chart" | "settings" | "bell" | "search" | "menu" | "chevron" | "more" | "x";

const ICONS: Record<IconName, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  users: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6",
  scale: "M12 3v18M5 7h14M5 7l-3 7a3.5 3.5 0 006 0L5 7zM19 7l-3 7a3.5 3.5 0 006 0l-3-7z",
  calendar: "M4 7h16M4 7v12a1 1 0 001 1h14a1 1 0 001-1V7M4 7V6a1 1 0 011-1h14a1 1 0 011 1v1M8 3v4M16 3v4",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  bell: "M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a2 2 0 003.4 0",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
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

/** The full administrator's links, gathered into sections (an account with fewer links just sees them in one list). */
const GROUPS: { key: string; label: string; icon: IconName; hrefs: string[] }[] = [
  { key: "home", label: "الرئيسية", icon: "home", hrefs: ["/admin"] },
  { key: "teachers", label: "المعلمون والملفات", icon: "users", hrefs: ["/admin/teachers", "/admin/teachers/new", "/admin/teachers/import", "/admin/uploads", "/admin/weekly-review", "/admin/staff-files"] },
  { key: "follow", label: "المسائلات والمتابعة", icon: "scale", hrefs: ["/admin/inquiries", "/admin/teacher-performance", "/admin/late-minutes", "/admin/student-referrals"] },
  { key: "schedules", label: "الجداول", icon: "calendar", hrefs: ["/admin/school-schedule", "/admin/substitute-schedule", "/admin/schedule-builder"] },
  { key: "reports", label: "التقارير والإحصائيات", icon: "chart", hrefs: ["/admin/statistics", "/admin/reports", "/admin/school-management"] },
  { key: "system", label: "النظام", icon: "settings", hrefs: ["/admin/activity-log", "/admin/trash", "/admin/settings"] },
];

const TONES: Record<AdminAlert["tone"], string> = {
  red: "bg-red-600 text-white",
  amber: "bg-amber-500 text-white",
  blue: "bg-blue-600 text-white",
};

/** The administration's frame: a header with the quick teacher search and the alerts bell, a sidebar in collapsible
 *  sections (a bottom bar on a phone), and a trail showing where you are. */
export function AdminShell({
  title,
  userName,
  navItems,
  alerts,
  bellCount,
  grouped,
  demoViewOnly = false,
  children,
}: {
  title: string;
  userName: string;
  navItems: AdminNavItem[];
  alerts: AdminAlert[];
  /** The number on the bell (the alerts overlap, so it is not their sum). */
  bellCount: number;
  /** The full administrator gets the sections, the search and the bottom bar; a scoped account keeps a plain list. */
  grouped: boolean;
  demoViewOnly?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // the link of the page you are on: the most specific one that matches
  const active = useMemo(() => {
    const matches = navItems.filter((n) => {
      const path = n.href.split("?")[0];
      return pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
    });
    return matches.sort((a, b) => b.href.split("?")[0].length - a.href.split("?")[0].length)[0];
  }, [navItems, pathname]);

  const sections = useMemo(() => {
    if (!grouped) return [{ key: "all", label: "", icon: "menu" as IconName, items: navItems }];
    const placed = new Set<string>();
    const result = GROUPS.map((g) => {
      const items = navItems.filter((n) => g.hrefs.includes(n.href.split("?")[0]));
      items.forEach((i) => placed.add(i.href));
      return { key: g.key, label: g.label, icon: g.icon, items };
    }).filter((g) => g.items.length > 0);
    const rest = navItems.filter((n) => !placed.has(n.href));
    if (rest.length > 0) result.push({ key: "other", label: "أخرى", icon: "menu", items: rest });
    return result;
  }, [navItems, grouped]);

  const totalAlerts = bellCount;
  const isOpen = (key: string, hasActive: boolean) => openGroups[key] ?? hasActive;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 overflow-x-hidden print:block print:overflow-visible print:bg-white">
      <div className="no-print h-1.5 w-full shrink-0 bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-accent)]" />
      {demoViewOnly && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span>🔒 حساب عرض فقط -- لا يمكن إضافة أو حذف أو تعديل أي شيء</span>
          <Link href="/teacher" className="rounded-lg border border-amber-400 dark:border-amber-700 px-2.5 py-1 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/60">
            التبديل لعرض المعلم
          </Link>
        </div>
      )}

      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 sm:px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setDrawer(true)}
            aria-label="فتح القائمة"
            className="shrink-0 rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <Icon name="menu" size={22} />
          </button>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Image src="/moe-logo.png" alt="شعار وزارة التعليم" width={70} height={40} className="h-7 w-auto object-contain" />
            <Image src="/athar-emblem.png" alt="شعار أثر" width={70} height={70} className="h-8 w-auto object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-50">{title}</h1>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {SCHOOL_NAME} · مرحبًا، {userName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {grouped && <TeacherSearch onPick={(id) => router.push(`/admin/teachers/${id}`)} />}
          {grouped && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((v) => !v)}
                aria-label="التنبيهات"
                className="relative rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Icon name="bell" size={20} />
                {totalAlerts > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {totalAlerts > 99 ? "99+" : totalAlerts}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40 cursor-default" onClick={() => setBellOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                    <p className="border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-50">يحتاج انتباهك</p>
                    {alerts.filter((a) => a.count > 0).length === 0 ? (
                      <p className="px-4 py-4 text-sm text-slate-500">ما فيه شي ينتظرك الحين ✓</p>
                    ) : (
                      <ul>
                        {alerts
                          .filter((a) => a.count > 0)
                          .map((a) => (
                            <li key={a.label}>
                              <Link href={a.href} onClick={() => setBellOpen(false)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                                <span className="text-slate-700 dark:text-slate-200">{a.label}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${TONES[a.tone]}`}>{a.count}</span>
                              </Link>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <SignOutButton />
        </div>
      </header>

      <div className="relative flex flex-1 print:block">
        {drawer && <div className="fixed inset-0 z-30 bg-black/40 md:hidden no-print" onClick={() => setDrawer(false)} />}

        <nav
          className={`no-print fixed inset-y-0 right-0 z-40 w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 md:static md:z-auto md:w-64 md:translate-x-0 ${
            drawer ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between md:hidden">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-50">القائمة</span>
            <button onClick={() => setDrawer(false)} aria-label="إغلاق" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Icon name="x" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {sections.map((section) => {
              const hasActive = section.items.some((i) => i.href === active?.href);
              const single = !grouped || section.items.length === 1;
              if (single) {
                return section.items.map((item) => (
                  <NavLink key={item.href} item={item} active={item.href === active?.href} icon={grouped ? section.icon : undefined} onClick={() => setDrawer(false)} />
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
                        <NavLink key={item.href} item={item} active={item.href === active?.href} onClick={() => setDrawer(false)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <main className={`min-w-0 flex-1 p-4 sm:p-6 ${grouped ? "pb-24 md:pb-6" : ""}`}>
          {active && active.href !== "/admin" && (
            <p className="no-print mb-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Link href="/admin" className="hover:text-[var(--brand-primary)] hover:underline">
                الرئيسية
              </Link>
              <span>›</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{active.label}</span>
            </p>
          )}
          {children}
        </main>
      </div>

      {grouped && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur md:hidden">
          {[
            { href: "/admin", label: "الرئيسية", icon: "home" as IconName, badge: 0 },
            { href: "/admin/teachers", label: "المعلمون", icon: "users" as IconName, badge: 0 },
            { href: "/admin/inquiries", label: "المسائلات", icon: "scale" as IconName, badge: (alerts.find((a) => a.href.includes("filter=admin&") || a.href.endsWith("filter=admin"))?.count ?? 0) + (alerts.find((a) => a.href.includes("filter=teacher_late"))?.count ?? 0) },
          ].map((t) => {
            const on = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${on ? "text-[var(--brand-primary)] font-bold" : "text-slate-500 dark:text-slate-400"}`}>
                <Icon name={t.icon} size={22} />
                {t.label}
                {t.badge > 0 && <span className="absolute right-1/2 top-1 translate-x-4 rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{t.badge}</span>}
              </Link>
            );
          })}
          <button type="button" onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
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

function NavLink({ item, active, icon, onClick }: { item: AdminNavItem; active: boolean; icon?: IconName; onClick: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[var(--brand-primary)]/10 font-semibold text-[var(--brand-primary)]"
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {icon && <Icon name={icon} />}
      {item.label}
    </Link>
  );
}

/** Type a teacher's name and go straight to their page. The list is loaded the first time the box is used. */
function TeacherSearch({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; name: string }[] | null>(null);
  const loading = useRef(false);

  useEffect(() => {
    if (!open || teachers || loading.current) return;
    loading.current = true;
    fetch("/api/teachers")
      .then((r) => (r.ok ? r.json() : { teachers: [] }))
      .then((d: { teachers: { id: string; name: string }[] }) => setTeachers(d.teachers.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => setTeachers([]));
  }, [open, teachers]);

  const results = useMemo(() => {
    const text = q.trim();
    if (!text || !teachers) return [];
    return teachers.filter((t) => t.name.includes(text)).slice(0, 8);
  }, [q, teachers]);

  return (
    <div className="relative">
      {open ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5">
          <Icon name="search" size={16} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQ("");
              }
              if (e.key === "Enter" && results[0]) {
                onPick(results[0].id);
                setOpen(false);
                setQ("");
              }
            }}
            placeholder="ابحث عن معلم"
            className="w-32 sm:w-44 bg-transparent text-sm text-slate-900 dark:text-slate-50 outline-none"
          />
          <button type="button" aria-label="إغلاق البحث" onClick={() => { setOpen(false); setQ(""); }} className="text-slate-400 hover:text-slate-600">
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-label="بحث عن معلم" className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Icon name="search" size={20} />
        </button>
      )}
      {open && q.trim() && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          {!teachers ? (
            <p className="px-3 py-3 text-sm text-slate-500">جارٍ التحميل...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">ما لقيت معلم بهذا الاسم</p>
          ) : (
            <ul>
              {results.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(t.id);
                      setOpen(false);
                      setQ("");
                    }}
                    className="block w-full px-3 py-2 text-right text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
