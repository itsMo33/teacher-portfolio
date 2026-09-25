import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS } from "@/lib/schedule-builder";

export default async function PrintTeacherSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>;
}) {
  const { teacherId } = await searchParams;
  if (!teacherId) notFound();

  const { data: teacher } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .is("deleted_at", null)
    .maybeSingle();
  if (!teacher) notFound();

  const { data: slotRows } = await supabaseAdmin
    .from("schedule_slots")
    .select("day, period, class_sections(name_ar), subjects(name_ar)")
    .eq("teacher_id", teacherId);

  const grid = new Map<string, { sectionName: string; subjectName: string }>();
  for (const row of slotRows ?? []) {
    const section = Array.isArray(row.class_sections) ? row.class_sections[0] : row.class_sections;
    const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    grid.set(`${row.day}:${row.period}`, {
      sectionName: section?.name_ar ?? "",
      subjectName: subject?.name_ar ?? "",
    });
  }

  const printDate = new Date().toLocaleDateString("ar-SA");

  return (
    <div className="max-w-4xl mx-auto bg-white text-slate-900 print:max-w-none">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <table className="print-plain w-full border-collapse">
        <thead>
          <tr>
            <td colSpan={SCHEDULE_PERIODS.length + 1} className="pb-4">
              <div className="border-b border-slate-300 pb-4 mb-4 text-center">
                <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
                <h1 className="text-xl font-bold">الجدول الأسبوعي -- {teacher.name}</h1>
              </div>
              <div className="mb-4 flex justify-end text-sm">
                <p>
                  <strong>تاريخ الطباعة:</strong> {printDate}
                </p>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 p-2 text-sm font-bold text-center"></td>
            {SCHEDULE_PERIODS.map((p) => (
              <td key={p} className="border border-slate-300 p-2 text-sm font-bold text-center">
                الحصة {p}
              </td>
            ))}
          </tr>
          {SCHEDULE_DAYS.map((day) => (
            <tr key={day} className="break-inside-avoid">
              <td className="border border-slate-300 p-2 text-sm font-bold text-center">{day}</td>
              {SCHEDULE_PERIODS.map((period) => {
                const cell = grid.get(`${day}:${period}`);
                return (
                  <td key={period} className="border border-slate-300 p-2 text-xs text-center">
                    {cell ? (
                      <>
                        <div className="font-medium">{cell.sectionName}</div>
                        <div className="text-slate-500">{cell.subjectName}</div>
                      </>
                    ) : (
                      <span className="text-slate-300">--</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
