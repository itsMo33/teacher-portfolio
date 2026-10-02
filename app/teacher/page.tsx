import Link from "next/link";
import { auth } from "@/lib/auth/auth-options";
import {
  getSlotCounts,
  getHasSchedule,
  getUnviewedAdminSectionKeys,
  getHasUnviewedSchedule,
  getProfessionalLicenseExempt,
} from "@/lib/portfolio-data";
import { TEACHER_COMPLETION_SLOTS, TOTAL_TEACHER_COMPLETION_SLOTS } from "@/lib/portfolio-sections";
import { getSchoolManagementCategory } from "@/lib/school-files";
import { getFilesNeedingRevision } from "@/lib/weekly-review";
import { ProgressGrid } from "@/components/portfolio/ProgressGrid";

export default async function TeacherDashboard() {
  const session = await auth();
  const [slotCounts, hasSchedule, unviewedSectionKeys, hasUnviewedSchedule, professionalLicenseExempt, filesNeedingRevision] = await Promise.all([
    getSlotCounts(session!.user.id),
    getHasSchedule(session!.user.id),
    getUnviewedAdminSectionKeys(session!.user.id),
    getHasUnviewedSchedule(session!.user.id),
    getProfessionalLicenseExempt(session!.user.id),
    getFilesNeedingRevision(session!.user.id),
  ]);

  const restrictedCategoryLabel = session!.user.restrictedCategory
    ? (await getSchoolManagementCategory(session!.user.restrictedCategory))?.labelAr ?? session!.user.restrictedCategory
    : null;

  const completionPercent = Math.round(
    (TEACHER_COMPLETION_SLOTS.reduce((sum, slot) => {
      const count = slotCounts[`${slot.section}:${slot.subsection ?? ""}`] ?? 0;
      return sum + Math.min(count / slot.requiredCount, 1);
    }, 0) /
      TOTAL_TEACHER_COMPLETION_SLOTS) *
      100
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          مرحبًا، {session!.user.name} 👋
        </h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
            completionPercent > 0
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          }`}
        >
          نسبة الإنجاز: {completionPercent}%
        </span>
      </div>
      {session!.user.restrictedCategory && (
        <Link
          href="/admin"
          className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg w-fit"
        >
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
          <span className="font-semibold text-slate-900 dark:text-slate-50">
            إدارة قسم: {restrictedCategoryLabel}
          </span>
        </Link>
      )}
      {filesNeedingRevision.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            ملفات رجّعها لك المراجعون وتحتاج تعديل ({filesNeedingRevision.length})
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {filesNeedingRevision.map((f) => (
              <li key={f.id}>
                <Link href={`/teacher/portfolio/${f.category}`} className="font-medium text-amber-900 dark:text-amber-100 hover:underline">
                  {f.fileName}
                </Link>
                <span className="text-xs text-amber-700 dark:text-amber-300"> -- {f.sectionLabel}</span>
                {f.note && <p className="text-xs text-amber-700 dark:text-amber-300">المطلوب: {f.note}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 dark:text-amber-300">ارفع النسخة المعدّلة في نفس القسم، ويمكنك حذف القديمة.</p>
        </div>
      )}
      <Link
        href="/teacher/student-referrals"
        style={{ borderInlineStartColor: "#b45309", borderInlineStartWidth: 4 }}
        className="mb-4 flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-600" />
          تحويل الطالب لوكيل شؤون الطلاب
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          نموذج إلكتروني لتحويل طالب (ضعف دراسي، غياب، سلوك...) مع طباعة وإرسال
        </span>
      </Link>
      <ProgressGrid
        slotCounts={slotCounts}
        linkPrefix="/teacher/portfolio"
        hasSchedule={hasSchedule}
        unviewedSectionKeys={unviewedSectionKeys}
        hasUnviewedSchedule={hasUnviewedSchedule}
        professionalLicenseExempt={professionalLicenseExempt}
      />
    </div>
  );
}
