import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

export const SCHOOL_MANAGEMENT_CATEGORIES = [
  { key: "principal", labelAr: "ملف مدير المدرسة", accentColor: "#1d4ed8" },
  { key: "teacher_affairs_agent", labelAr: "ملف وكيل شؤون المعلمين والشؤون التعليمية", accentColor: "#0f766e" },
  { key: "student_affairs_agent", labelAr: "ملف وكيل شؤون الطلاب", accentColor: "#b45309" },
  { key: "student_counselor", labelAr: "ملف الموجه الطلابي", accentColor: "#7c3aed" },
  { key: "student_activity", labelAr: "ملف النشاط الطلابي", accentColor: "#be123c" },
] as const;

export type SchoolManagementCategoryKey = (typeof SCHOOL_MANAGEMENT_CATEGORIES)[number]["key"];

export function isValidSchoolManagementCategory(category: string): category is SchoolManagementCategoryKey {
  return SCHOOL_MANAGEMENT_CATEGORIES.some((c) => c.key === category);
}

export async function getSchoolFiles(category: string) {
  const { data } = await supabaseAdmin
    .from("school_files")
    .select("id, file_name, file_path, mime_type, uploaded_at")
    .eq("category", category)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  return Promise.all(
    (data ?? []).map(async (f) => ({
      ...f,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, f.file_path),
    }))
  );
}
