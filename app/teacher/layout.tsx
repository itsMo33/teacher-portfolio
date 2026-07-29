import { auth } from "@/lib/auth/auth-options";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

const navItems: NavItem[] = [
  { href: "/teacher", label: "لوحة التحكم" },
  ...PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule").map((s) => ({
    href: `/teacher/portfolio/${s.key}`,
    label: s.labelAr,
  })),
  { href: "/teacher/schedule", label: "الجدول المدرسي" },
  { href: "/teacher/ai-assistant", label: "المساعد الذكي" },
];

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell title="بوابة المعلم" userName={session?.user?.name ?? ""} navItems={navItems}>
      {children}
    </AppShell>
  );
}
