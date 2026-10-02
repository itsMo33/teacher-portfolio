import { auth } from "@/lib/auth/auth-options";
import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { TeacherListWithSearch } from "@/components/admin/TeacherListWithSearch";
import { DownloadAllFilesButton } from "@/components/admin/DownloadAllFilesButton";

export default async function AdminTeachersListPage() {
  const [session, teachers] = await Promise.all([auth(), getTeachersWithCompletion()]);

  // Mirrors who the /api/teachers/files-manifest endpoint accepts: admin-level accounts, not demo ones.
  const canDownloadAll =
    (session?.user.role === "agent" || session?.user.role === "manager") && !session.user.demoViewOnly;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">قائمة المعلمين</h2>
        {canDownloadAll && <DownloadAllFilesButton />}
      </div>
      <TeacherListWithSearch teachers={teachers} />
    </div>
  );
}
