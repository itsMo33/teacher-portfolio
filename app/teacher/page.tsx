import { auth } from "@/lib/auth/auth-options";
import {
  getSlotCounts,
  getHasSchedule,
  getUnviewedAdminSectionKeys,
  getHasUnviewedSchedule,
} from "@/lib/portfolio-data";
import { TEACHER_COMPLETION_SLOTS, TOTAL_TEACHER_COMPLETION_SLOTS } from "@/lib/portfolio-sections";
import { ProgressGrid } from "@/components/portfolio/ProgressGrid";

export default async function TeacherDashboard() {
  const session = await auth();
  const [slotCounts, hasSchedule, unviewedSectionKeys, hasUnviewedSchedule] = await Promise.all([
    getSlotCounts(session!.user.id),
    getHasSchedule(session!.user.id),
    getUnviewedAdminSectionKeys(session!.user.id),
    getHasUnviewedSchedule(session!.user.id),
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
      <ProgressGrid
        slotCounts={slotCounts}
        linkPrefix="/teacher/portfolio"
        hasSchedule={hasSchedule}
        unviewedSectionKeys={unviewedSectionKeys}
        hasUnviewedSchedule={hasUnviewedSchedule}
      />
    </div>
  );
}
