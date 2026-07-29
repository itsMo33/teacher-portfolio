import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { TeacherTable } from "@/components/admin/TeacherTable";

export default async function AdminDashboard() {
  const teachers = await getTeachersWithCompletion();

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">قائمة المعلمين</h2>
      <TeacherTable teachers={teachers} />
    </div>
  );
}
