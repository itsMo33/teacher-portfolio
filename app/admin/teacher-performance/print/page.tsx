import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPerformanceCategory } from "@/lib/teacher-performance";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TeacherPerformancePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; date?: string }>;
}) {
  const { category: categoryKey, date } = await searchParams;

  const category = categoryKey ? getPerformanceCategory(categoryKey) : undefined;
  if (!category || !date || !DATE_RE.test(date)) notFound();

  const [{ data: teachers }, { data: records }] = await Promise.all([
    supabaseAdmin.from("users").select("id, name").eq("role", "teacher").is("deleted_at", null).order("name"),
    supabaseAdmin
      .from("teacher_performance_records")
      .select("teacher_id, status, period")
      .eq("category", category.key)
      .eq("record_date", date),
  ]);

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const nameById = new Map((teachers ?? []).map((t) => [t.id, t.name]));

  const isPeriodMode = category.mode === "period-exception";

  // Period-exception: one row per actual violation (a teacher can have several in one day), sorted
  // by teacher then period -- everyone else is compliant by default and isn't listed at all.
  const periodRows = isPeriodMode
    ? (records ?? [])
        .map((r) => ({ name: nameById.get(r.teacher_id) ?? "", period: r.period, status: r.status as "late" | "absent" }))
        .filter((r) => r.name)
        .sort((a, b) => a.name.localeCompare(b.name, "ar") || a.period.localeCompare(b.period))
    : [];

  // Other modes: one row per teacher for that day (rules unchanged from before).
  const statusByTeacher = new Map((records ?? []).map((r) => [r.teacher_id, r.status as "present" | "absent"]));
  const defaultStatus = category.mode === "assumed-present" ? "present" : null;
  const simpleRows = !isPeriodMode
    ? (teachers ?? [])
        .map((t) => ({ name: t.name, status: statusByTeacher.get(t.id) ?? defaultStatus }))
        .filter((r) => r.status !== null)
    : [];

  return (
    <div className="max-w-2xl mx-auto bg-white text-slate-900 print:max-w-none">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          href="/admin/teacher-performance"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          رجوع
        </Link>
        <PrintButton />
      </div>

      <table className="w-full text-sm border-collapse">
        {/* thead repeats on every printed page, so the title stays visible even past page 1. */}
        <thead>
          <tr>
            <th colSpan={isPeriodMode ? 4 : 3} className="border-b border-slate-300 pb-4 pt-2 text-center font-normal">
              <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
              <p className="text-xl font-bold text-slate-900">تقرير متابعة أداء المعلمين — {category.labelAr}</p>
              <p className="text-sm text-slate-600 mt-1">{dateLabel}</p>
            </th>
          </tr>
          {isPeriodMode ? (
            <tr className="border-b border-slate-300">
              <th className="text-right py-2 px-2">م</th>
              <th className="text-right py-2 px-2">اسم المعلم</th>
              <th className="text-right py-2 px-2">الحصة</th>
              <th className="text-right py-2 px-2">الحالة</th>
            </tr>
          ) : (
            <tr className="border-b border-slate-300">
              <th className="text-right py-2 px-2">م</th>
              <th className="text-right py-2 px-2">اسم المعلم</th>
              <th className="text-right py-2 px-2">الحالة</th>
            </tr>
          )}
        </thead>
        <tbody>
          {isPeriodMode
            ? periodRows.map((r, i) => (
                <tr key={`${r.name}-${r.period}`} className="border-b border-slate-100">
                  <td className="py-1.5 px-2 tabular-nums">{i + 1}</td>
                  <td className="py-1.5 px-2">{r.name}</td>
                  <td className="py-1.5 px-2 tabular-nums">{r.period}</td>
                  <td className="py-1.5 px-2">{r.status === "late" ? "متأخر" : "لم يحضر"}</td>
                </tr>
              ))
            : simpleRows.map((r, i) => (
                <tr key={r.name} className="border-b border-slate-100">
                  <td className="py-1.5 px-2 tabular-nums">{i + 1}</td>
                  <td className="py-1.5 px-2">{r.name}</td>
                  <td className="py-1.5 px-2">{r.status === "present" ? "✓ حاضر" : "✗ غائب"}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
