import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSchoolManagementCategory, getSchoolFiles } from "@/lib/school-files";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";
import { SchoolFileList } from "@/components/admin/SchoolFileList";
import { DownloadAllFilesButton } from "@/components/admin/DownloadAllFilesButton";

interface DashboardCard {
  href: string;
  label: string;
  description: string;
  accentColor: string;
}

// Only the most-used tools live on the dashboard as cards -- everything else (including these
// five) stays reachable from the sidebar nav (see fullNavItems in app/admin/layout.tsx).
const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/admin/teachers", label: "قائمة المعلمين", description: "استعراض جميع المعلمين ونسب إنجازهم", accentColor: "#2563eb" },
  { href: "/admin/substitute-schedule", label: "جدول الانتظار", description: "إسناد المعلمين المنتظرين لتغطية الحصص", accentColor: "#0d9488" },
  { href: "/admin/statistics", label: "الإحصائيات", description: "نسب رفع الملفات لكل قسم بين المعلمين", accentColor: "#d97706" },
  { href: "/admin/teacher-performance", label: "متابعة أداء المعلمين", description: "الطابور الصباحي، الإشراف، المناوبة، وغيرها", accentColor: "#9333ea" },
  { href: "/admin/school-management", label: "الإنجاز المدرسي", description: "ملفات مدير المدرسة والوكلاء والموجه الطلابي", accentColor: "#7c3aed" },
  { href: "/admin/student-referrals", label: "تحويلات الطلاب", description: "تحويلات المعلمين لوكيل شؤون الطلاب والموجه الطلابي", accentColor: "#b45309" },
];

async function RestrictedDashboard({ categoryKey }: { categoryKey: string }) {
  const category = await getSchoolManagementCategory(categoryKey);
  if (!category) {
    return <p className="text-sm text-red-600 dark:text-red-400">القسم المخصص لهذا الحساب غير موجود.</p>;
  }

  const subsections = category.subsections ?? [{ key: "", labelAr: "" }];

  // The وكيل شؤون الطلاب and الموجه الطلابي accounts also receive student referrals -- surface what's
  // waiting on them right at the top of their only dashboard.
  const waitingStatus =
    categoryKey === "student_affairs_agent" ? "with_agent" : categoryKey === "student_guidance" ? "with_counselor" : null;
  const waitingCount = waitingStatus
    ? ((
        await supabaseAdmin
          .from("student_referrals")
          .select("id", { count: "exact", head: true })
          .eq("status", waitingStatus)
      ).count ?? 0)
    : 0;

  return (
    <div className="max-w-2xl">
      {categoryKey === "teacher_affairs_agent" && (
        <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
            تحميل كل ما رفعه المعلمون (الجدول المدرسي، ملف الإنجاز، وغيرها) في ملف واحد، مجلد لكل معلم.
          </p>
          <DownloadAllFilesButton />
        </div>
      )}
      {waitingStatus && (
        <Link
          href="/admin/student-referrals"
          style={{ borderInlineStartColor: "#b45309", borderInlineStartWidth: 4 }}
          className="mb-6 flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="font-semibold text-slate-900 dark:text-slate-50">تحويلات الطلاب</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap font-medium ${
              waitingCount > 0
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {waitingCount > 0 ? `${waitingCount} بانتظارك` : "لا يوجد جديد"}
          </span>
        </Link>
      )}
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
        <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.accentColor }} />
        {category.labelAr}
      </h2>
      <div className="flex flex-col gap-6">
        {await Promise.all(
          subsections.map(async (sub) => {
            const files = await getSchoolFiles(category.key, sub.key || null);
            return (
              <div key={sub.key} className="flex flex-col gap-2">
                {sub.labelAr && (
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">{sub.labelAr}</h3>
                )}
                <FileUploadDropzone
                  uploadUrl="/api/school-files/upload"
                  extraFields={{ category: category.key, subcategory: sub.key }}
                />
                <SchoolFileList files={files} />
              </div>
            );
          })
        )}
        {category.subsections &&
          (await (async () => {
            // A general bucket for files that don't fit any one subsection above (subcategory
            // null) -- also where files uploaded before this category had subsections still live.
            const generalFiles = await getSchoolFiles(category.key, null);
            return (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">ملفات عامة</h3>
                <FileUploadDropzone
                  uploadUrl="/api/school-files/upload"
                  extraFields={{ category: category.key, subcategory: "" }}
                />
                <SchoolFileList files={generalFiles} />
              </div>
            );
          })())}
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const session = await auth();
  const restrictedCategory = session?.user?.restrictedCategory;

  if (restrictedCategory) {
    return <RestrictedDashboard categoryKey={restrictedCategory} />;
  }

  // A teacher granted only جدول مدرسي access (e.g. مؤيد) has exactly one admin tool -- send them
  // straight there instead of showing the full dashboard, most of which middleware would 403 anyway.
  if (session?.user?.role === "teacher" && session?.user?.canBuildSchedule) {
    redirect("/admin/schedule-builder");
  }

  const { count: teacherCount } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "teacher")
    .is("deleted_at", null);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">لوحة تحكم الإدارة</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DASHBOARD_CARDS.filter((card) => card.href !== "/admin/student-referrals" || session?.user?.role === "manager").map((card, index) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              borderInlineStartColor: card.accentColor,
              borderInlineStartWidth: 4,
              animationDelay: `${index * 45}ms`,
            }}
            className="animate-fade-in-up group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
                  style={{ backgroundColor: card.accentColor }}
                />
                {card.label}
              </h3>
              {card.href === "/admin/teachers" && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium"
                  style={{ backgroundColor: `${card.accentColor}1a`, color: card.accentColor }}
                >
                  {teacherCount ?? 0} معلم
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
