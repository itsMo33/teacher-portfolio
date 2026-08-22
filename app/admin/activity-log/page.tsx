import { supabaseAdmin } from "@/lib/supabase/server";
import { ACTION_LABELS_AR } from "@/lib/audit";

export default async function ActivityLogPage() {
  const { data: entries } = await supabaseAdmin
    .from("activity_log")
    .select("id, actor_name, action, target_teacher_name, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-1">سجل النشاط</h2>
      <p className="text-sm text-slate-500 mb-4">آخر 100 عملية على النظام، الأحدث أولًا.</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-sm text-right">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">الوقت</th>
              <th className="px-4 py-3">الفاعل</th>
              <th className="px-4 py-3">الإجراء</th>
              <th className="px-4 py-3">المعلم</th>
              <th className="px-4 py-3">التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((e) => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString("ar-SA")}
                </td>
                <td className="px-4 py-3">{e.actor_name}</td>
                <td className="px-4 py-3">{ACTION_LABELS_AR[e.action] ?? e.action}</td>
                <td className="px-4 py-3 text-slate-500">{e.target_teacher_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{e.details ?? "—"}</td>
              </tr>
            ))}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  لا يوجد نشاط بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
