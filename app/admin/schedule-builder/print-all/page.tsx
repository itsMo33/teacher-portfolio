import { supabaseAdmin } from "@/lib/supabase/server";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS } from "@/lib/schedule-builder";

export default async function PrintAllSchedulesPage() {
  const { data: slotRows } = await supabaseAdmin
    .from("schedule_slots")
    .select("teacher_id, day, period, users(name), class_sections(name_ar)");

  const teacherNameById = new Map<string, string>();
  const grid = new Map<string, string>();

  for (const row of slotRows ?? []) {
    const teacher = Array.isArray(row.users) ? row.users[0] : row.users;
    const section = Array.isArray(row.class_sections) ? row.class_sections[0] : row.class_sections;
    if (teacher?.name) teacherNameById.set(row.teacher_id, teacher.name);
    grid.set(`${row.teacher_id}::${row.day}::${row.period}`, section?.name_ar ?? "");
  }

  const teachers = Array.from(teacherNameById, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name, "ar")
  );

  const printDate = new Date().toLocaleDateString("ar-SA");

  return (
    <div className="mx-auto bg-white text-slate-900">
      <style>{"@page { size: landscape; }"}</style>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <table className="print-plain w-full border-collapse">
        <thead>
          <tr>
            <td colSpan={SCHEDULE_DAYS.length * SCHEDULE_PERIODS.length + 1} className="pb-4">
              <div className="border-b border-slate-300 pb-4 mb-4 text-center">
                <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
                <h1 className="text-xl font-bold">الجدول العام لكل المعلمين</h1>
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
            <td className="border border-slate-300 p-1 text-[10px] font-bold text-center"></td>
            {SCHEDULE_DAYS.map((day) => (
              <td
                key={day}
                colSpan={SCHEDULE_PERIODS.length}
                className="border border-slate-300 p-1 text-xs font-bold text-center"
              >
                {day}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border border-slate-300 p-1 text-[10px] font-bold text-center">المعلم</td>
            {SCHEDULE_DAYS.map((day) =>
              SCHEDULE_PERIODS.map((period) => (
                <td key={`${day}-${period}`} className="border border-slate-300 p-1 text-[10px] font-bold text-center">
                  {period}
                </td>
              ))
            )}
          </tr>
          {teachers.map((teacher) => (
            <tr key={teacher.id} className="break-inside-avoid">
              <td className="border border-slate-300 p-1 text-[10px] font-bold whitespace-nowrap">{teacher.name}</td>
              {SCHEDULE_DAYS.map((day) =>
                SCHEDULE_PERIODS.map((period) => {
                  const sectionName = grid.get(`${teacher.id}::${day}::${period}`);
                  return (
                    <td key={`${day}-${period}`} className="border border-slate-300 p-1 text-[10px] text-center">
                      {sectionName || <span className="text-slate-300">--</span>}
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
