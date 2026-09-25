import { auth } from "@/lib/auth/auth-options";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { getSchoolManagementCategory } from "@/lib/school-files";

const fullNavItems: NavItem[] = [
  { href: "/admin", label: "لوحة تحكم" },
  { href: "/admin/teachers", label: "قائمة المعلمين" },
  { href: "/admin/uploads", label: "رفع ملفات للمعلمين" },
  { href: "/admin/substitute-schedule", label: "جدول الانتظار" },
  { href: "/admin/schedule-builder", label: "جدول مدرسي" },
  { href: "/admin/teacher-performance", label: "متابعة أداء المعلمين" },
  { href: "/admin/teachers/new", label: "إضافة معلم" },
  { href: "/admin/teachers/import", label: "استيراد معلمين" },
  { href: "/admin/statistics", label: "الإحصائيات" },
  { href: "/admin/accountability", label: "المسائلات" },
  { href: "/admin/reports", label: "تصدير تقرير" },
  { href: "/admin/school-management", label: "الإنجاز المدرسي" },
  { href: "/admin/activity-log", label: "سجل النشاط" },
  { href: "/admin/trash", label: "سلة المحذوفات" },
  { href: "/admin/settings", label: "الإعدادات" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const restrictedCategory = session?.user?.restrictedCategory;
  const canBuildSchedule = session?.user?.canBuildSchedule;

  // A scoped account (e.g. الأمن والسلامة) only ever sees its own single section -- no other
  // admin tool exists for it, in the sidebar or otherwise. A teacher granted جدول مدرسي access
  // (e.g. مؤيد) gets that one tool instead; the two capabilities combine if an account has both.
  const navItems: NavItem[] = restrictedCategory
    ? [
        { href: "/admin", label: (await getSchoolManagementCategory(restrictedCategory))?.labelAr ?? "لوحة تحكم" },
        ...(canBuildSchedule ? [{ href: "/admin/schedule-builder", label: "جدول مدرسي" }] : []),
      ]
    : canBuildSchedule
      ? [{ href: "/admin/schedule-builder", label: "جدول مدرسي" }]
      : fullNavItems;

  return (
    <AppShell
      title="أثر"
      userName={session?.user?.name ?? ""}
      navItems={navItems}
      demoViewOnly={session?.user?.demoViewOnly}
    >
      {children}
    </AppShell>
  );
}
