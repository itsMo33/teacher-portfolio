import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

function day(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

/** The general files uploaded by the staff accounts (إداري, محضر مختبر): who uploaded what, newest first. */
export default async function StaffFilesPage() {
  const session = await auth();
  if (!session || session.user.role === "teacher" || session.user.restrictedCategory) redirect("/admin");

  const { data: staff } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("role", "staff")
    .not("national_id", "like", "staff-%")
    .is("deleted_at", null)
    .order("name");

  const ids = (staff ?? []).map((u) => u.id as string);
  const { data: files } = ids.length
    ? await supabaseAdmin
        .from("attachments")
        .select("id, teacher_id, file_name, file_path, uploaded_at")
        .eq("category", "general_files")
        .in("teacher_id", ids)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false })
    : { data: [] };

  const withUrls = await Promise.all((files ?? []).map(async (f) => ({ ...f, url: await getSignedUrl(PORTFOLIO_BUCKET, f.file_path as string) })));

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">ملفات عامة -- الإداريون ومحضرو المختبر</h2>
        <p className="text-sm text-slate-500">الملفات اللي رفعها حسابات الإداريين في قسم «ملفات عامة».</p>
      </div>
      {(staff ?? []).length === 0 && <p className="text-sm text-slate-400">ما فيه حسابات إداريين بعد.</p>}
      {(staff ?? []).map((u) => {
        const mine = withUrls.filter((f) => f.teacher_id === u.id);
        return (
          <div key={u.id as string} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-slate-900 dark:text-slate-50">{u.name as string}</p>
              <span className="text-xs text-slate-400">{mine.length} ملف</span>
            </div>
            {mine.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد ملفات.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {mine.map((f) => (
                  <li key={f.id as string} className="flex items-center justify-between gap-2">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-primary)] hover:underline truncate">
                      {f.file_name as string}
                    </a>
                    <span className="shrink-0 text-xs text-slate-400">{day(f.uploaded_at as string)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
