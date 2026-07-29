import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

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
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1.5 w-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-accent)]" />
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="rounded border border-dashed border-slate-300 dark:border-slate-700 px-1.5 py-0.5">
              وزارة التعليم
            </span>
            <span className="rounded border border-dashed border-slate-300 dark:border-slate-700 px-1.5 py-0.5">
              رؤية 2030
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">مرحبًا، {userName}</p>
          </div>
        </div>
        <SignOutButton />
      </header>
      <div className="flex flex-1">
        <nav className="w-56 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)] transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
