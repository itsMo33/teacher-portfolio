import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getSection } from "@/lib/portfolio-sections";
import { getSectionAttachments } from "@/lib/portfolio-data";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";
import { AttachmentList } from "@/components/portfolio/AttachmentList";

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

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{section.labelAr}</h2>

      {await Promise.all(
        subsections.map(async (sub) => {
          const attachments = await getSectionAttachments(teacherId, section.key, sub.key || null);
          return (
            <div key={sub.key} className="flex flex-col gap-3">
              {sub.labelAr && (
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">{sub.labelAr}</h3>
              )}
              <FileUploadDropzone
                uploadUrl="/api/portfolio/upload"
                extraFields={{ category: section.key, subcategory: sub.key }}
              />
              <AttachmentList attachments={attachments} canDelete />
            </div>
          );
        })
      )}
    </div>
  );
}
