import { auth } from "@/lib/auth/auth-options";
import { getSlotCounts, getHasSchedule } from "@/lib/portfolio-data";
import { ProgressGrid } from "@/components/portfolio/ProgressGrid";

export default async function TeacherDashboard() {
  const session = await auth();
  const [slotCounts, hasSchedule] = await Promise.all([
    getSlotCounts(session!.user.id),
    getHasSchedule(session!.user.id),
  ]);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
        مرحبًا، {session!.user.name} 👋
      </h2>
      <ProgressGrid slotCounts={slotCounts} linkPrefix="/teacher/portfolio" hasSchedule={hasSchedule} />
    </div>
  );
}
