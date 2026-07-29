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

  const filledSlotsByTeacher = new Map<string, Set<string>>();
  for (const a of attachments ?? []) {
    const slotKey = `${a.category}:${a.subcategory ?? ""}`;
    if (!filledSlotsByTeacher.has(a.teacher_id)) {
      filledSlotsByTeacher.set(a.teacher_id, new Set());
    }
    filledSlotsByTeacher.get(a.teacher_id)!.add(slotKey);
  }

  return (teachers ?? []).map((t) => {
    const filledSlots = filledSlotsByTeacher.get(t.id) ?? new Set<string>();
    return {
      ...t,
      completionPercent: Math.round((filledSlots.size / TOTAL_TEACHER_SLOTS) * 100),
      hasSchedule: scheduledTeacherIds.has(t.id),
      filledSlots,
    };
  });
}
