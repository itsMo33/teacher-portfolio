import { getTeachersWithCompletion } from "@/lib/teachers-data";
import { AdminUploadsTable } from "@/components/admin/AdminUploadsTable";

export default async function AdminUploadsPage() {
  const teachers = await getTeachersWithCompletion();

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-1">رفع ملفات للمعلمين</h2>
      <p className="text-sm text-slate-500 mb-4">
        هذه هي الأقسام التي يرفع فيها الوكيل أو المدير الملفات نيابةً عن المعلم. اختر معلمًا لرفع أو استعراض ملفاته.
      </p>
      <AdminUploadsTable teachers={teachers} />
    </div>
  );
}
