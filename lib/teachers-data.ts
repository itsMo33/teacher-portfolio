import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { TOTAL_TEACHER_SLOTS } from "@/lib/portfolio-sections";

export interface TeacherWithCompletion {
  id: string;
  name: string;
  national_id: string;
  subject: string | null;
  completionPercent: number;
  hasSchedule: boolean;
  filledSlots: Set<string>;
  /** Maps "category:subcategory" to how many files were uploaded to that slot. */
  slotCounts: Record<string, number>;
  /** Total number of files uploaded by this teacher across all sections. */
  totalFiles: number;
}

export async function getTeachersWithCompletion(): Promise<TeacherWithCompletion[]> {
  const { data: teachers } = await supabaseAdmin
    .from("users")
    .select("id, name, national_id, subject")
    .eq("role", "teacher")
    .order("name");

  const { data: attachments } = await supabaseAdmin
    .from("attachments")
    .select("teacher_id, category, subcategory");

  const { data: schedules } = await supabaseAdmin.from("schedules").select("teacher_id");
  const scheduledTeacherIds = new Set((schedules ?? []).map((s) => s.teacher_id));

  const slotCountsByTeacher = new Map<string, Record<string, number>>();
  for (const a of attachments ?? []) {
    const slotKey = `${a.category}:${a.subcategory ?? ""}`;
    if (!slotCountsByTeacher.has(a.teacher_id)) {
      slotCountsByTeacher.set(a.teacher_id, {});
    }
    const counts = slotCountsByTeacher.get(a.teacher_id)!;
    counts[slotKey] = (counts[slotKey] ?? 0) + 1;
  }

  return (teachers ?? []).map((t) => {
    const slotCounts = slotCountsByTeacher.get(t.id) ?? {};
    const filledSlots = new Set(Object.keys(slotCounts));
    const totalFiles = Object.values(slotCounts).reduce((sum, n) => sum + n, 0);
    return {
      ...t,
      completionPercent: Math.round((filledSlots.size / TOTAL_TEACHER_SLOTS) * 100),
      hasSchedule: scheduledTeacherIds.has(t.id),
      filledSlots,
      slotCounts,
      totalFiles,
    };
  });
}
