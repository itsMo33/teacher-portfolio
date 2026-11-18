import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getWaitingAbsences } from "@/lib/waiting-activation";

const DAY_MS = 24 * 60 * 60 * 1000;

function riyadhDay(ms: number): string {
  return new Date(ms + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The days each teacher is excused, so their reply clock does not run: the day they uploaded an excuse request
 *  (الاستئذان) and the days the waiting table has them down as absent. Looked up for the last `daysBack` days. */
export async function getExemptDates(teachers: { id: string; name: string }[], daysBack = 60): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (teachers.length === 0) return result;
  const add = (teacherId: string, day: string) => {
    const list = result.get(teacherId) ?? [];
    if (!list.includes(day)) list.push(day);
    result.set(teacherId, list);
  };

  const since = Date.now() - daysBack * DAY_MS;
  const ids = teachers.map((t) => t.id);

  // excuse requests
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabaseAdmin
      .from("attachments")
      .select("teacher_id, uploaded_at")
      .eq("category", "excuse_request")
      .is("deleted_at", null)
      .in("teacher_id", ids.slice(i, i + 100))
      .gte("uploaded_at", new Date(since).toISOString());
    for (const r of data ?? []) add(r.teacher_id as string, riyadhDay(new Date(r.uploaded_at as string).getTime()));
  }

  // absent in the waiting table
  const days = Array.from({ length: daysBack + 1 }, (_, k) => riyadhDay(Date.now() - k * DAY_MS));
  const absences = await getWaitingAbsences(days, teachers);
  for (const [day, byTeacher] of absences) for (const teacherId of byTeacher.keys()) add(teacherId, day);
  return result;
}
