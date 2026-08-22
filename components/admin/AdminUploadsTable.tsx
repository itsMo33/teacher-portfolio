import Link from "next/link";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

const ADMIN_SECTIONS = PORTFOLIO_SECTIONS.filter((s) => !s.teacherWritable && s.key !== "schedule");

export interface UploadsTeacherRow {
  id: string;
  name: string;
  national_id: string;
  slotCounts: Record<string, number>;
}

export function AdminUploadsTable({ teachers }: { teachers: UploadsTeacherRow[] }) {
  function countFor(teacher: UploadsTeacherRow, sectionKey: string) {
    const section = ADMIN_SECTIONS.find((s) => s.key === sectionKey)!;
    if (!section.hasSubsections) return teacher.slotCounts[`${sectionKey}:`] ?? 0;
    return section.subsections!.reduce((sum, sub) => sum + (teacher.slotCounts[`${sectionKey}:${sub.key}`] ?? 0), 0);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full min-w-[640px] text-sm text-right">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <tr>
            <th className="px-4 py-3">الاسم</th>
            <th className="px-4 py-3">رقم الهوية</th>
            {ADMIN_SECTIONS.map((s) => (
              <th key={s.key} className="px-4 py-3">
                {s.labelAr}
              </th>
            ))}
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">{t.name}</td>
              <td className="px-4 py-3 text-slate-500">{t.national_id}</td>
              {ADMIN_SECTIONS.map((s) => {
                const count = countFor(t, s.key);
                return (
                  <td key={s.key} className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
                        count > 0 ? "" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                      style={count > 0 ? { backgroundColor: `${s.accentColor}1a`, color: s.accentColor } : undefined}
                    >
                      {count} ملف
                    </span>
                  </td>
                );
              })}
              <td className="px-4 py-3">
                <Link
                  href={`/admin/uploads/${t.id}`}
                  className="text-xs text-[var(--brand-primary)] hover:underline whitespace-nowrap"
                >
                  رفع ملفات
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
