import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getSection } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";
import { AttachmentList } from "@/components/portfolio/AttachmentList";
import { MarkViewedOnMount } from "@/components/portfolio/MarkViewedOnMount";

export default async function TeacherPortfolioSectionPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const section = getSection(category);
  if (!section) notFound();
  if (section.key === "schedule") redirect("/teacher/schedule");

  const session = await auth();
  const teacherId = session!.user.id;

  const subsections = section.hasSubsections ? section.subsections! : [{ key: "", labelAr: "" }];

  const subsectionData = await Promise.all(
    subsections.map(async (sub) => ({
      sub,
      attachments: await getSectionAttachments(teacherId, section.key, sub.key || null),
    }))
  );

  // Read-receipt tracking applies to any section the admin/agent uploads on the
  // teacher's behalf, so they can see when the teacher has actually opened it.
  const unviewedIds = !section.teacherWritable
    ? subsectionData.flatMap((s) => s.attachments.filter((a) => !a.viewed_at).map((a) => a.id))
    : [];

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {unviewedIds.length > 0 && <MarkViewedOnMount attachmentIds={unviewedIds} />}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: section.accentColor }}
          />
          {section.labelAr}
        </h2>
        {section.note && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{section.note}</p>
        )}
      </div>

      {!section.teacherWritable && (
        <p className="text-sm text-slate-400">
          يُدار هذا القسم من قبل الإدارة، ويمكنك هنا الاطلاع على الملفات وتنزيلها فقط.
        </p>
      )}

      {subsectionData.map(({ sub, attachments }) => (
        <div key={sub.key} className="flex flex-col gap-3">
          {sub.labelAr && (
            <div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">{sub.labelAr}</h3>
              {sub.note && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{sub.note}</p>}
            </div>
          )}
          {section.teacherWritable && (
            <FileUploadDropzone
              uploadUrl="/api/portfolio/upload"
              extraFields={{ category: section.key, subcategory: sub.key }}
            />
          )}
          <AttachmentList attachments={attachments} canDelete={section.teacherWritable} />
        </div>
      ))}
    </div>
  );
}
