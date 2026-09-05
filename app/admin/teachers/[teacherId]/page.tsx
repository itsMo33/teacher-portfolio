import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { TEACHER_COMPLETION_SLOTS, TOTAL_TEACHER_COMPLETION_SLOTS } from "@/lib/portfolio-sections";
import { getSlotCounts, getHasSchedule, getUnviewedByAdminSectionKeys } from "@/lib/portfolio-data";
import { ProgressGrid } from "@/components/portfolio/ProgressGrid";
import { DeleteTeacherButton } from "@/components/admin/DeleteTeacherButton";
import { MarkAdminViewedOnMount } from "@/components/admin/MarkAdminViewedOnMount";

export default async function AdminTeacherPortfolioPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;

  const { data: teacher } = await supabaseAdmin
    .from("users")
    .select("id, name, national_id, subject")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .is("deleted_at", null)
    .maybeSingle();

  if (!teacher) notFound();

  const [slotCounts, hasSchedule, unviewedSectionKeys] = await Promise.all([
    getSlotCounts(teacherId),
    getHasSchedule(teacherId),
    getUnviewedByAdminSectionKeys(teacherId),
  ]);

  const completionPercent = Math.round(
    (TEACHER_COMPLETION_SLOTS.reduce((sum, slot) => {
      const count = slotCounts[`${slot.section}:${slot.subsection ?? ""}`] ?? 0;
      return sum + Math.min(count / slot.requiredCount, 1);
    }, 0) /
      TOTAL_TEACHER_COMPLETION_SLOTS) *
      100
  );

  return (
    <div className="flex flex-col gap-6">
      <MarkAdminViewedOnMount teacherId={teacherId} />
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{teacher.name}</h2>
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
          <DeleteTeacherButton teacherId={teacherId} teacherName={teacher.name} />
        </div>
        <p className="text-sm text-slate-500">
          {teacher.national_id} {teacher.subject ? `· ${teacher.subject}` : ""}
        </p>
        <div className="mt-2 flex items-center gap-4">
          <Link
            href={`/admin/teachers/${teacherId}/schedule`}
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            إدارة الجدول المدرسي
          </Link>
          <Link
            href={`/admin/teachers/${teacherId}/print`}
            target="_blank"
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            طباعة / تصدير تقرير
          </Link>
        </div>
      </div>

      <ProgressGrid
        slotCounts={slotCounts}
        linkPrefix={`/admin/teachers/${teacherId}/portfolio`}
        hasSchedule={hasSchedule}
        unviewedSectionKeys={unviewedSectionKeys}
        scheduleHref={`/admin/teachers/${teacherId}/schedule`}
        scheduleUploadedLabel="مرفوع"
      />
    </div>
  );
}
