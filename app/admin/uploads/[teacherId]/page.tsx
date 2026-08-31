import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS, getSection } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { getSignedUrl, SCHEDULE_BUCKET } from "@/lib/supabase/storage";
import { AttachmentList } from "@/components/portfolio/AttachmentList";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";

const ADMIN_SECTIONS = PORTFOLIO_SECTIONS.filter((s) => !s.teacherWritable && s.key !== "schedule");
const SCHEDULE_SECTION = getSection("schedule")!;

export default async function AdminUploadsForTeacherPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;

  const { data: teacher } = await supabaseAdmin
    .from("users")
    .select("id, name, national_id, subject")
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

  const scheduleSignedUrl = schedule ? await getSignedUrl(SCHEDULE_BUCKET, schedule.file_path) : null;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <Link href="/admin/uploads" className="text-sm text-[var(--brand-primary)] hover:underline">
          ← رفع ملفات للمعلمين
        </Link>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">{teacher.name}</h2>
        <p className="text-sm text-slate-500">
          {teacher.national_id} {teacher.subject ? `· ${teacher.subject}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: SCHEDULE_SECTION.accentColor }}
          />
          {SCHEDULE_SECTION.labelAr}
        </h3>
        {schedule && scheduleSignedUrl && (
          <a
            href={scheduleSignedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 text-[var(--brand-primary)] hover:underline w-fit"
          >
            الملف الحالي: {schedule.file_name}
          </a>
        )}
        <FileUploadDropzone uploadUrl={`/api/schedule/${teacherId}`} />
      </div>

      {await Promise.all(
        ADMIN_SECTIONS.map(async (section) => {
          const subsections = section.hasSubsections ? section.subsections! : [{ key: "", labelAr: "" }];

          const accountabilityAttachments =
            section.key === "accountability" ? await getSectionAttachments(teacherId, section.key, null) : null;
          const accountabilityStats = accountabilityAttachments
            ? accountabilityAttachments.reduce(
                (acc, a) => {
                  if (a.accountability_status === "excused") acc.excused++;
                  else if (a.accountability_status === "rejected") acc.rejected++;
                  else acc.pending++;
                  return acc;
                },
                { excused: 0, rejected: 0, pending: 0 }
              )
            : null;

          return (
            <div key={section.key} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: section.accentColor }}
                />
                {section.labelAr}
              </h3>
              {section.note && <p className="text-xs text-amber-600 dark:text-amber-400">{section.note}</p>}
              {accountabilityStats && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5">
                    مقبول بعذر: {accountabilityStats.excused}
                  </span>
                  <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5">
                    غير مقبول: {accountabilityStats.rejected}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5">
                    بدون قرار: {accountabilityStats.pending}
                  </span>
                </div>
              )}

              {await Promise.all(
                subsections.map(async (sub) => {
                  const attachments =
                    section.key === "accountability" && accountabilityAttachments
                      ? accountabilityAttachments
                      : await getSectionAttachments(teacherId, section.key, sub.key || null);
                  return (
                    <div key={sub.key} className="flex flex-col gap-2 pr-3">
                      {sub.labelAr && (
                        <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {sub.labelAr}
                          {sub.note && (
                            <span className="text-xs font-normal text-amber-600 dark:text-amber-400"> ({sub.note})</span>
                          )}
                        </h4>
                      )}
                      <FileUploadDropzone
                        uploadUrl="/api/portfolio/upload"
                        extraFields={{ category: section.key, subcategory: sub.key, teacherId }}
                      />
                      <AttachmentList
                        attachments={attachments}
                        canDelete
                        showViewedStatus
                        editableAccountabilityStatus={section.key === "accountability"}
                      />
                    </div>
                  );
                })
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
