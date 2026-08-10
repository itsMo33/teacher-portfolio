import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

export default async function AdminStatisticsPage() {
  const teachers = await getTeachersWithCompletion();
  const total = teachers.length;

  const sections = PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule");

  const sectionStats = sections.map((section) => {
    const count = teachers.filter((t) =>
      section.hasSubsections
        ? section.subsections!.some((sub) => t.filledSlots.has(`${section.key}:${sub.key}`))
        : t.filledSlots.has(`${section.key}:`)
    ).length;
    return { label: section.labelAr, count };
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
        {sectionStats.map((s) => {
          const percent = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="flex items-center justify-between mb-1.5 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{s.label}</span>
                <span className="text-slate-500">
                  {s.count} من {total} ({percent}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[var(--brand-primary)] rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
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
