import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface LogActivityInput {
  actorId: string;
  actorName: string;
  action: string;
  targetTeacherId?: string;
  targetTeacherName?: string;
  details?: string;
}

/** Fire-and-forget activity log insert. Never throws -- a logging failure must not break the underlying operation. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await supabaseAdmin.from("activity_log").insert({
      actor_id: input.actorId,
      actor_name: input.actorName,
      action: input.action,
      target_teacher_id: input.targetTeacherId ?? null,
      target_teacher_name: input.targetTeacherName ?? null,
      details: input.details ?? null,
    });
  } catch {
    // Swallow -- logging is best-effort.
  }
}

export const ACTION_LABELS_AR: Record<string, string> = {
  upload: "رفع ملف",
  soft_delete_attachment: "حذف ملف",
  restore_attachment: "استعادة ملف",
  purge_attachment: "حذف ملف نهائيًا",
  upload_schedule: "رفع الجدول المدرسي",
  create_teacher: "إضافة معلم",
  import_teachers: "استيراد معلمين",
  soft_delete_teacher: "حذف حساب معلم",
  restore_teacher: "استعادة حساب معلم",
  purge_teacher: "حذف حساب معلم نهائيًا",
  upload_school_file: "رفع ملف إدارة المدرسة",
  soft_delete_school_file: "حذف ملف إدارة المدرسة",
};
