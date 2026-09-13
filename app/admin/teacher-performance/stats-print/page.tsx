import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PERFORMANCE_CATEGORIES } from "@/lib/teacher-performance";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";

export default async function TeacherPerformanceStatsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>;
}) {
  const { teacherId } = await searchParams;
  if (!teacherId) notFound();

  const [{ data: teacher }, { data: records }] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, national_id, subject").eq("id", teacherId).eq("role", "teacher").is("deleted_at", null).maybeSingle(),
    supabaseAdmin
      .from("teacher_performance_records")
      .select("category, record_date, status")
      .eq("teacher_id", teacherId)
      .order("record_date", { ascending: false }),
  ]);

  if (!teacher) notFound();

  const byCategory = PERFORMANCE_CATEGORIES.map((c) => {
    const recs = (records ?? []).filter((r) => r.category === c.key);
    return {
      category: c,
      presentCount: recs.filter((r) => r.status === "present").length,
      absentCount: recs.filter((r) => r.status === "absent").length,
      records: recs,
    };
  });

  const printDate = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

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
        <thead>
          <tr>
            <th colSpan={2} className="border-b border-slate-300 pb-4 pt-2 text-center font-normal">
              <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
              <p className="text-xl font-bold text-slate-900">تقرير إحصائيات متابعة الأداء</p>
              <p className="text-sm text-slate-700 mt-1 font-medium">{teacher.name}</p>
              <p className="text-xs text-slate-500">
                {teacher.national_id}
                {teacher.subject ? ` — ${teacher.subject}` : ""}
              </p>
              <p className="text-xs text-slate-500 mt-1">تاريخ الطباعة: {printDate}</p>
            </th>
          </tr>
        </thead>
        <tbody>
          {byCategory.map(({ category: c, presentCount, absentCount, records: recs }) => (
            <tr key={c.key}>
              <td colSpan={2} className="py-3 px-2 align-top border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{c.labelAr}</h3>
                  <span className="text-slate-600">
                    {c.mode === "assumed-present" ? `غياب: ${absentCount} مرة` : `حضور: ${presentCount} — غياب: ${absentCount}`}
                  </span>
                </div>
                {recs.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pr-3 text-xs text-slate-600">
                    {recs.map((r) => (
                      <li key={r.record_date}>
                        {r.status === "present" ? "✓" : "✗"}{" "}
                        {new Date(`${r.record_date}T00:00:00`).toLocaleDateString("ar-SA", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">لا يوجد سجل</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
