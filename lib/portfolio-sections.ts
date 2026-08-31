export type SectionKey =
  | "achievement_file"
  | "schedule"
  | "weekly_term_plan"
  | "weekly_plan_admin"
  | "professional_community"
  | "meetings_and_visits"
  | "teaching_strategies"
  | "learning_outcomes"
  | "parent_interaction"
  | "achievements"
  | "lesson_prep"
  | "tasks_assignments"
  | "accountability"
  | "excuse_request";

export interface Subsection {
  key: string;
  labelAr: string;
  /** Optional short requirement note shown next to this subsection, e.g. "زيارتان كحد أدنى". */
  note?: string;
  /** Number of uploaded files needed for this subsection to reach 100%. Defaults to 1. Uploading more is always allowed. */
  requiredCount?: number;
  /** Whether to show a numeric percentage badge for this subsection. When false, shows an encouraging message / trophy instead. */
  showPercent?: boolean;
}

export interface PortfolioSection {
  key: SectionKey;
  labelAr: string;
  hasSubsections: boolean;
  subsections?: Subsection[];
  teacherWritable: boolean;
  /** Optional short note shown next to the section title, e.g. "منصة مدرستي". */
  note?: string;
  /** Hex accent color used to visually distinguish this section's card/heading. */
  accentColor: string;
  /** Number of uploaded files needed for this section to reach 100% (sections without subsections only). Defaults to 1. Uploading more is always allowed. */
  requiredCount?: number;
  /** Whether to show a numeric percentage badge for this section. When false, shows an encouraging message / trophy instead. Only meaningful for sections without subsections -- with subsections, each subsection's own showPercent applies. */
  showPercent?: boolean;
}

export const PORTFOLIO_SECTIONS: PortfolioSection[] = [
  {
    key: "schedule",
    labelAr: "الجدول المدرسي",
    hasSubsections: false,
    teacherWritable: false,
    accentColor: "#2563eb",
  },
  {
    key: "achievement_file",
    labelAr: "ملف الإنجاز",
    hasSubsections: true,
    subsections: [
      { key: "general", labelAr: "ملف الإنجاز", showPercent: true },
      { key: "professional_license", labelAr: "الرخصة المهنية", showPercent: true },
    ],
    teacherWritable: true,
    accentColor: "#059669",
  },
  {
    key: "weekly_term_plan",
    labelAr: "توزيع المنهج",
    hasSubsections: false,
    teacherWritable: true,
    showPercent: true,
    accentColor: "#4f46e5",
  },
  {
    key: "weekly_plan_admin",
    labelAr: "الخطة الأسبوعية",
    hasSubsections: false,
    teacherWritable: true,
    requiredCount: 17,
    showPercent: true,
    accentColor: "#6366f1",
  },
  {
    key: "lesson_prep",
    labelAr: "توثيق من منصة مدرستي لتحضير الدروس",
    hasSubsections: false,
    teacherWritable: true,
    accentColor: "#0284c7",
  },
  {
    key: "teaching_strategies",
    labelAr: "استراتيجيات التدريس",
    hasSubsections: false,
    teacherWritable: true,
    note: "ثلاث استراتيجيات كحد أدنى في الفصل الدراسي",
    requiredCount: 3,
    showPercent: true,
    accentColor: "#ea580c",
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
      { key: "student_followup_sheet", labelAr: "كشف متابعة الطلاب" },
      { key: "student_affairs_agent_contact", labelAr: "التواصل مع وكيل شؤون الطلاب" },
      { key: "student_counselor_contact", labelAr: "التواصل مع الموجهين الطلابيين" },
    ],
    teacherWritable: true,
    accentColor: "#e11d48",
  },
  {
    key: "parent_interaction",
    labelAr: "التواصل مع أولياء الأمور في منصة مدرستي",
    hasSubsections: false,
    teacherWritable: true,
    accentColor: "#0891b2",
  },
  {
    key: "professional_community",
    labelAr: "المجتمع المهني",
    hasSubsections: true,
    subsections: [
      { key: "visits", labelAr: "زيارات", note: "زيارتان كحد أدنى", requiredCount: 2, showPercent: true },
      { key: "meetings", labelAr: "اجتماعات", note: "ثلاث اجتماعات كحد أدنى", requiredCount: 3, showPercent: true },
    ],
    teacherWritable: true,
    accentColor: "#0d9488",
  },
  {
    key: "achievements",
    labelAr: "الإنجازات",
    hasSubsections: true,
    subsections: [
      { key: "courses", labelAr: "الدورات" },
      { key: "recognition", labelAr: "الشكر والتكريم" },
      { key: "volunteering_initiatives", labelAr: "الأعمال التطوعية والمبادرات" },
    ],
    teacherWritable: true,
    accentColor: "#d97706",
  },
  {
    key: "meetings_and_visits",
    labelAr: "الاجتماعات والزيارات الإدارية",
    hasSubsections: true,
    subsections: [
      { key: "principal_meetings", labelAr: "الاجتماعات من وكيل شؤون المعلمين" },
      { key: "admin_classroom_visits", labelAr: "الزيارات الصفية مع الإدارة" },
    ],
    teacherWritable: false,
    accentColor: "#7c3aed",
  },
  {
    key: "tasks_assignments",
    labelAr: "المهام والتكاليف",
    hasSubsections: true,
    subsections: [
      { key: "administrative_tasks", labelAr: "التكاليف الإدارية" },
      { key: "exam_writing", labelAr: "تكاليف وضع الاختبارات" },
      { key: "duty", labelAr: "المناوبة" },
      { key: "recess_supervision", labelAr: "إشراف الفسحة" },
      { key: "curriculum_completion_acknowledgment", labelAr: "إقرار إنهاء المنهج" },
    ],
    teacherWritable: false,
    accentColor: "#c026d3",
  },
  {
    key: "accountability",
    labelAr: "مسائلات",
    hasSubsections: false,
    teacherWritable: false,
    accentColor: "#dc2626",
  },
  {
    key: "excuse_request",
    labelAr: "الاستئذان",
    hasSubsections: true,
    subsections: [
      { key: "hospital_appointments", labelAr: "مواعيد المستشفى" },
      { key: "health_center_appointments", labelAr: "مواعيد المراكز الصحية" },
      { key: "other", labelAr: "أخرى" },
    ],
    teacherWritable: true,
    accentColor: "#65a30d",
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
export const TEACHER_SLOTS: { section: SectionKey; subsection?: string; labelAr: string; requiredCount: number }[] =
  PORTFOLIO_SECTIONS.filter((s) => s.key !== "schedule").flatMap((s) =>
    s.hasSubsections
      ? s.subsections!.map((sub) => ({
          section: s.key,
          subsection: sub.key,
          labelAr: `${s.labelAr} - ${sub.labelAr}`,
          requiredCount: sub.requiredCount ?? 1,
        }))
      : [{ section: s.key, labelAr: s.labelAr, requiredCount: s.requiredCount ?? 1 }]
  );

export const TOTAL_TEACHER_SLOTS = TEACHER_SLOTS.length;

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

export const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ACCOUNTABILITY_STATUSES = ["excused", "rejected"] as const;
export type AccountabilityStatus = (typeof ACCOUNTABILITY_STATUSES)[number];

export const ACCOUNTABILITY_STATUS_LABELS_AR: Record<AccountabilityStatus, string> = {
  excused: "مقبول بعذر",
  rejected: "غير مقبول",
};
