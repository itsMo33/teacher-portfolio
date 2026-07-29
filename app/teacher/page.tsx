import { auth } from "@/lib/auth/auth-options";
import { getSlotCounts } from "@/lib/portfolio-data";
import { ProgressGrid } from "@/components/portfolio/ProgressGrid";

export default async function TeacherDashboard() {
  const session = await auth();
  const slotCounts = await getSlotCounts(session!.user.id);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
        مرحبًا، {session!.user.name} 👋
      </h2>
      <ProgressGrid slotCounts={slotCounts} linkPrefix="/teacher/portfolio" />
    </div>
  );
}
