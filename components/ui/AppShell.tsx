"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignOutButton } from "./SignOutButton";
import { Footer } from "./Footer";
import { SCHOOL_NAME } from "@/lib/school";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  title,
  userName,
  navItems,
  children,
}: {
  title: string;
  userName: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      <div className="no-print h-1.5 w-full shrink-0 bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-accent)]" />
      <header className="no-print flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-6 py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="فتح القائمة"
            className="shrink-0 rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Image src="/moe-logo.png" alt="شعار وزارة التعليم" width={70} height={40} className="h-7 w-auto object-contain sm:h-8 transition-transform duration-300 hover:scale-110" />
            <Image src="/vision2030-logo.png" alt="رؤية 2030" width={70} height={70} className="h-8 w-auto object-contain sm:h-9 transition-transform duration-300 hover:scale-110" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-50 sm:text-lg">{title}</h1>
            <p className="truncate text-[11px] text-slate-400">{SCHOOL_NAME}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">مرحبًا، {userName}</p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <div className="relative flex flex-1">
        {menuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <nav
          className={`no-print fixed inset-y-0 right-0 z-40 w-64 shrink-0 border-l border-slate-200 bg-white p-4 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 md:static md:z-auto md:w-56 md:translate-x-0 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <ul className="flex flex-col gap-1">
            {navItems.map((item, index) => (
              <li key={item.href} className="animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition-all duration-150 hover:translate-x-[-4px] hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <div className="no-print">
        <Footer />
      </div>
    </div>
  );
}
