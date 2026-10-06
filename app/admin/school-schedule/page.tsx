import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { addDays, schoolWeekDays, weekStartOf } from "@/lib/teacher-performance";
import { riyadhToday } from "@/lib/class-time-flags";
import { getWeekSubstitutions } from "@/lib/waiting-activation";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS } from "@/lib/schedule-builder";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Mark {
  status: "late" | "absent";
  minutes: number | null;
  by: string | null;
}

function formatShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("ar-SA", { day: "numeric", month: "numeric" });
}

/** The school schedule, section by section, for the people who track الالتزام بزمن الحصة: each cell has the
 *  subject and its teacher, and shows -- for the chosen week -- a teacher who was marked late / absent (and by
 *  whom) and the waiting-table substitute covering that period. Read-only. */
export default async function SchoolSchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await auth();
  const fullAdmin = !!session && session.user.role !== "teacher" && !session.user.restrictedCategory;
  if (!session || (!session.user.canTrackClassTime && !fullAdmin)) redirect("/admin");

  const { date: dateParam } = await searchParams;
  const weekStart = weekStartOf(dateParam && DATE_RE.test(dateParam) ? dateParam : riyadhToday());
  const days = schoolWeekDays(weekStart);

  const [{ data: sections }, { data: slots }, { data: records }, substitutions] = await Promise.all([
    supabaseAdmin.from("class_sections").select("id, name_ar").order("sort_order").order("name_ar"),
    supabaseAdmin
      .from("schedule_slots")
      .select("section_id, day, period, teacher_id, subject:subjects(name_ar), teacher:users!schedule_slots_teacher_id_fkey(name)"),
    supabaseAdmin
      .from("teacher_performance_records")
      .select("teacher_id, record_date, period, status, late_minutes, recorded_by")
      .eq("category", "class_time_commitment")
      .gte("record_date", days[0])
      .lte("record_date", days[4]),
    getWeekSubstitutions(weekStart),
  ]);

  const recorderIds = [...new Set((records ?? []).map((r) => r.recorded_by as string | null).filter(Boolean) as string[])];
  const { data: recorders } = recorderIds.length
    ? await supabaseAdmin.from("users").select("id, name").in("id", recorderIds)
    : { data: [] };
  const recorderName = new Map((recorders ?? []).map((u) => [u.id as string, u.name as string]));

  // teacher|date|period -> the mark recorded for that teacher in that period
  const markByKey = new Map<string, Mark>();
  for (const r of records ?? []) {
    markByKey.set(`${r.teacher_id}|${r.record_date}|${r.period}`, {
      status: r.status as "late" | "absent",
      minutes: (r.late_minutes as number | null) ?? null,
      by: r.recorded_by ? recorderName.get(r.recorded_by as string) ?? null : null,
    });
  }
  // section|day|period -> the waiting-table assignment covering it
  const substituteByKey = new Map(substitutions.map((s) => [`${s.section}|${s.day}|${s.period}`, s]));

  type SlotRow = {
    section_id: string;
    day: string;
    period: string;
    teacher_id: string;
    subject: { name_ar: string } | { name_ar: string }[] | null;
    teacher: { name: string } | { name: string }[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const slotsBySection = new Map<string, Map<string, SlotRow>>();
  for (const s of (slots ?? []) as unknown as SlotRow[]) {
    const bySlot = slotsBySection.get(s.section_id) ?? new Map<string, SlotRow>();
    bySlot.set(`${s.day}|${s.period}`, s);
    slotsBySection.set(s.section_id, bySlot);
  }

  const weekLabel = `${formatShort(days[0])} — ${formatShort(days[4])}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">الجدول المدرسي</h2>
          <p className="text-sm text-slate-500">
            جداول كل الشعب بالمادة والمعلم. يظهر عليها من تم رصد غيابه أو تأخره ومن رصده، والمعلم المنتظر من جدول الانتظار.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/admin/school-schedule?date=${addDays(weekStart, -7)}`}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            الأسبوع السابق
          </Link>
          <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-200">{weekLabel}</span>
          <Link
            href={`/admin/school-schedule?date=${addDays(weekStart, 7)}`}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            الأسبوع التالي
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(sections ?? []).map((s) => (
          <a
            key={s.id}
            href={`#section-${s.name_ar}`}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {s.name_ar}
          </a>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> لم يحضر
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> متأخر
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> المنتظر
        </span>
      </div>

      {(sections ?? []).map((section) => {
        const bySlot = slotsBySection.get(section.id as string) ?? new Map<string, SlotRow>();
        return (
          <section
            key={section.id}
            id={`section-${section.name_ar}`}
            className="scroll-mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
          >
            <h3 className="mb-2 font-bold text-slate-900 dark:text-slate-50">الشعبة {section.name_ar}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="w-10 border border-slate-200 dark:border-slate-700 p-1.5">الحصة</th>
                    {SCHEDULE_DAYS.map((d, i) => (
                      <th key={d} className="border border-slate-200 dark:border-slate-700 p-1.5">
                        {d}
                        <span className="block font-normal text-slate-400">{formatShort(days[i])}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE_PERIODS.map((period) => (
                    <tr key={period}>
                      <td className="border border-slate-200 dark:border-slate-700 p-1.5 text-center font-bold">{period}</td>
                      {SCHEDULE_DAYS.map((day, i) => {
                        const slot = bySlot.get(`${day}|${period}`);
                        if (!slot) {
                          return <td key={day} className="border border-slate-200 dark:border-slate-700 p-1.5" />;
                        }
                        const mark = markByKey.get(`${slot.teacher_id}|${days[i]}|${period}`);
                        const substitute = substituteByKey.get(`${section.name_ar}|${day}|${period}`);
                        const tone =
                          mark?.status === "absent" || substitute
                            ? "bg-red-50 dark:bg-red-900/20"
                            : mark?.status === "late"
                              ? "bg-amber-50 dark:bg-amber-900/20"
                              : "";
                        return (
                          <td key={day} className={`border border-slate-200 dark:border-slate-700 p-1.5 align-top ${tone}`}>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{one(slot.subject)?.name_ar}</p>
                            <p className="text-slate-500">{one(slot.teacher)?.name}</p>
                            {mark && (
                              <p className={mark.status === "absent" ? "mt-1 text-red-600 dark:text-red-400" : "mt-1 text-amber-700 dark:text-amber-300"}>
                                {mark.status === "absent" ? "لم يحضر" : `متأخر${mark.minutes ? ` ${mark.minutes} د` : ""}`}
                                {mark.by ? ` -- رصده ${mark.by}` : ""}
                              </p>
                            )}
                            {substitute && (
                              <p className="mt-1 text-red-600 dark:text-red-400">
                                المعلم غائب (جدول الانتظار)
                                <span className="block text-emerald-700 dark:text-emerald-400">المنتظر: {substitute.substitute}</span>
                              </p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
