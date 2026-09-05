import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSection } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { AttachmentList } from "@/components/portfolio/AttachmentList";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";

export default async function AdminTeacherPortfolioSectionPage({
  params,
}: {
  params: Promise<{ teacherId: string; category: string }>;
}) {
  const { teacherId, category } = await params;

  const section = getSection(category);
  if (!section) notFound();
  if (section.key === "schedule") redirect(`/admin/teachers/${teacherId}/schedule`);

  const { data: teacher } = await supabaseAdmin
    .from("users")
    .select("id, name, national_id, subject")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .is("deleted_at", null)
    .maybeSingle();

  if (!teacher) notFound();

  const subsections = section.hasSubsections ? section.subsections! : [{ key: "", labelAr: "" }];

  const subsectionData = await Promise.all(
    subsections.map(async (sub) => ({
      sub,
      attachments: await getSectionAttachments(teacherId, section.key, sub.key || null),
    }))
  );

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
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href={`/admin/teachers/${teacherId}`} className="text-sm text-[var(--brand-primary)] hover:underline">
          ← {teacher.name}
        </Link>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: section.accentColor }}
          />
          {section.labelAr}
        </h2>
        {section.note && <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{section.note}</p>}
      </div>

      {section.teacherWritable && (
        <p className="text-sm text-slate-400">
          يرفع المعلم ملفات هذا القسم بنفسه، ويمكنك هنا الاطلاع على الملفات وتنزيلها فقط.
        </p>
      )}

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
        <div key={sub.key} className="flex flex-col gap-3">
          {sub.labelAr && (
            <div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">{sub.labelAr}</h3>
              {sub.note && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{sub.note}</p>}
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
}
