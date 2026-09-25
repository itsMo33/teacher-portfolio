import { supabaseAdmin } from "@/lib/supabase/server";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS, sectionColor } from "@/lib/schedule-builder";

export default async function PrintAllSchedulesPage() {
  const [{ data: slotRows }, { data: sections }] = await Promise.all([
    supabaseAdmin.from("schedule_slots").select("teacher_id, section_id, day, period, users(name)"),
    supabaseAdmin.from("class_sections").select("id, name_ar, sort_order"),
  ]);

  const colorBySectionId = new Map((sections ?? []).map((s) => [s.id, sectionColor(s.sort_order)]));
  const sectionNameById = new Map((sections ?? []).map((s) => [s.id, s.name_ar]));

  const teacherNameById = new Map<string, string>();
  const grid = new Map<string, { sectionId: string; sectionName: string }>();

  for (const row of slotRows ?? []) {
    const teacher = Array.isArray(row.users) ? row.users[0] : row.users;
    if (teacher?.name) teacherNameById.set(row.teacher_id, teacher.name);
    grid.set(`${row.teacher_id}::${row.day}::${row.period}`, {
      sectionId: row.section_id,
      sectionName: sectionNameById.get(row.section_id) ?? "",
    });
  }

  const teachers = Array.from(teacherNameById, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name, "ar")
  );

  const printDate = new Date().toLocaleDateString("ar-SA");

  return (
    <div className="mx-auto bg-white text-slate-900">
      <style>{"@page { size: landscape; margin: 6mm; }"}</style>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <table className="w-full border-collapse text-[9px] print:text-[6px]">
        <thead>
          <tr>
            <td colSpan={SCHEDULE_DAYS.length * SCHEDULE_PERIODS.length + 1} className="print-no-border pb-2 print:pb-1">
              <div className="border-b border-slate-300 pb-2 mb-2 text-center print:pb-1 print:mb-1">
                <p className="text-xs text-slate-500 print:text-[7px]">{SCHOOL_NAME}</p>
                <h1 className="text-base font-bold print:text-[9px]">الجدول العام لكل المعلمين</h1>
              </div>
              <div className="mb-2 flex justify-end text-[10px] print:mb-1 print:text-[6px]">
                <p>
                  <strong>تاريخ الطباعة:</strong> {printDate}
                </p>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 p-0.5 font-bold text-center"></td>
            {SCHEDULE_DAYS.map((day) => (
              <td
                key={day}
                colSpan={SCHEDULE_PERIODS.length}
                className="border border-slate-300 p-0.5 font-bold text-center"
              >
                {day}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border border-slate-300 p-0.5 font-bold text-center">المعلم</td>
            {SCHEDULE_DAYS.map((day) =>
              SCHEDULE_PERIODS.map((period) => (
                <td key={`${day}-${period}`} className="border border-slate-300 p-0.5 font-bold text-center">
                  {period}
                </td>
              ))
            )}
          </tr>
          {teachers.map((teacher) => (
            <tr key={teacher.id} className="break-inside-avoid">
              <td className="border border-slate-300 p-0.5 font-bold whitespace-nowrap">{teacher.name}</td>
              {SCHEDULE_DAYS.map((day) =>
                SCHEDULE_PERIODS.map((period) => {
                  const cell = grid.get(`${teacher.id}::${day}::${period}`);
                  const bgColor = cell ? colorBySectionId.get(cell.sectionId) : undefined;
                  return (
                    <td
                      key={`${day}-${period}`}
                      className="border border-slate-300 p-0.5 text-center font-medium"
                      style={bgColor ? { backgroundColor: bgColor } : undefined}
                    >
                      {cell?.sectionName || <span className="text-slate-300">--</span>}
                    </td>
                  );
                })
              )}
            </tr>
          ))}
          {teachers.length === 0 && (
            <tr>
              <td colSpan={SCHEDULE_DAYS.length * SCHEDULE_PERIODS.length + 1} className="p-4 text-center text-sm text-slate-400">
                ما فيه أي حصص بالجدول بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
