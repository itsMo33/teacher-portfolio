import { auth } from "@/lib/auth/auth-options";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { getSchoolManagementCategory } from "@/lib/school-files";
import { canReview } from "@/lib/weekly-review";
import { getReferralActor } from "@/lib/student-referrals";

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
  { href: "/admin/weekly-review", label: "مراجعة الأسبوع" },
  { href: "/admin/student-referrals", label: "تحويلات الطلاب" },
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
  // A teacher-role account reaching /admin (scoped category or جدول مدرسي access) also gets a way back
  // to its own dashboard -- otherwise this sidebar is a dead end.
  const teacherHome: NavItem[] = session?.user?.role === "teacher" ? [{ href: "/teacher", label: "لوحة المعلم" }] : [];

  // The class-time tracker is a grant on top of whatever else the account is; full admins already have it
  // inside متابعة أداء المعلمين.
  const classTimeNav: NavItem[] =
    session?.user?.canTrackClassTime && (session.user.role === "teacher" || restrictedCategory)
      ? [{ href: "/admin/class-time", label: "الالتزام بزمن الحصة" }]
      : [];

  const navItems: NavItem[] = restrictedCategory
    ? [
        ...teacherHome,
        { href: "/admin", label: (await getSchoolManagementCategory(restrictedCategory))?.labelAr ?? "لوحة تحكم" },
        ...(restrictedCategory === "student_affairs_agent" || restrictedCategory === "student_guidance"
          ? [{ href: "/admin/student-referrals", label: "تحويلات الطلاب" }]
          : []),
        ...classTimeNav,
        ...(canBuildSchedule ? [{ href: "/admin/schedule-builder", label: "جدول مدرسي" }] : []),
      ]
    : canBuildSchedule || classTimeNav.length > 0
      ? [
          ...teacherHome,
          ...classTimeNav,
          ...(canBuildSchedule ? [{ href: "/admin/schedule-builder", label: "جدول مدرسي" }] : []),
        ]
      : fullNavItems.filter((item) => {
          if (item.href === "/admin/student-referrals") return !!session && getReferralActor(session.user) === "viewer";
          if (item.href === "/admin/weekly-review") return !!session && canReview(session.user);
          return true;
        });

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
