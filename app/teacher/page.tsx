import { auth } from "@/lib/auth/auth-options";
import { getFilledSlots } from "@/lib/portfolio-data";
import { ProgressGrid } from "@/components/portfolio/ProgressGrid";

export default async function TeacherDashboard() {
  const session = await auth();
  const filledSlots = await getFilledSlots(session!.user.id);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
        ملف الإنجاز - نظرة عامة
      </h2>
      <ProgressGrid filledSlots={filledSlots} linkPrefix="/teacher/portfolio" />
    </div>
  );
}
