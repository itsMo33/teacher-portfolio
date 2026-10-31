import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { addDays } from "@/lib/teacher-performance";
import { getTrackedPeople } from "@/lib/performance-people";

/** uploaded = green, missing = red, na = a tracked person who isn't a teacher (no weekly plan to hand in). */
export type PlanStatus = "uploaded" | "missing" | "na";

export interface WeeklyPlanRow {
  id: string;
  name: string;
  status: PlanStatus;
  /** What the uploads say, before any manual override. */
  auto: PlanStatus;
  overridden: boolean;
}

/** Who handed in the weekly plan for the school week starting `weekStart` (a Sunday). The plan is checked on the
 *  Monday of that week, and counts if the teacher uploaded one into الخطة الأسبوعية from the previous Monday up to
 *  that Monday (both days included). رائد can flip any teacher by hand; that is stored as an override and wins
 *  over the uploads. */
export async function getWeeklyPlanStatuses(weekStart: string): Promise<WeeklyPlanRow[]> {
  // Monday to Monday: the Monday before the week (weekStart is a Sunday, so six days earlier) through this week's Monday
  const from = `${addDays(weekStart, -6)}T00:00:00+03:00`;
  const to = `${addDays(weekStart, 2)}T00:00:00+03:00`;

  const [{ data: people }, { data: uploads }, { data: marks }] = await Promise.all([
    getTrackedPeople(),
    supabaseAdmin
      .from("attachments")
      .select("teacher_id, uploaded_by")
      .eq("category", "weekly_plan_admin")
      .is("deleted_at", null)
      .gte("uploaded_at", from)
      .lt("uploaded_at", to),
    supabaseAdmin.from("weekly_plan_marks").select("teacher_id, status").eq("week_start", weekStart),
  ]);

  // only what the teacher uploaded themselves counts, not a file an admin put there for them
  const uploaded = new Set((uploads ?? []).filter((u) => u.uploaded_by === u.teacher_id).map((u) => u.teacher_id as string));
  const override = new Map((marks ?? []).map((m) => [m.teacher_id as string, m.status as "uploaded" | "missing"]));

  return people.map((p) => {
    if (p.role !== "teacher") return { id: p.id, name: p.name, status: "na" as const, auto: "na" as const, overridden: false };
    const auto: PlanStatus = uploaded.has(p.id) ? "uploaded" : "missing";
    const manual = override.get(p.id);
    return { id: p.id, name: p.name, status: manual ?? auto, auto, overridden: manual !== undefined && manual !== auto };
  });
}
