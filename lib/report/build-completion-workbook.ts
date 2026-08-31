import ExcelJS from "exceljs";
import { TEACHER_SLOTS } from "@/lib/portfolio-sections";
import type { TeacherWithCompletion } from "@/lib/teachers-data";

export function buildCompletionWorkbook(teachers: TeacherWithCompletion[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("تقرير الإنجاز");
  sheet.views = [{ rightToLeft: true }];

  const headers = [
    "الاسم",
    "رقم الهوية",
    "المادة",
    "الجدول المدرسي",
    ...TEACHER_SLOTS.map((s) => s.labelAr),
    "نسبة الإنجاز",
    "إجمالي الملفات",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  let grandTotalFiles = 0;

  for (const teacher of teachers) {
    grandTotalFiles += teacher.totalFiles;

    const row = sheet.addRow([
      teacher.name,
      teacher.national_id,
      teacher.subject ?? "",
      teacher.hasSchedule ? "✓" : "✗",
      ...TEACHER_SLOTS.map((slot) => {
        const count = teacher.slotCounts[`${slot.section}:${slot.subsection ?? ""}`] ?? 0;
        const mark = count >= slot.requiredCount ? "✓" : "✗";
        if (slot.requiredCount > 1) return `${mark} (${count}/${slot.requiredCount})`;
        return count > 1 ? `${mark} (${count})` : mark;
      }),
      `${teacher.completionPercent}%`,
      teacher.totalFiles,
    ]);

    row.eachCell((cell, colNumber) => {
      if (colNumber >= 5 && colNumber <= 4 + TEACHER_SLOTS.length) {
        const isDone = typeof cell.value === "string" && cell.value.startsWith("✓");
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isDone ? "FFD1FAE5" : "FFFEE2E2" },
        };
        cell.alignment = { horizontal: "center" };
      }
    });
  }

  const totalColumnCount = headers.length;
  const totalRow = sheet.addRow([
    "الإجمالي",
    ...Array(totalColumnCount - 2).fill(""),
    grandTotalFiles,
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });
  totalRow.getCell(totalColumnCount).alignment = { horizontal: "center" };

  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  sheet.getColumn(1).width = 24;

  return workbook;
}
