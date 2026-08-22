import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { AttachmentList } from "@/components/portfolio/AttachmentList";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";

const ADMIN_SECTIONS = PORTFOLIO_SECTIONS.filter((s) => !s.teacherWritable && s.key !== "schedule");

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

      {await Promise.all(
        ADMIN_SECTIONS.map(async (section) => {
          const subsections = section.hasSubsections ? section.subsections! : [{ key: "", labelAr: "" }];

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

              {await Promise.all(
                subsections.map(async (sub) => {
                  const attachments = await getSectionAttachments(teacherId, section.key, sub.key || null);
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
                      <AttachmentList attachments={attachments} canDelete showViewedStatus />
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
