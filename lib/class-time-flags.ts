import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { addDays } from "@/lib/teacher-performance";

export interface ClassTimeFlag {
  teacherId: string;
  teacherName: string;
  date: string;
  period: string;
  status: "late" | "absent";
  minutes: number | null;
  recordedById: string | null;
  recordedByName: string | null;
}

/** Today's date in Riyadh (UTC+3), as YYYY-MM-DD. */
export function riyadhToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Late / absent marks from الالتزام بزمن الحصة in the last 7 days (today included), newest first.
 *  `teacherId` limits it to one teacher (their own notice); without it, everyone's (رائد's alerts). */
export async function getRecentClassTimeFlags(teacherId?: string): Promise<ClassTimeFlag[]> {
  const from = addDays(riyadhToday(), -6);
  let query = supabaseAdmin
    .from("teacher_performance_records")
    .select("teacher_id, record_date, period, status, late_minutes, recorded_by, updated_at")
    .eq("category", "class_time_commitment")
    .gte("record_date", from)
    .order("record_date", { ascending: false })
    .order("period", { ascending: true })
    .limit(300);
  if (teacherId) query = query.eq("teacher_id", teacherId);
  const { data } = await query;
  const rows = data ?? [];

  const ids = [...new Set(rows.flatMap((r) => [r.teacher_id as string, r.recorded_by as string | null]).filter(Boolean) as string[])];
  const { data: users } = ids.length ? await supabaseAdmin.from("users").select("id, name").in("id", ids) : { data: [] };
  const nameOf = new Map((users ?? []).map((u) => [u.id as string, u.name as string]));

  return rows.map((r) => ({
    teacherId: r.teacher_id as string,
    teacherName: nameOf.get(r.teacher_id as string) ?? "",
    date: r.record_date as string,
    period: r.period as string,
    status: r.status as "late" | "absent",
    minutes: (r.late_minutes as number | null) ?? null,
    recordedById: (r.recorded_by as string | null) ?? null,
    recordedByName: r.recorded_by ? nameOf.get(r.recorded_by as string) ?? null : null,
  }));
}
