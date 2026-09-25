import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS } from "@/lib/schedule-builder";

export default async function PrintSectionSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ sectionId?: string }>;
}) {
  const { sectionId } = await searchParams;
  if (!sectionId) notFound();

  const { data: section } = await supabaseAdmin
    .from("class_sections")
    .select("id, name_ar")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section) notFound();

  const { data: slotRows } = await supabaseAdmin
    .from("schedule_slots")
    .select("day, period, users(name), subjects(name_ar)")
    .eq("section_id", sectionId);

  const grid = new Map<string, { teacherName: string; subjectName: string }>();
  for (const row of slotRows ?? []) {
    const teacher = Array.isArray(row.users) ? row.users[0] : row.users;
    const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    grid.set(`${row.day}:${row.period}`, {
      teacherName: teacher?.name ?? "",
      subjectName: subject?.name_ar ?? "",
    });
  }

  const printDate = new Date().toLocaleDateString("ar-SA");

  return (
    <div className="max-w-4xl mx-auto bg-white text-slate-900 print:max-w-none">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td colSpan={SCHEDULE_PERIODS.length + 1} className="print-no-border pb-4">
              <div className="border-b border-slate-300 pb-4 mb-4 text-center">
                <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
                <h1 className="text-xl font-bold">الجدول الأسبوعي -- شعبة {section.name_ar}</h1>
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
                        <div className="font-medium">{cell.teacherName}</div>
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
