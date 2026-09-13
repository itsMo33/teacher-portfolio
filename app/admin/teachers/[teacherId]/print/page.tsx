import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS, TEACHER_COMPLETION_SLOTS, TOTAL_TEACHER_COMPLETION_SLOTS } from "@/lib/portfolio-sections";
import { getSectionAttachments, getSlotCounts, getProfessionalLicenseExempt } from "@/lib/portfolio-data";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { PERFORMANCE_CATEGORIES } from "@/lib/teacher-performance";

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

  const [slotCounts, professionalLicenseExempt] = await Promise.all([
    getSlotCounts(teacherId),
    getProfessionalLicenseExempt(teacherId),
  ]);
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

  const { data: performanceRecords } = await supabaseAdmin
    .from("teacher_performance_records")
    .select("category, status")
    .eq("teacher_id", teacherId);

  const performanceStats = PERFORMANCE_CATEGORIES.map((c) => {
    const recs = (performanceRecords ?? []).filter((r) => r.category === c.key);
    return {
      category: c,
      presentCount: recs.filter((r) => r.status === "present").length,
      absentCount: recs.filter((r) => r.status === "absent").length,
    };
  });

  const printDate = new Date().toLocaleDateString("ar-SA");

  return (
    <div className="max-w-3xl mx-auto bg-white text-slate-900 print:max-w-none">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      {/* thead repeats on every printed page, so the teacher's name and the print date stay
          visible past page 1 -- print-plain keeps this report's clean divider-line look instead
          of the boxed-cell style other print reports in the app use. */}
      <table className="print-plain w-full border-collapse">
        <thead>
          <tr>
            <td className="pb-4">
              <div className="border-b border-slate-300 pb-4 mb-4 text-center">
                <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
                <h1 className="text-xl font-bold">تقرير ملف الإنجاز</h1>
              </div>

              <div className="mb-4 flex justify-between text-sm">
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
                  <strong>تاريخ الطباعة:</strong> {printDate}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm border-b border-slate-200 pb-2">
                <span className="font-bold">الجدول المدرسي:</span>
                {schedule ? (
                  <span>✓ {schedule.file_name}</span>
                ) : (
                  <span className="text-slate-500">✗ لم يُرفع</span>
                )}
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          {sectionsData.map(({ section, subsectionData }) => (
            <tr key={section.key}>
              <td className="break-inside-avoid pt-4">
                <h3 className="font-bold border-b border-slate-200 pb-1 mb-1">{section.labelAr}</h3>
                {subsectionData.map(({ sub, attachments }) => {
                  const isExemptLicense =
                    professionalLicenseExempt && section.key === "achievement_file" && sub.key === "professional_license";
                  return (
                    <div key={sub.key} className="pr-3 mb-1 text-sm">
                      {sub.labelAr && <p className="font-medium text-slate-700">{sub.labelAr}</p>}
                      {isExemptLicense ? (
                        <p className="text-slate-500">معفى من هذا المتطلب</p>
                      ) : attachments.length === 0 ? (
                        <p className="text-slate-500">✗ لا توجد مرفقات</p>
                      ) : (
                        <ul className="list-disc pr-5">
                          {attachments.map((a) => (
                            <li key={a.id}>✓ {a.file_name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </td>
            </tr>
          ))}
          <tr>
            <td className="break-inside-avoid mt-4 pt-4 border-t border-slate-300">
              <h3 className="font-bold border-b border-slate-200 pb-1 mb-1">متابعة الأداء</h3>
              {performanceStats.map(({ category: c, presentCount, absentCount }) => (
                <div key={c.key} className="pr-3 mb-1 text-sm flex items-center justify-between">
                  <span className="font-medium text-slate-700">{c.labelAr}</span>
                  <span className="text-slate-600">
                    {c.mode === "assumed-present" ? `غياب: ${absentCount} مرة` : `حضور: ${presentCount} — غياب: ${absentCount}`}
                  </span>
                </div>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
