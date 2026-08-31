import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { AttachmentList } from "@/components/portfolio/AttachmentList";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";
import { DeleteTeacherButton } from "@/components/admin/DeleteTeacherButton";
import { MarkAdminViewedOnMount } from "@/components/admin/MarkAdminViewedOnMount";
import { TROPHY_BADGE } from "@/lib/motivational-messages";

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
          const sectionShowPercent = section.hasSubsections
            ? section.subsections!.some((s) => s.showPercent)
            : !!section.showPercent;
          const allSubsectionsDone = subsectionData.every(
            ({ sub, attachments }) => attachments.length >= (sub.requiredCount ?? 1)
          );
          const sectionPercent = section.hasSubsections
            ? Math.round(
                (subsectionData.reduce(
                  (sum, s) => sum + Math.min(s.attachments.length / (s.sub.requiredCount ?? 1), 1),
                  0
                ) /
                  subsectionData.length) *
                  100
              )
            : Math.round(Math.min(total / (section.requiredCount ?? 1), 1) * 100);

          const badgeText: string | null = !sectionShowPercent
            ? allSubsectionsDone
              ? TROPHY_BADGE
              : null
            : `${total} ملف (${sectionPercent}%)`;

          const accountabilityStats =
            section.key === "accountability"
              ? subsectionData[0].attachments.reduce(
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
                {badgeText && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
                      total > 0 ? "" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                    style={total > 0 ? { backgroundColor: `${section.accentColor}1a`, color: section.accentColor } : undefined}
                  >
                    {badgeText}
                  </span>
                )}
              </div>
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
                      {(() => {
                        const subDone = attachments.length >= (sub.requiredCount ?? 1);
                        const subText = sub.showPercent
                          ? `${attachments.length} ملف (${Math.round(
                              Math.min(attachments.length / (sub.requiredCount ?? 1), 1) * 100
                            )}%)`
                          : subDone
                          ? TROPHY_BADGE
                          : null;
                        return subText ? <span className="text-xs text-slate-400">{subText}</span> : null;
                      })()}
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
                    editableAccountabilityStatus={section.key === "accountability"}
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
