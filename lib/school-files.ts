import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

export interface SchoolManagementSubsection {
  key: string;
  labelAr: string;
}

export interface SchoolManagementCategory {
  key: string;
  labelAr: string;
  accentColor: string;
  subsections?: SchoolManagementSubsection[];
}

export const SCHOOL_MANAGEMENT_CATEGORIES: SchoolManagementCategory[] = [
  { key: "principal", labelAr: "ملف مدير المدرسة", accentColor: "#1d4ed8" },
  { key: "teacher_affairs_agent", labelAr: "ملف وكيل شؤون المعلمين والشؤون التعليمية", accentColor: "#0f766e" },
  {
    key: "student_affairs_agent",
    labelAr: "وكيل شؤون الطلاب",
    accentColor: "#b45309",
    subsections: [
      { key: "plan", labelAr: "خطة شؤون الطلاب" },
      { key: "attendance", labelAr: "الحضور والغياب والمواظبة" },
      { key: "conduct_discipline", labelAr: "السلوك والانضباط" },
      { key: "struggling_students", labelAr: "متابعة الطلاب المتعثرين" },
      { key: "programs_activities", labelAr: "البرامج والأنشطة الطلابية" },
      { key: "parent_communication", labelAr: "التواصل مع أولياء الأمور" },
      { key: "meetings_minutes", labelAr: "الاجتماعات والمحاضر" },
    ],
  },
  { key: "student_counselor", labelAr: "ملف الموجه الطلابي", accentColor: "#7c3aed" },
  { key: "student_activity", labelAr: "ملف النشاط الطلابي", accentColor: "#be123c" },
  { key: "security_safety", labelAr: "الأمن والسلامة", accentColor: "#0284c7" },
  {
    key: "school_labs",
    labelAr: "المختبرات المدرسية",
    accentColor: "#059669",
    subsections: [
      { key: "weekly_visits", labelAr: "الزيارات الأسبوعية" },
      { key: "inventory_equipment", labelAr: "الجرد والتجهيزات" },
    ],
  },
  {
    key: "student_guidance",
    labelAr: "التوجيه الطلابي",
    accentColor: "#c026d3",
    subsections: [
      { key: "operational_plan", labelAr: "الخطة التشغيلية" },
      { key: "programs_events", labelAr: "البرامج والفعاليات" },
      { key: "individual_cases", labelAr: "الحالات الفردية" },
      { key: "absence_tardiness", labelAr: "الغياب والتأخر" },
      { key: "behavior_attendance", labelAr: "السلوك والمواظبة" },
      { key: "academic_struggles", labelAr: "التعثر الدراسي والخطط العلاجية" },
      { key: "academic_career_guidance", labelAr: "التوجيه التعليمي والمهني" },
      { key: "parent_communication", labelAr: "التواصل مع أولياء الأمور" },
      { key: "meetings_minutes", labelAr: "الاجتماعات والمحاضر" },
    ],
  },
];

export type SchoolManagementCategoryKey = (typeof SCHOOL_MANAGEMENT_CATEGORIES)[number]["key"];

export function getSchoolManagementCategory(key: string) {
  return SCHOOL_MANAGEMENT_CATEGORIES.find((c) => c.key === key);
}

export function isValidSchoolManagementCategory(category: string): boolean {
  return SCHOOL_MANAGEMENT_CATEGORIES.some((c) => c.key === category);
}

export function isValidSchoolManagementSlot(category: string, subcategory: string | null): boolean {
  const cat = getSchoolManagementCategory(category);
  if (!cat) return false;
  if (!cat.subsections) return !subcategory;
  if (!subcategory) return false;
  return cat.subsections.some((s) => s.key === subcategory);
}

export async function getSchoolFiles(category: string, subcategory: string | null = null) {
  let query = supabaseAdmin
    .from("school_files")
    .select("id, file_name, file_path, mime_type, uploaded_at")
    .eq("category", category)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  query = subcategory ? query.eq("subcategory", subcategory) : query.is("subcategory", null);

  const { data } = await query;

  return Promise.all(
    (data ?? []).map(async (f) => ({
      ...f,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, f.file_path),
    }))
  );
}

/** Category keys that have at least one account scoped exclusively to them -- for those, only
 *  that account can upload/delete; everyone else (full admins) gets a read-only view. */
export async function getOwnedCategoryKeys(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("restricted_category")
    .not("restricted_category", "is", null)
    .is("deleted_at", null);

  return new Set((data ?? []).map((row) => row.restricted_category as string));
}
