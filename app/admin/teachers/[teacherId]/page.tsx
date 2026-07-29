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
          className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          إدارة الجدول المدرسي
        </Link>
      </div>

      {await Promise.all(
        sections.map(async (section) => {
          const subsections = section.hasSubsections
            ? section.subsections!
            : [{ key: "", labelAr: "" }];

          return (
            <div key={section.key} className="flex flex-col gap-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{section.labelAr}</h3>
              {await Promise.all(
                subsections.map(async (sub) => {
                  const attachments = await getSectionAttachments(
                    teacherId,
                    section.key,
                    sub.key || null
                  );
                  return (
                    <div key={sub.key} className="flex flex-col gap-1.5 pr-3">
                      {sub.labelAr && (
                        <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {sub.labelAr}
                        </h4>
                      )}
                      <AttachmentList attachments={attachments} canDelete={false} />
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
