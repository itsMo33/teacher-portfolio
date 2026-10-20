import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  TEACHER_COMPLETION_SLOTS,
  TOTAL_TEACHER_COMPLETION_SLOTS,
  PORTFOLIO_SECTIONS,
  applyProfessionalLicenseExemption,
} from "@/lib/portfolio-sections";

const TEACHER_WRITABLE_CATEGORIES = PORTFOLIO_SECTIONS.filter((s) => s.teacherWritable).map((s) => s.key);

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
  /** Whether this teacher has uploaded a file the admin/agent hasn't opened yet. */
  hasUnviewedByAdmin: boolean;
}

export async function getTeachersWithCompletion(): Promise<TeacherWithCompletion[]> {
  const { data: teachers } = await supabaseAdmin
    .from("users")
    .select("id, name, national_id, subject, professional_license_exempt")
    .eq("role", "teacher")
    .is("deleted_at", null)
    .order("name");

  // PostgREST hands back at most 1000 rows per request, and there are more attachments than that --
  // read them page by page, otherwise teachers' percentages in the lists come out too low.
  const attachments: { teacher_id: string; category: string; subcategory: string | null; admin_viewed_at: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page } = await supabaseAdmin
      .from("attachments")
      .select("teacher_id, category, subcategory, admin_viewed_at")
      .is("deleted_at", null)
      .order("id")
      .range(from, from + 999);
    attachments.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }

  // قياس الأثر is filled in as structured entries rather than uploaded files, but counts toward the same
  // slot -- exactly as getSlotCounts does for the teacher's own dashboard.
  const { data: impactRows } = await supabaseAdmin.from("impact_measurements").select("teacher_id");

  const { data: schedules } = await supabaseAdmin
    .from("schedules")
    .select("teacher_id")
    .is("deleted_at", null);
  const scheduledTeacherIds = new Set((schedules ?? []).map((s) => s.teacher_id));

  const slotCountsByTeacher = new Map<string, Record<string, number>>();
  const unviewedByAdminTeacherIds = new Set<string>();
  for (const a of attachments) {
    const slotKey = `${a.category}:${a.subcategory ?? ""}`;
    if (!slotCountsByTeacher.has(a.teacher_id)) {
      slotCountsByTeacher.set(a.teacher_id, {});
    }
    const counts = slotCountsByTeacher.get(a.teacher_id)!;
    counts[slotKey] = (counts[slotKey] ?? 0) + 1;

    if (!a.admin_viewed_at && (TEACHER_WRITABLE_CATEGORIES as string[]).includes(a.category)) {
      unviewedByAdminTeacherIds.add(a.teacher_id);
    }
  }

  for (const row of impactRows ?? []) {
    const counts = slotCountsByTeacher.get(row.teacher_id) ?? {};
    counts["learning_outcomes:impact_measurement"] = (counts["learning_outcomes:impact_measurement"] ?? 0) + 1;
    slotCountsByTeacher.set(row.teacher_id, counts);
  }

  return (teachers ?? []).map((t) => {
    const slotCounts = applyProfessionalLicenseExemption(
      slotCountsByTeacher.get(t.id) ?? {},
      t.professional_license_exempt ?? false
    );
    const filledSlots = new Set(Object.keys(slotCounts));
    const totalFiles = Object.values(slotCounts).reduce((sum, n) => sum + n, 0);
    const slotRatioSum = TEACHER_COMPLETION_SLOTS.reduce((sum, slot) => {
      const count = slotCounts[`${slot.section}:${slot.subsection ?? ""}`] ?? 0;
      return sum + Math.min(count / slot.requiredCount, 1);
    }, 0);
    return {
      ...t,
      completionPercent: Math.round((slotRatioSum / TOTAL_TEACHER_COMPLETION_SLOTS) * 100),
      hasSchedule: scheduledTeacherIds.has(t.id),
      filledSlots,
      slotCounts,
      totalFiles,
      hasUnviewedByAdmin: unviewedByAdminTeacherIds.has(t.id),
    };
  });
}
