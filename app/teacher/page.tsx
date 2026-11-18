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
import { inquiryAttention, listInquiries, toTeacherView } from "@/lib/inquiries";
import { getExemptDates } from "@/lib/inquiry-exempt";
import { getRecentClassTimeFlags } from "@/lib/class-time-flags";
import { ProgressGrid } from "@/components/portfolio/ProgressGrid";
import { PushToggle } from "@/components/ui/PushToggle";

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

  const classTimeFlags = await getRecentClassTimeFlags(session!.user.id);
  const ownExempt = (await getExemptDates([{ id: session!.user.id, name: session!.user.name ?? "" }])).get(session!.user.id) ?? [];
  const inquiryNotice = inquiryAttention((await listInquiries({ teacherId: session!.user.id })).map(toTeacherView), ownExempt);

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
      <div className="surface mb-6 flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">مرحبًا بك</p>
          <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">المعلم {session!.user.name}</h2>
        </div>
        <div className="relative grid h-20 w-20 shrink-0 place-items-center" role="img" aria-label={`نسبة الإنجاز ${completionPercent}%`}>
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-slate-100 dark:stroke-slate-800" />
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${completionPercent * 0.974} 100`} className="stroke-[var(--brand-primary)] transition-all duration-700" />
          </svg>
          <span className="absolute text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">{completionPercent}%</span>
        </div>
      </div>
      <div className="mb-3 empty:hidden">
        <PushToggle compact />
      </div>
      {session!.user.restrictedCategory && (
        <Link
          href="/admin"
          className="surface surface-link mb-4 flex w-fit items-center gap-2 p-4"
        >
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
          <span className="font-semibold text-slate-900 dark:text-slate-50">
            إدارة قسم: {restrictedCategoryLabel}
          </span>
        </Link>
      )}
      {filesNeedingRevision.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
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
      {inquiryNotice.late > 0 && (
        <Link
          href="/teacher/portfolio/accountability"
          className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-red-700 p-4 text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
        >
          <span className="font-semibold">متأخر عن الرد: {inquiryNotice.late} مسائلة مضى عليها أكثر من يومين بدون تبرير</span>
          <span className="text-xs">رد الآن</span>
        </Link>
      )}
      {inquiryNotice.toJustify > 0 && (
        <Link
          href="/teacher/portfolio/accountability"
          className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 transition-transform duration-200 hover:-translate-y-0.5 dark:border-red-900 dark:bg-red-900/30"
        >
          <span className="font-semibold text-red-900 dark:text-red-100">وصلتك {inquiryNotice.toJustify} مسائلة بانتظار تبريرك</span>
          <span className="text-xs font-medium text-red-900 dark:text-red-100">اضغط لفتحها</span>
        </Link>
      )}
      {inquiryNotice.newResults > 0 && (
        <Link
          href="/teacher/portfolio/accountability"
          className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 transition-transform duration-200 hover:-translate-y-0.5 dark:border-blue-900 dark:bg-blue-900/20"
        >
          <span className="font-semibold text-blue-800 dark:text-blue-200">صدرت نتيجة {inquiryNotice.newResults} مسائلة</span>
          <span className="text-xs text-blue-700 dark:text-blue-300">اضغط لمعرفة النتيجة</span>
        </Link>
      )}
      {classTimeFlags.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="font-semibold text-red-800 dark:text-red-200">تنبيهات الالتزام بزمن الحصة (آخر 7 أيام)</p>
          <ul className="flex flex-col gap-1.5 text-sm text-red-900 dark:text-red-100">
            {classTimeFlags.map((f) => (
              <li key={`${f.date}-${f.period}`}>
                تم رصد {f.status === "absent" ? "غياب" : `تأخر${f.minutes ? ` ${f.minutes} دقيقة` : ""}`} في الحصة {f.period} يوم{" "}
                {new Date(`${f.date}T00:00:00`).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })}
                {" بواسطة الإدارة"}
              </li>
            ))}
          </ul>
        </div>
      )}
      {session!.user.canTrackClassTime && (
        <Link
          href="/admin/school-schedule"
          style={{ borderInlineStartColor: "#2563eb", borderInlineStartWidth: 4 }}
          className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
            الجدول المدرسي
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">جداول الشعب بالمادة والمعلم والغياب والانتظار</span>
        </Link>
      )}
      {session!.user.canTrackClassTime && (
        <Link
          href="/admin/class-time"
          style={{ borderInlineStartColor: "#0d9488", borderInlineStartWidth: 4 }}
          className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600" />
            الالتزام بزمن الحصة
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">تسجيل تأخر المعلمين وغيابهم عن الحصص</span>
        </Link>
      )}
      <Link
        href="/teacher/student-referrals"
        style={{ borderInlineStartColor: "#2563eb", borderInlineStartWidth: 4 }}
        className="surface surface-link mb-3 flex flex-col gap-1 p-4"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-600" />
          تحويل الطالب لوكيل شؤون الطلاب
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          نموذج إلكتروني لتحويل طالب (ضعف دراسي، غياب، سلوك...) مع طباعة وإرسال
        </span>
      </Link>
      <h3 className="mb-3 mt-6 text-sm font-bold text-slate-500 dark:text-slate-400">أقسام ملفك</h3>
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
