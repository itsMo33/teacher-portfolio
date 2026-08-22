import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { TeacherListWithSearch } from "@/components/admin/TeacherListWithSearch";
import { AddTeacherForm } from "@/components/admin/AddTeacherForm";

export default async function AdminDashboard() {
  const teachers = await getTeachersWithCompletion();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">قائمة المعلمين</h2>
        <TeacherListWithSearch teachers={teachers} />
      </div>

      <div className="max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-1">إضافة معلم</h3>
        <p className="text-sm text-slate-500 mb-4">
          كلمة المرور الافتراضية للمعلم الجديد هي نفس رقم هويته، ويمكنه تغييرها لاحقًا من الإعدادات.
        </p>
        <AddTeacherForm />
      </div>
    </div>
  );
}
