import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { AttachmentList } from "@/components/portfolio/AttachmentList";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";
import { DeleteTeacherButton } from "@/components/admin/DeleteTeacherButton";
import { MarkAdminViewedOnMount } from "@/components/admin/MarkAdminViewedOnMount";

export default async function AdminTeacherPortfolioPage({
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

  const sections = PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule");

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <MarkAdminViewedOnMount teacherId={teacherId} />
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{teacher.name}</h2>
          <DeleteTeacherButton teacherId={teacherId} teacherName={teacher.name} />
        </div>
        <p className="text-sm text-slate-500">
          {teacher.national_id} {teacher.subject ? `· ${teacher.subject}` : ""}
        </p>
        <div className="mt-2 flex items-center gap-4">
          <Link
            href={`/admin/teachers/${teacherId}/schedule`}
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            إدارة الجدول المدرسي
          </Link>
          <Link
            href={`/admin/teachers/${teacherId}/print`}
            target="_blank"
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            طباعة / تصدير تقرير
          </Link>
        </div>
      </div>

      {await Promise.all(
        sections.map(async (section) => {
          const subsections = section.hasSubsections
            ? section.subsections!
            : [{ key: "", labelAr: "" }];

          const subsectionData = await Promise.all(
            subsections.map(async (sub) => ({
              sub,
              attachments: await getSectionAttachments(teacherId, section.key, sub.key || null),
            }))
          );
          const total = subsectionData.reduce((sum, s) => sum + s.attachments.length, 0);

          return (
            <div
              key={section.key}
              style={{ borderInlineStartColor: section.accentColor, borderInlineStartWidth: 3 }}
              className="flex flex-col gap-3 border-slate-200 pr-3 dark:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: section.accentColor }}
                  />
                  {section.labelAr}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
                    total > 0 ? "" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                  style={total > 0 ? { backgroundColor: `${section.accentColor}1a`, color: section.accentColor } : undefined}
                >
                  {total} ملف
                </span>
              </div>
              {section.note && <p className="text-xs text-amber-600 dark:text-amber-400">{section.note}</p>}
              {subsectionData.map(({ sub, attachments }) => (
                <div key={sub.key} className="flex flex-col gap-1.5 pr-3">
                  {sub.labelAr && (
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {sub.labelAr}
                        {sub.note && (
                          <span className="text-xs font-normal text-amber-600 dark:text-amber-400"> ({sub.note})</span>
                        )}
                      </h4>
                      <span className="text-xs text-slate-400">{attachments.length} ملف</span>
                    </div>
                  )}
                  {!section.teacherWritable && (
                    <FileUploadDropzone
                      uploadUrl="/api/portfolio/upload"
                      extraFields={{ category: section.key, subcategory: sub.key, teacherId }}
                    />
                  )}
                  <AttachmentList
                    attachments={attachments}
                    canDelete={!section.teacherWritable}
                    showViewedStatus={!section.teacherWritable}
                  />
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
