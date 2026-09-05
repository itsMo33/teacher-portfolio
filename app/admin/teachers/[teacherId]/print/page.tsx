import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS, TEACHER_COMPLETION_SLOTS, TOTAL_TEACHER_COMPLETION_SLOTS } from "@/lib/portfolio-sections";
import { getSectionAttachments, getSlotCounts } from "@/lib/portfolio-data";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";

export default async function TeacherPrintReportPage({
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
    .select("file_name")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .maybeSingle();

  const sections = PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule");

  const slotCounts = await getSlotCounts(teacherId);
  const completionPercent = Math.round(
    (TEACHER_COMPLETION_SLOTS.reduce((sum, slot) => {
      const count = slotCounts[`${slot.section}:${slot.subsection ?? ""}`] ?? 0;
      return sum + Math.min(count / slot.requiredCount, 1);
    }, 0) /
      TOTAL_TEACHER_COMPLETION_SLOTS) *
      100
  );

  const sectionsData = await Promise.all(
    sections.map(async (section) => {
      const subsections = section.hasSubsections ? section.subsections! : [{ key: "", labelAr: "" }];
      const subsectionData = await Promise.all(
        subsections.map(async (sub) => ({
          sub,
          attachments: await getSectionAttachments(teacherId, section.key, sub.key || null),
        }))
      );
      return { section, subsectionData };
    })
  );

  return (
    <div className="max-w-3xl mx-auto bg-white text-slate-900 print:max-w-none">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div className="border-b border-slate-300 pb-4 mb-4 text-center">
        <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
        <h1 className="text-xl font-bold">تقرير ملف الإنجاز</h1>
      </div>

      <div className="mb-6 flex justify-between text-sm">
        <div>
          <p>
            <strong>الاسم:</strong> {teacher.name}
          </p>
          <p>
            <strong>رقم الهوية:</strong> {teacher.national_id}
          </p>
          {teacher.subject && (
            <p>
              <strong>المادة:</strong> {teacher.subject}
            </p>
          )}
          <p>
            <strong>نسبة الإنجاز:</strong> {completionPercent}%
          </p>
        </div>
        <p>
          <strong>تاريخ الطباعة:</strong> {new Date().toLocaleDateString("ar-SA")}
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm border-b border-slate-200 pb-2">
        <span className="font-bold">الجدول المدرسي:</span>
        {schedule ? (
          <span>✓ {schedule.file_name}</span>
        ) : (
          <span className="text-slate-500">✗ لم يُرفع</span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {sectionsData.map(({ section, subsectionData }) => (
          <div key={section.key} className="break-inside-avoid">
            <h3 className="font-bold border-b border-slate-200 pb-1 mb-1">{section.labelAr}</h3>
            {subsectionData.map(({ sub, attachments }) => (
              <div key={sub.key} className="pr-3 mb-1 text-sm">
                {sub.labelAr && <p className="font-medium text-slate-700">{sub.labelAr}</p>}
                {attachments.length === 0 ? (
                  <p className="text-slate-500">✗ لا توجد مرفقات</p>
                ) : (
                  <ul className="list-disc pr-5">
                    {attachments.map((a) => (
                      <li key={a.id}>✓ {a.file_name}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
