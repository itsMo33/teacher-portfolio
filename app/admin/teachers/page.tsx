import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { TeacherListWithSearch } from "@/components/admin/TeacherListWithSearch";

export default async function AdminTeachersListPage() {
  const teachers = await getTeachersWithCompletion();

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">قائمة المعلمين</h2>
      <TeacherListWithSearch teachers={teachers} />
    </div>
  );
}
