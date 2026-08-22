import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, SCHEDULE_BUCKET } from "@/lib/supabase/storage";
import { MarkScheduleViewedOnMount } from "@/components/portfolio/MarkScheduleViewedOnMount";

export default async function TeacherSchedulePage() {
  const session = await auth();
  const { data: schedule } = await supabaseAdmin
    .from("schedules")
    .select("file_name, file_path, uploaded_at, viewed_at")
    .eq("teacher_id", session!.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const signedUrl = schedule ? await getSignedUrl(SCHEDULE_BUCKET, schedule.file_path) : null;

  return (
    <div className="max-w-xl">
      {schedule && !schedule.viewed_at && <MarkScheduleViewedOnMount />}
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">الجدول المدرسي</h2>
      {schedule && signedUrl ? (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 text-[var(--brand-primary)] hover:underline"
        >
          {schedule.file_name}
        </a>
      ) : (
        <p className="text-sm text-slate-400">
          لم يتم رفع الجدول المدرسي بعد من قبل الإدارة.
        </p>
      )}
    </div>
  );
}
