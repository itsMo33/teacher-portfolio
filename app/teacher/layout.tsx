import { auth } from "@/lib/auth/auth-options";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

function buildNavItems(canBuildSchedule?: boolean): NavItem[] {
  return [
    { href: "/teacher", label: "لوحة التحكم" },
    ...PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule").map((s) => ({
      href: `/teacher/portfolio/${s.key}`,
      label: s.labelAr,
    })),
    { href: "/teacher/schedule", label: "الجدول المدرسي" },
    // A teacher granted جدول مدرسي access (e.g. مؤيد) needs a way into /admin/schedule-builder --
    // that tool lives under /admin, entirely separate from this teacher-side nav, so without this
    // link they'd have no way to reach it short of typing the URL themselves.
    ...(canBuildSchedule ? [{ href: "/admin/schedule-builder", label: "بناء الجدول المدرسي" }] : []),
    { href: "/teacher/settings", label: "الإعدادات" },
  ];
}

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell
      title="أثر"
      userName={session?.user?.name ?? ""}
      navItems={buildNavItems(session?.user?.canBuildSchedule)}
      demoViewOnly={session?.user?.demoViewOnly}
    >
      {children}
    </AppShell>
  );
}
