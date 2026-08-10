export type SectionKey =
  | "achievement_file"
  | "schedule"
  | "weekly_term_plan"
  | "professional_community"
  | "meetings_and_visits"
  | "teaching_strategies"
  | "learning_outcomes"
  | "parent_interaction"
  | "achievements"
  | "lesson_prep"
  | "tasks_assignments";

export interface Subsection {
  key: string;
  labelAr: string;
}

export interface PortfolioSection {
  key: SectionKey;
  labelAr: string;
  hasSubsections: boolean;
  subsections?: Subsection[];
  teacherWritable: boolean;
}

export const PORTFOLIO_SECTIONS: PortfolioSection[] = [
  {
    key: "achievement_file",
    labelAr: "ملف الإنجاز",
    hasSubsections: false,
    teacherWritable: true,
  },
  {
    key: "schedule",
    labelAr: "الجدول المدرسي",
    hasSubsections: false,
    teacherWritable: false,
  },
  {
    key: "weekly_term_plan",
    labelAr: "الخطة الأسبوعية والفصلية",
    hasSubsections: false,
    teacherWritable: true,
  },
  {
    key: "professional_community",
    labelAr: "المجتمع المهني",
    hasSubsections: true,
    subsections: [
      { key: "visits", labelAr: "زيارات" },
      { key: "meetings", labelAr: "اجتماعات" },
    ],
    teacherWritable: true,
  },
  {
    key: "meetings_and_visits",
    labelAr: "الاجتماعات والزيارات الإدارية",
    hasSubsections: true,
    subsections: [
      { key: "principal_meetings", labelAr: "الاجتماعات مع المدير" },
      { key: "admin_classroom_visits", labelAr: "الزيارات الصفية مع الإدارة" },
    ],
    teacherWritable: false,
  },
  {
    key: "teaching_strategies",
    labelAr: "استراتيجيات التدريس",
    hasSubsections: false,
    teacherWritable: true,
  },
  {
    key: "learning_outcomes",
    labelAr: "نواتج التعلم",
    hasSubsections: true,
    subsections: [
      { key: "diagnosis", labelAr: "تشخيص الطلاب" },
      { key: "pre_test", labelAr: "الاختبار القبلي" },
      { key: "post_test", labelAr: "الاختبار البعدي" },
      { key: "remedial_plan", labelAr: "الخطة العلاجية" },
      { key: "impact_measurement", labelAr: "قياس الأثر" },
    ],
    teacherWritable: true,
  },
  {
    key: "parent_interaction",
    labelAr: "التفاعل مع أولياء الأمور",
    hasSubsections: false,
    teacherWritable: true,
  },
  {
    key: "achievements",
    labelAr: "الإنجازات",
    hasSubsections: true,
    subsections: [
      { key: "courses", labelAr: "الدورات" },
      { key: "certificates", labelAr: "الشهادات" },
      { key: "recognition", labelAr: "الشكر والتكريم" },
      { key: "volunteering", labelAr: "الأعمال التطوعية" },
      { key: "initiatives", labelAr: "المبادرات" },
    ],
    teacherWritable: true,
  },
  {
    key: "lesson_prep",
    labelAr: "تحضير الدروس",
    hasSubsections: false,
    teacherWritable: true,
  },
  {
    key: "tasks_assignments",
    labelAr: "المهام والتكاليف",
    hasSubsections: false,
    teacherWritable: false,
  },
];

export function getSection(key: string): PortfolioSection | undefined {
  return PORTFOLIO_SECTIONS.find((s) => s.key === key);
}

export function isValidCategory(category: string, subcategory?: string | null): boolean {
  const section = getSection(category);
  if (!section) return false;
  if (!section.hasSubsections) return !subcategory;
  if (!subcategory) return false;
  return !!section.subsections?.some((s) => s.key === subcategory);
}

/** Total number of trackable "slots" across all sections (subsections count individually).
 *  The schedule is tracked separately since it is admin-uploaded, not teacher-completed. */
export const TEACHER_SLOTS: { section: SectionKey; subsection?: string; labelAr: string }[] =
  PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule").flatMap((s) =>
    s.hasSubsections
      ? s.subsections!.map((sub) => ({
          section: s.key,
          subsection: sub.key,
          labelAr: `${s.labelAr} - ${sub.labelAr}`,
        }))
      : [{ section: s.key, labelAr: s.labelAr }]
  );

export const TOTAL_TEACHER_SLOTS = TEACHER_SLOTS.length;

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
];

export const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".png"];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
