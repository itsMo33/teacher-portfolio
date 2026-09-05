import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { SectionBreakdownList, type SectionBreakdownItem } from "@/components/admin/SectionBreakdownList";

export default async function AdminStatisticsPage() {
  const teachers = await getTeachersWithCompletion();
  const total = teachers.length;

  const sections = PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule");

  const sectionStats: SectionBreakdownItem[] = sections.map((section) => {
    const teacherStatuses = teachers.map((t) => {
      const totalCount = section.hasSubsections ? section.subsections!.length : (section.requiredCount ?? 1);
      const doneCount = section.hasSubsections
        ? section.subsections!.filter(
            (sub) => (t.slotCounts[`${section.key}:${sub.key}`] ?? 0) >= (sub.requiredCount ?? 1)
          ).length
        : Math.min(t.slotCounts[`${section.key}:`] ?? 0, totalCount);
      return { name: t.name, doneCount, totalCount };
    });
    teacherStatuses.sort((a, b) => b.doneCount / b.totalCount - a.doneCount / a.totalCount);
    const count = teacherStatuses.filter((t) => t.doneCount >= t.totalCount).length;
    return { key: section.key, label: section.labelAr, count, teachers: teacherStatuses };
  });

  const scheduleCount = teachers.filter((t) => t.hasSchedule).length;

  const averageCompletion =
    total > 0 ? Math.round(teachers.reduce((sum, t) => sum + t.completionPercent, 0) / total) : 0;

  const fullyCompleteCount = teachers.filter((t) => t.completionPercent === 100).length;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">الإحصائيات</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="عدد المعلمين" value={total} />
        <StatCard label="متوسط الإنجاز" value={`${averageCompletion}%`} />
        <StatCard label="أكملوا الملف بالكامل" value={fullyCompleteCount} />
        <StatCard label="رفعوا الجدول" value={scheduleCount} />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">عدد المعلمين اللي رفعوا ملف لكل قسم</h3>
        <p className="text-xs text-slate-400">اضغط على أي قسم لعرض المعلمين اللي رفعوا (أخضر) والي ما رفعوا (أحمر)</p>
        <SectionBreakdownList sections={sectionStats} total={total} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
      <p className="text-2xl font-bold text-[var(--brand-primary)]">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
