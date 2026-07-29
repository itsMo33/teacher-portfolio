import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { AttachmentList } from "@/components/portfolio/AttachmentList";

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
    .maybeSingle();

  if (!teacher) notFound();

  const sections = PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule");

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{teacher.name}</h2>
        <p className="text-sm text-slate-500">
          {teacher.national_id} {teacher.subject ? `· ${teacher.subject}` : ""}
        </p>
        <Link
          href={`/admin/teachers/${teacherId}/schedule`}
          className="mt-2 inline-block text-sm text-[var(--brand-primary)] hover:underline"
        >
          إدارة الجدول المدرسي
        </Link>
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
            <div key={section.key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{section.labelAr}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    total > 0
                      ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {total} ملف
                </span>
              </div>
              {subsectionData.map(({ sub, attachments }) => (
                <div key={sub.key} className="flex flex-col gap-1.5 pr-3">
                  {sub.labelAr && (
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {sub.labelAr}
                      </h4>
                      <span className="text-xs text-slate-400">{attachments.length} ملف</span>
                    </div>
                  )}
                  <AttachmentList attachments={attachments} canDelete={false} />
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
