import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, SCHEDULE_BUCKET } from "@/lib/supabase/storage";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";

export default async function AdminTeacherSchedulePage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;

  const { data: teacher } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .is("deleted_at", null)
    .maybeSingle();

  if (!teacher) notFound();

  const { data: schedule } = await supabaseAdmin
    .from("schedules")
    .select("file_name, file_path, uploaded_at")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .maybeSingle();

  const signedUrl = schedule ? await getSignedUrl(SCHEDULE_BUCKET, schedule.file_path) : null;

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
        الجدول المدرسي - {teacher.name}
      </h2>

      {schedule && signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 text-[var(--brand-primary)] hover:underline w-fit"
        >
          الملف الحالي: {schedule.file_name}
        </a>
      )}

      <FileUploadDropzone uploadUrl={`/api/schedule/${teacherId}`} />
    </div>
  );
}
