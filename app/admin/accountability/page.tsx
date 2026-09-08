import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAllAccountabilityAttachments } from "@/lib/portfolio-data";
import { AttachmentList } from "@/components/portfolio/AttachmentList";

export default async function AdminAccountabilityPage() {
  const [{ data: teachers }, attachments] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, name, national_id, subject")
      .eq("role", "teacher")
      .is("deleted_at", null)
      .order("name"),
    getAllAccountabilityAttachments(),
  ]);

  const attachmentsByTeacher = new Map<string, typeof attachments>();
  for (const a of attachments) {
    if (!attachmentsByTeacher.has(a.teacher_id)) attachmentsByTeacher.set(a.teacher_id, []);
    attachmentsByTeacher.get(a.teacher_id)!.push(a);
  }

  const teachersWithAccountability = (teachers ?? []).filter((t) => attachmentsByTeacher.has(t.id));

  const totalExcused = attachments.filter((a) => a.accountability_status === "excused").length;
  const totalRejected = attachments.filter((a) => a.accountability_status === "rejected").length;
  const totalPending = attachments.filter((a) => !a.accountability_status).length;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">المسائلات</h2>
        <p className="text-sm text-slate-500">كل معلم عليه مسائلة، مع حالتها</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalExcused}</p>
          <p className="text-xs text-slate-500 mt-1">مقبول بعذر</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalRejected}</p>
          <p className="text-xs text-slate-500 mt-1">غير مقبول</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-slate-500">{totalPending}</p>
          <p className="text-xs text-slate-500 mt-1">بدون قرار</p>
        </div>
      </div>

      {teachersWithAccountability.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
          لا توجد مسائلات مسجّلة لأي معلم
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {teachersWithAccountability.map((teacher) => {
            const teacherAttachments = attachmentsByTeacher.get(teacher.id)!;
            const excused = teacherAttachments.filter((a) => a.accountability_status === "excused").length;
            const rejected = teacherAttachments.filter((a) => a.accountability_status === "rejected").length;
            const pending = teacherAttachments.filter((a) => !a.accountability_status).length;

            return (
              <div
                key={teacher.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/admin/teachers/${teacher.id}/portfolio/accountability`}
                    className="font-bold text-slate-900 dark:text-slate-50 hover:text-[var(--brand-primary)] hover:underline"
                  >
                    {teacher.name}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {teacher.national_id} {teacher.subject ? `· ${teacher.subject}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5">
                    مقبول بعذر: {excused}
                  </span>
                  <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5">
                    غير مقبول: {rejected}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5">
                    بدون قرار: {pending}
                  </span>
                </div>
                <AttachmentList attachments={teacherAttachments} canDelete editableAccountabilityStatus />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
