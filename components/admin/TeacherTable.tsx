import Link from "next/link";

export interface TeacherRow {
  id: string;
  name: string;
  national_id: string;
  subject: string | null;
  completionPercent: number;
  hasSchedule: boolean;
}

export function TeacherTable({ teachers }: { teachers: TeacherRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-sm text-right">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <tr>
            <th className="px-4 py-3">الاسم</th>
            <th className="px-4 py-3">رقم الهوية</th>
            <th className="px-4 py-3">المادة</th>
            <th className="px-4 py-3">نسبة الإنجاز</th>
            <th className="px-4 py-3">الجدول</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">
                <Link href={`/admin/teachers/${t.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                  {t.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-500">{t.national_id}</td>
              <td className="px-4 py-3 text-slate-500">{t.subject ?? "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    t.completionPercent === 100
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : t.completionPercent >= 50
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {t.completionPercent}%
                </span>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/teachers/${t.id}/schedule`}
                  className="text-xs text-slate-500 hover:underline"
                >
                  {t.hasSchedule ? "معروض" : "لم يُرفع"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
