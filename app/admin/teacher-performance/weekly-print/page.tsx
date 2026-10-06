import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getWaitingAssignments } from "@/lib/waiting-activation";
import { addDays, PERFORMANCE_CATEGORIES, schoolWeekDays, weekStartOf } from "@/lib/teacher-performance";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_LABELS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس"];

type CellKind = "ok" | "late" | "absent" | "blank";
interface Cell {
  kind: CellKind;
  text: string;
}

const CELL_STYLE: Record<CellKind, string> = {
  ok: "#dcfce7",
  late: "#fde68a",
  absent: "#fca5a5",
  blank: "#ffffff",
};

function arDate(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
}

/** Today's date in Riyadh (UTC+3), so "not yet happened" days are judged by the school's clock. */
function todayInRiyadh(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function WeeklyPrintPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const today = todayInRiyadh();
  if (week && !DATE_RE.test(week)) notFound();
  const weekStart = weekStartOf(week ?? today);
  const days = schoolWeekDays(weekStart);

  const [{ data: teachers }, { data: records }, { data: prep }] = await Promise.all([
    supabaseAdmin.from("users").select("id, name").eq("role", "teacher").is("deleted_at", null).order("name"),
    supabaseAdmin
      .from("teacher_performance_records")
      .select("teacher_id, category, record_date, status, period, late_minutes")
      .gte("record_date", days[0])
      .lte("record_date", days[4]),
    supabaseAdmin.from("madrasati_prep_weeks").select("teacher_id, status").eq("week_start", weekStart),
  ]);

  const waitingByDay = await getWaitingAssignments(days, teachers ?? []);
  const recordsByKey = new Map<string, { status: string; period: string; minutes: number | null }[]>();
  for (const r of records ?? []) {
    const key = `${r.teacher_id}|${r.category}|${r.record_date}`;
    const list = recordsByKey.get(key) ?? [];
    list.push({ status: r.status, period: r.period, minutes: (r.late_minutes as number | null) ?? null });
    recordsByKey.set(key, list);
  }
  const prepByTeacher = new Map((prep ?? []).map((p) => [p.teacher_id as string, p.status as "yellow" | "red"]));

  function cellFor(teacherId: string, categoryKey: string, mode: string, day: string): Cell {
    const recs = recordsByKey.get(`${teacherId}|${categoryKey}|${day}`) ?? [];
    const future = day > today;

    if (mode === "period-exception") {
      if (recs.length > 0) {
        // a late period carries its minutes in brackets, e.g. 3(10)
        const periods = [...recs]
          .sort((a, b) => a.period.localeCompare(b.period))
          .map((r) => (r.status === "late" && r.minutes ? `${r.period}(${r.minutes})` : r.period));
        const worst = recs.some((r) => r.status === "absent") ? "absent" : "late";
        return { kind: worst, text: periods.length <= 3 ? periods.join(",") : `${periods.length}ح` };
      }
      return future ? { kind: "blank", text: "" } : { kind: "ok", text: "✓" };
    }
    if (mode === "assumed-present") {
      if (recs.some((r) => r.status === "absent")) return { kind: "absent", text: "✗" };
      return future ? { kind: "blank", text: "" } : { kind: "ok", text: "✓" };
    }
    if (mode === "waiting-auto") {
      // green for whoever the waiting table put in as المنتظر that day, red if marked absent
      if (recs.some((r) => r.status === "absent")) return { kind: "absent", text: "✗" };
      return waitingByDay.get(day)?.has(teacherId) ? { kind: "ok", text: "✓" } : { kind: "blank", text: "" };
    }
    // explicit: only teachers who actually had the duty that day have a row
    const rec = recs[0];
    if (!rec) return { kind: "blank", text: "" };
    return rec.status === "present" ? { kind: "ok", text: "✓" } : { kind: "absent", text: "✗" };
  }

  const teacherRows = (teachers ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    cells: PERFORMANCE_CATEGORIES.flatMap((c) => days.map((d) => cellFor(t.id, c.key, c.mode, d))),
    prep: (prepByTeacher.get(t.id) ?? "green") as "green" | "yellow" | "red",
  }));

  const prepStyle = { green: "#86efac", yellow: "#fde047", red: "#f87171" } as const;
  const prepText = { green: "✓", yellow: "!", red: "✗" } as const;
  const totalColumns = 2 + PERFORMANCE_CATEGORIES.length * 5 + 1;

  return (
    <div className="bg-white text-slate-900">
      {/* One landscape page: tiny cells, tight rows. print-color-adjust keeps the green/yellow/red fills. */}
      <style>
        {"@page { size: A4 landscape; margin: 5mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }"}
      </style>

      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin/teacher-performance"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          رجوع
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/admin/teacher-performance/weekly-print?week=${addDays(weekStart, -7)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
            الأسبوع السابق
          </Link>
          <Link href={`/admin/teacher-performance/weekly-print?week=${addDays(weekStart, 7)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
            الأسبوع التالي
          </Link>
          <PrintButton />
        </div>
      </div>

      <table className="w-full border-collapse text-center" style={{ fontSize: "6.5px", tableLayout: "fixed" }}>
        {/* table-layout: fixed reads widths from <col>, not from the header cells. */}
        <colgroup>
          <col style={{ width: "4mm" }} />
          <col style={{ width: "34mm" }} />
          {Array.from({ length: PERFORMANCE_CATEGORIES.length * 5 }).map((_, i) => (
            <col key={i} />
          ))}
          <col style={{ width: "13mm" }} />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={totalColumns} className="border-b border-slate-400 pb-1 text-center font-normal" style={{ fontSize: "9px" }}>
              <strong>{SCHOOL_NAME}</strong> -- متابعة أداء المعلمين الأسبوعية، من {arDate(days[0])} إلى {arDate(days[4])}
            </th>
          </tr>
          <tr>
            <th rowSpan={2} className="border border-slate-500">م</th>
            <th rowSpan={2} className="border border-slate-500 text-right pr-1">اسم المعلم</th>
            {PERFORMANCE_CATEGORIES.map((c) => (
              <th key={c.key} colSpan={5} className="border border-slate-500 bg-slate-100">
                {c.labelAr}
              </th>
            ))}
            <th rowSpan={2} className="border border-slate-500 bg-slate-100">تحضير مدرستي</th>
          </tr>
          <tr>
            {PERFORMANCE_CATEGORIES.flatMap((c) =>
              DAY_LABELS.map((d) => (
                <th key={`${c.key}-${d}`} className="border border-slate-500 font-normal">
                  {d}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {teacherRows.map((t, i) => (
            <tr key={t.id}>
              <td className="border border-slate-500 tabular-nums leading-none" style={{ height: "3.5mm" }}>{i + 1}</td>
              <td className="border border-slate-500 text-right pr-1 leading-none whitespace-nowrap overflow-hidden">{t.name}</td>
              {t.cells.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-slate-500 leading-none"
                  style={{ backgroundColor: CELL_STYLE[cell.kind], padding: 0 }}
                >
                  {cell.text}
                </td>
              ))}
              <td className="border border-slate-500 font-bold leading-none" style={{ backgroundColor: prepStyle[t.prep], padding: 0 }}>
                {prepText[t.prep]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-1 text-slate-600" style={{ fontSize: "6.5px" }}>
        الطابور الصباحي والالتزام بزمن الحصة: ✓ = ملتزم، وتبقى الخانة فاضية للأيام اللي ما جت بعد. الإشراف والمناوبة وتفعيل حصص الانتظار: ✓ حاضر و✗ غائب للي عليه المهمة فقط. الأرقام بخانة الالتزام بزمن الحصة = أرقام الحصص (والرقم بين القوسين = دقائق التأخر)
        (أصفر: متأخر، أحمر: لم يحضر). تحضير مدرستي: أخضر أكمل، أصفر ناقص، أحمر لم يحضّر.
      </p>
    </div>
  );
}
