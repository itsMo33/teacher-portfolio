import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { PORTFOLIO_SECTIONS, applyProfessionalLicenseExemption } from "@/lib/portfolio-sections";

export async function getFilledSlots(teacherId: string): Promise<Set<string>> {
  const counts = await getSlotCounts(teacherId);
  return new Set(Object.keys(counts));
}

/** Maps "category:subcategory" (subcategory empty string when the section has none) to how many files were uploaded to that slot. */
export async function getSlotCounts(teacherId: string): Promise<Record<string, number>> {
  const [{ data }, { data: teacher }, { count: impactCount }] = await Promise.all([
    supabaseAdmin.from("attachments").select("category, subcategory").eq("teacher_id", teacherId).is("deleted_at", null),
    supabaseAdmin.from("users").select("professional_license_exempt").eq("id", teacherId).maybeSingle(),
    supabaseAdmin.from("impact_measurements").select("id", { count: "exact", head: true }).eq("teacher_id", teacherId),
  ]);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = `${row.category}:${row.subcategory ?? ""}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  // قياس الأثر moved from file uploads to structured entries -- count those the same way so
  // completion tracking keeps working without a separate special case downstream.
  if (impactCount) {
    const key = "learning_outcomes:impact_measurement";
    counts[key] = (counts[key] ?? 0) + impactCount;
  }
  return applyProfessionalLicenseExemption(counts, teacher?.professional_license_exempt ?? false);
}

export interface ImpactMeasurement {
  id: string;
  teacherId: string;
  subject: string;
  studentName: string;
  className: string;
  maxScore: number;
  scoreBefore: number;
  scoreAfter: number;
  improvementLevel: string;
  teacherNotes: string | null;
  recommendations: string[];
  createdAt: string;
}

function toImpactMeasurement(row: {
  id: string;
  teacher_id: string;
  subject: string;
  student_name: string;
  class_name: string;
  max_score: number;
  score_before: number;
  score_after: number;
  improvement_level: string;
  teacher_notes: string | null;
  recommendations: string[];
  created_at: string;
}): ImpactMeasurement {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    subject: row.subject,
    studentName: row.student_name,
    className: row.class_name,
    maxScore: row.max_score,
    scoreBefore: row.score_before,
    scoreAfter: row.score_after,
    improvementLevel: row.improvement_level,
    teacherNotes: row.teacher_notes,
    recommendations: row.recommendations ?? [],
    createdAt: row.created_at,
  };
}

export async function getImpactMeasurements(teacherId: string): Promise<ImpactMeasurement[]> {
  const { data } = await supabaseAdmin
    .from("impact_measurements")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(toImpactMeasurement);
}

export async function getImpactMeasurement(id: string): Promise<ImpactMeasurement | null> {
  const { data } = await supabaseAdmin.from("impact_measurements").select("*").eq("id", id).maybeSingle();
  return data ? toImpactMeasurement(data) : null;
}

export async function getProfessionalLicenseExempt(teacherId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("professional_license_exempt")
    .eq("id", teacherId)
    .maybeSingle();
  return data?.professional_license_exempt ?? false;
}

export async function getHasSchedule(teacherId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("schedules")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .is("deleted_at", null);
  return (count ?? 0) > 0;
}

/** Section keys (from the admin-managed sections, excluding schedule) that have at least one attachment the teacher hasn't opened yet. */
export async function getUnviewedAdminSectionKeys(teacherId: string): Promise<Set<string>> {
  const adminCategories = PORTFOLIO_SECTIONS.filter((s) => !s.teacherWritable && s.key !== "schedule").map(
    (s) => s.key
  );

  const { data } = await supabaseAdmin
    .from("attachments")
    .select("category")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .is("viewed_at", null)
    .in("category", adminCategories);

  return new Set((data ?? []).map((row) => row.category));
}

/** Section keys (teacher-writable) that have at least one attachment the admin hasn't opened yet. */
export async function getUnviewedByAdminSectionKeys(teacherId: string): Promise<Set<string>> {
  const teacherWritableCategories = PORTFOLIO_SECTIONS.filter((s) => s.teacherWritable).map((s) => s.key);

  const { data } = await supabaseAdmin
    .from("attachments")
    .select("category")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .is("admin_viewed_at", null)
    .in("category", teacherWritableCategories);

  return new Set((data ?? []).map((row) => row.category));
}

export async function getHasUnviewedSchedule(teacherId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("schedules")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .is("viewed_at", null);
  return (count ?? 0) > 0;
}

/** All مسائلات attachments across every teacher, newest first, for the admin overview page. */
export async function getAllAccountabilityAttachments() {
  const { data } = await supabaseAdmin
    .from("attachments")
    .select("id, teacher_id, file_name, file_path, uploaded_at, accountability_status")
    .eq("category", "accountability")
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  return Promise.all(
    (data ?? []).map(async (a) => ({
      ...a,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, a.file_path),
    }))
  );
}

export async function getSectionAttachments(
  teacherId: string,
  category: string,
  subcategory: string | null
) {
  let query = supabaseAdmin
    .from("attachments")
    .select("id, file_name, file_path, mime_type, uploaded_at, viewed_at, admin_viewed_at, accountability_status")
    .eq("teacher_id", teacherId)
    .eq("category", category)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  query = subcategory ? query.eq("subcategory", subcategory) : query.is("subcategory", null);

  const { data } = await query;

  return Promise.all(
    (data ?? []).map(async (a) => ({
      ...a,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, a.file_path),
    }))
  );
}
