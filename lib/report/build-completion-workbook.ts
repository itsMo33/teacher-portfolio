import ExcelJS from "exceljs";
import { TEACHER_SLOTS } from "@/lib/portfolio-sections";
import type { TeacherWithCompletion } from "@/lib/teachers-data";

export function buildCompletionWorkbook(teachers: TeacherWithCompletion[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("تقرير الإنجاز");
  sheet.views = [{ rightToLeft: true }];

  const headers = ["الاسم", "رقم الهوية", "المادة", "الجدول المدرسي", ...TEACHER_SLOTS.map((s) => s.labelAr), "نسبة الإنجاز"];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  for (const teacher of teachers) {
    const row = sheet.addRow([
      teacher.name,
      teacher.national_id,
      teacher.subject ?? "",
      teacher.hasSchedule ? "✓" : "✗",
      ...TEACHER_SLOTS.map((slot) =>
        teacher.filledSlots.has(`${slot.section}:${slot.subsection ?? ""}`) ? "✓" : "✗"
      ),
      `${teacher.completionPercent}%`,
    ]);

    row.eachCell((cell, colNumber) => {
      if (colNumber >= 5 && colNumber <= 4 + TEACHER_SLOTS.length) {
        const isDone = cell.value === "✓";
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isDone ? "FFD1FAE5" : "FFFEE2E2" },
        };
        cell.alignment = { horizontal: "center" };
      }
    });
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  sheet.getColumn(1).width = 24;

  return workbook;
}
