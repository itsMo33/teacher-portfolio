import { auth } from "@/lib/auth/auth-options";
import { AppShell, type NavItem } from "@/components/ui/AppShell";

const navItems: NavItem[] = [
  { href: "/admin", label: "قائمة المعلمين" },
  { href: "/admin/uploads", label: "رفع ملفات للمعلمين" },
  { href: "/admin/substitute-schedule", label: "جدول الانتظار" },
  { href: "/admin/teachers/new", label: "إضافة معلم" },
  { href: "/admin/teachers/import", label: "استيراد معلمين" },
  { href: "/admin/statistics", label: "الإحصائيات" },
  { href: "/admin/reports", label: "تصدير تقرير" },
  { href: "/admin/school-management", label: "إدارة المدرسة" },
  { href: "/admin/activity-log", label: "سجل النشاط" },
  { href: "/admin/trash", label: "سلة المحذوفات" },
  { href: "/admin/settings", label: "الإعدادات" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell title="بوابة الإدارة" userName={session?.user?.name ?? ""} navItems={navItems}>
      {children}
    </AppShell>
  );
}
