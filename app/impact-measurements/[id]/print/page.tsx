import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getImpactMeasurement } from "@/lib/portfolio-data";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";

const IMPROVEMENT_LEVELS: { value: string; label: string }[] = [
  { value: "كبير", label: "تحسن كبير" },
  { value: "متوسط", label: "تحسن متوسط" },
  { value: "بسيط", label: "تحسن بسيط" },
  { value: "لم يتحسن", label: "لم يتحسن" },
];
const RECOMMENDATIONS = ["تحقق الهدف", "يحتاج إلى متابعة", "يحتاج إلى خطة علاجية إضافية"];

export default async function ImpactMeasurementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const entry = await getImpactMeasurement(id);
  if (!entry) notFound();

  if (session.user.role === "teacher" && entry.teacherId !== session.user.id) notFound();

  const { data: teacher } = await supabaseAdmin.from("users").select("name").eq("id", entry.teacherId).maybeSingle();

  const printDate = new Date(entry.createdAt).toLocaleDateString("ar-SA");

  return (
    <div className="max-w-2xl mx-auto bg-white text-slate-900 p-6">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <p className="text-sm text-slate-500 text-center mb-1">{SCHOOL_NAME}</p>
      <h1 className="text-lg font-bold text-center mb-6">قياس أثر الخطة العلاجية --</h1>

      <div className="flex flex-col gap-2 text-sm mb-6">
        <p>
          <strong>المادة:</strong> {entry.subject}
        </p>
        <p>
          <strong>اسم الطالب:</strong> {entry.studentName}
        </p>
        <p>
          <strong>الصف:</strong> {entry.className}
        </p>
        <p>
          <strong>المعلم:</strong> {teacher?.name ?? ""}
        </p>
        <p>
          <strong>تاريخ القياس:</strong> {printDate}
        </p>
      </div>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr>
            <th className="border border-slate-400 p-2 text-sm">القياس</th>
            <th className="border border-slate-400 p-2 text-sm">الدرجة</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-400 p-2 text-sm">قبل الخطة العلاجية</td>
            <td className="border border-slate-400 p-2 text-sm text-center">
              {entry.scoreBefore} / {entry.maxScore}
            </td>
          </tr>
          <tr>
            <td className="border border-slate-400 p-2 text-sm">بعد الخطة العلاجية</td>
            <td className="border border-slate-400 p-2 text-sm text-center">
              {entry.scoreAfter} / {entry.maxScore}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mb-6">
        <p className="font-bold text-sm mb-2">مستوى التحسن:</p>
        <div className="flex flex-col gap-1.5">
          {IMPROVEMENT_LEVELS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <span className="inline-flex h-4 w-4 items-center justify-center border border-slate-500 text-xs">
                {entry.improvementLevel === value ? "✓" : ""}
              </span>
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="font-bold text-sm mb-2">ملاحظات المعلم:</p>
        <p className="text-sm min-h-[3rem] border-b border-slate-300 pb-2">{entry.teacherNotes || "--"}</p>
      </div>

      <div>
        <p className="font-bold text-sm mb-2">التوصية:</p>
        <div className="flex flex-col gap-1.5">
          {RECOMMENDATIONS.map((rec) => (
            <label key={rec} className="flex items-center gap-2 text-sm">
              <span className="inline-flex h-4 w-4 items-center justify-center border border-slate-500 text-xs">
                {entry.recommendations.includes(rec) ? "✓" : ""}
              </span>
              {rec}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
