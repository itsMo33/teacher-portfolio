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

  const unviewedIds =
    section.key === "tasks_assignments"
      ? subsectionData.flatMap((s) => s.attachments.filter((a) => !a.viewed_at).map((a) => a.id))
      : [];

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {unviewedIds.length > 0 && <MarkViewedOnMount attachmentIds={unviewedIds} />}

      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{section.labelAr}</h2>

      {!section.teacherWritable && (
        <p className="text-sm text-slate-400">
          يُدار هذا القسم من قبل الإدارة، ويمكنك هنا الاطلاع على الملفات وتنزيلها فقط.
        </p>
      )}

      {subsectionData.map(({ sub, attachments }) => (
        <div key={sub.key} className="flex flex-col gap-3">
          {sub.labelAr && (
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{sub.labelAr}</h3>
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
