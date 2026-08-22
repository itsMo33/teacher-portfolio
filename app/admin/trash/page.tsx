import { supabaseAdmin } from "@/lib/supabase/server";
import { TrashActions } from "@/components/admin/TrashActions";

export default async function TrashPage() {
  const { data: deletedTeachers } = await supabaseAdmin
    .from("users")
    .select("id, name, national_id, deleted_at")
    .eq("role", "teacher")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const { data: deletedAttachments } = await supabaseAdmin
    .from("attachments")
    .select("id, teacher_id, file_name, category, subcategory, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const teacherIds = [...new Set((deletedAttachments ?? []).map((a) => a.teacher_id))];
  const { data: teacherNames } =
    teacherIds.length > 0
      ? await supabaseAdmin.from("users").select("id, name").in("id", teacherIds)
      : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((teacherNames ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-1">سلة المحذوفات</h2>
        <p className="text-sm text-slate-500 mb-4">
          العناصر هنا تبقى للأبد حتى تستعيدها أو تحذفها نهائيًا بنفسك.
        </p>
      </div>

      <div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">معلمون محذوفون</h3>
        {(deletedTeachers ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">لا يوجد معلمون محذوفون.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deletedTeachers!.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm text-slate-900 dark:text-slate-50">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    {t.national_id} · حُذف بتاريخ {new Date(t.deleted_at!).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <TrashActions type="teacher" id={t.id} label={t.name} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">ملفات محذوفة</h3>
        {(deletedAttachments ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد ملفات محذوفة.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deletedAttachments!.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm text-slate-900 dark:text-slate-50">{a.file_name}</p>
                  <p className="text-xs text-slate-400">
                    {nameById.get(a.teacher_id) ?? "—"} · حُذف بتاريخ{" "}
                    {new Date(a.deleted_at!).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <TrashActions type="attachment" id={a.id} label={a.file_name} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
