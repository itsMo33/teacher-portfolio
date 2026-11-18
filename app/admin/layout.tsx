import { auth } from "@/lib/auth/auth-options";
import type { NavItem } from "@/components/ui/AppShell";
import { AdminShell, type AdminAlert } from "@/components/admin/AdminShell";
import { getAdminAlerts } from "@/lib/admin-alerts";
import { getSchoolManagementCategory } from "@/lib/school-files";
import { canReview } from "@/lib/weekly-review";
import { getReferralActor } from "@/lib/student-referrals";
import { inquiryAttention, listInquiries, toTeacherView } from "@/lib/inquiries";

const fullNavItems: NavItem[] = [
  { href: "/admin", label: "لوحة تحكم" },
  { href: "/admin/teachers", label: "قائمة المعلمين" },
  { href: "/admin/school-schedule", label: "الجدول المدرسي للشعب" },
  { href: "/admin/uploads", label: "رفع ملفات للمعلمين" },
  { href: "/admin/substitute-schedule", label: "جدول الانتظار" },
  { href: "/admin/schedule-builder", label: "جدول مدرسي" },
  { href: "/admin/teacher-performance", label: "متابعة أداء المعلمين" },
  { href: "/admin/teachers/new", label: "إضافة معلم" },
  { href: "/admin/teachers/import", label: "استيراد معلمين" },
  { href: "/admin/statistics", label: "الإحصائيات" },
  { href: "/admin/reports", label: "تصدير تقرير" },
  { href: "/admin/school-management", label: "الإنجاز المدرسي" },
  { href: "/admin/weekly-review", label: "متابعة ملفات المعلمين" },
  { href: "/admin/inquiries", label: "المسائلات" },
  { href: "/admin/staff-files", label: "ملفات عامة (الإداريين)" },
  { href: "/admin/late-minutes", label: "دقائق تأخر المعلمين" },
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
      ? [
          { href: "/admin/class-time", label: "الالتزام بزمن الحصة" },
          { href: "/admin/school-schedule", label: "الجدول المدرسي" },
        ]
      : [];

  const baseNavItems: NavItem[] = restrictedCategory
    ? [
        ...teacherHome,
        { href: "/admin", label: (await getSchoolManagementCategory(restrictedCategory))?.labelAr ?? "لوحة تحكم" },
        ...(restrictedCategory === "student_affairs_agent" || restrictedCategory === "student_guidance"
          ? [{ href: "/admin/student-referrals", label: "تحويلات الطلاب" }]
          : []),
        ...(restrictedCategory === "inquiries_officer"
          ? [
              { href: "/admin/inquiries?kind=delay", label: "مسائلات تأخير (حضوري)" },
              { href: "/admin/inquiries?kind=absence", label: "مسائلات الغياب" },
              { href: "/admin/inquiries?kind=other", label: "المسائلات الأخرى" },
            ]
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
          if (item.href === "/admin/weekly-review" || item.href === "/admin/inquiries" || item.href === "/admin/late-minutes") return !!session && canReview(session.user);
          return true;
        });

  // Anyone can be sent an inquiry (a restricted agent, رائد, the manager...): once there is one, a link to them appears.
  let ownInquiryNav: NavItem[] = [];
  if (session && session.user.role !== "teacher") {
    const own = (await listInquiries({ teacherId: session.user.id })).map(toTeacherView);
    if (own.length > 0) {
      const attention = inquiryAttention(own);
      const count = attention.toJustify + attention.newResults;
      ownInquiryNav = [{ href: "/admin/my-inquiries", label: count > 0 ? `مسائلاتي (${count})` : "مسائلاتي" }];
    }
  }
  const navItems: NavItem[] = [...baseNavItems, ...ownInquiryNav];

  // The full administrator (no scope, no single-tool grant) gets the sections, the search and the alerts bell.
  const fullAdmin = !!session && !restrictedCategory && !canBuildSchedule && classTimeNav.length === 0 && session.user.role !== "teacher";
  const reviewer = fullAdmin && !!session && canReview(session.user);
  const referralViewer = fullAdmin && !!session && getReferralActor(session.user) === "viewer";
  const counts = fullAdmin ? await getAdminAlerts({ inquiries: reviewer, referrals: referralViewer }) : null;
  const alerts: AdminAlert[] = counts
    ? [
        { label: "مسائلات بانتظار قرارك", count: counts.inquiriesAwaiting, href: "/admin/inquiries?filter=awaiting", tone: "amber" },
        { label: "مسائلات متأخرة عن الرد", count: counts.inquiriesLate, href: "/admin/inquiries?filter=late", tone: "red" },
        { label: "مسائلات لم يفتحها المعلم", count: counts.inquiriesUnopened, href: "/admin/inquiries?filter=unopened", tone: "blue" },
        { label: "تحويلات طلاب لم تُفتح", count: counts.referralsUnopened, href: "/admin/student-referrals", tone: "blue" },
      ]
    : [];

  return (
    <AdminShell
      title="أثر"
      userName={session?.user?.name ?? ""}
      navItems={navItems}
      alerts={alerts}
      bellCount={counts ? counts.inquiriesAwaiting + counts.referralsUnopened : 0}
      grouped={fullAdmin}
      demoViewOnly={session?.user?.demoViewOnly}
    >
      {children}
    </AdminShell>
  );
}
