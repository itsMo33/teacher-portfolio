import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { matchShortName, OFFICIAL_LOAD, RESERVE_TEACHER_NAMES } from "@/lib/substitute-data";
import { weekStartOf } from "@/lib/teacher-performance";

const DAY_KEYS = ["احد", "اثنين", "ثلاثاء", "اربعاء", "خميس"] as const;

function weekdayKey(date: string): string | null {
  const [y, m, d] = date.split("-").map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? null;
}

/** Riyadh calendar day of a timestamp -- the school week is judged in local time, not UTC. */
function riyadhDay(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** تفعيل حصص الانتظار follows the waiting table: a teacher put in as المنتظر for a slot counts as present
 *  for that day automatically, and only a no-show needs marking. A substitute assignment has a weekday but
 *  no date, so it applies to the matching weekday of the week it was made in (archived weeks included).
 *
 *  Returns, per requested date, which teacher ids were assigned and in which periods. */
export async function getWaitingAssignments(
  dates: string[],
  teachers: { id: string; name: string }[]
): Promise<Map<string, Map<string, string[]>>> {
  return collectByDate(dates, teachers, "substitute");
}

/** The other side of the waiting table: who was put down as ABSENT on each date, and in which periods. Used so the
 *  performance tracker shows them as absent instead of letting them be marked late. */
export async function getWaitingAbsences(
  dates: string[],
  teachers: { id: string; name: string }[]
): Promise<Map<string, Map<string, string[]>>> {
  return collectByDate(dates, teachers, "absent_teacher");
}

// the waiting table names people by short name, and its reserve substitutes have no official load
const WAITING_NAMES = [...Object.keys(OFFICIAL_LOAD), ...RESERVE_TEACHER_NAMES];

async function collectByDate(
  dates: string[],
  teachers: { id: string; name: string }[],
  field: "substitute" | "absent_teacher"
): Promise<Map<string, Map<string, string[]>>> {
  const result = new Map<string, Map<string, string[]>>(dates.map((d) => [d, new Map()]));
  if (dates.length === 0) return result;

  const idByShortName = new Map<string, string>();
  for (const t of teachers) {
    const short = matchShortName(t.name, WAITING_NAMES);
    if (short) idByShortName.set(short, t.id);
  }

  const weeks = new Set(dates.map(weekStartOf));
  const { data } = await supabaseAdmin.from("substitute_assignments").select("day, period, substitute, absent_teacher, created_at");

  for (const row of data ?? []) {
    const teacherId = idByShortName.get(row[field] as string);
    if (!teacherId) continue;
    const week = weekStartOf(riyadhDay(row.created_at as string));
    if (!weeks.has(week)) continue;
    for (const date of dates) {
      if (weekStartOf(date) !== week || weekdayKey(date) !== row.day) continue;
      const byTeacher = result.get(date)!;
      byTeacher.set(teacherId, [...(byTeacher.get(teacherId) ?? []), row.period as string]);
    }
  }
  return result;
}

export interface WeekSubstitution {
  day: string;
  period: string;
  section: string;
  absentTeacher: string;
  substitute: string;
}

/** The waiting-table assignments made during the school week that starts on `weekStart` (archived
 *  ones included), for showing "المعلم غائب -- المنتظر: ..." on the school schedule. */
export async function getWeekSubstitutions(weekStart: string): Promise<WeekSubstitution[]> {
  const { data } = await supabaseAdmin
    .from("substitute_assignments")
    .select("day, period, section, absent_teacher, substitute, created_at");
  return (data ?? [])
    .filter((r) => weekStartOf(riyadhDay(r.created_at as string)) === weekStart)
    .map((r) => ({
      day: r.day as string,
      period: r.period as string,
      section: r.section as string,
      absentTeacher: r.absent_teacher as string,
      substitute: r.substitute as string,
    }));
}
