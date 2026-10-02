/** Shared (client + server) constants for the student-referral workflow: teacher -> وكيل شؤون
 *  الطلاب -> الموجه الطلابي. The procedure lists mirror the paper forms; a procedure is stored
 *  by its number so the wording can be fixed here later without touching saved referrals. */

export const REFERRAL_REASONS = [
  "ضعف دراسي",
  "عدم اداء الواجب",
  "ضعف نتائج الاختبارات",
  "الغياب",
  "مشاكل سلوكية",
] as const;

export const AGENT_PROCEDURES: { n: number; text: string }[] = [
  { n: 1, text: "الاتصال هاتفيًا بولي الأمر / استدعاء ولي الأمر لمقابلته وأخذ تعهد" },
  { n: 2, text: "استدعاء الطالب لمقابلته" },
  { n: 3, text: "تصحيح أفكار خاطئة" },
  { n: 4, text: "عرض الحالة على لجنة التوجيه والإرشاد" },
  { n: 5, text: "تطبيق لائحة السلوك والمواظبة" },
  { n: 6, text: "التزويد بنشرات إلكترونية" },
  { n: 7, text: "استخدام أساليب التعزيز" },
  { n: 8, text: "حث المعلم على التعامل معه بإيجابية" },
  { n: 9, text: "الاطلاع على مخاطر الغياب عن الدراسة" },
  { n: 10, text: "أخذ تعهد على الطالب" },
  { n: 11, text: "تذليل الصعوبات التي تواجه الطالب ووضع الحلول للحد من الغياب" },
  { n: 12, text: "التواصل مع إدارة التوجيه والإرشاد في إدارة التعليم" },
  { n: 13, text: "توعية أولياء الأمور بأهمية متابعة أبنائهم وتحفيزهم على استخدام منصة مدرستي" },
];

/** Item 19 on the counselor's paper form is a free-text box ("خدمات إضافية"), kept as its own
 *  field (counselor_extra_services) rather than a checkbox, so it isn't in this list. */
export const COUNSELOR_PROCEDURES: { n: number; text: string }[] = [
  { n: 1, text: "الاتصال هاتفيًا بولي الأمر / استدعاء ولي الأمر لأخذ تعهد" },
  { n: 2, text: "استدعاء الطالب لمقابلته" },
  { n: 3, text: "عقد مقابلة إرشادية عن بعد / بالمدرسة لمعالجة المشكلة" },
  { n: 4, text: "تصحيح أفكار خاطئة" },
  { n: 5, text: "بحث المشكلة مع وكيل شؤون الطلاب" },
  { n: 6, text: "عرض الحالة على لجنة التوجيه والإرشاد" },
  { n: 7, text: "استخدام أساليب التعزيز" },
  { n: 8, text: "فتح ملف دراسة حالة" },
  { n: 9, text: "التزويد بنشرات إلكترونية" },
  { n: 10, text: "حث المعلم على التعامل معه بإيجابية" },
  { n: 11, text: "إضافة رقم ولي الأمر في برنامج حالات وإملاء الخاص بالموجه الطلابي" },
  { n: 12, text: "تبصير الطالب بالمشكلة" },
  { n: 13, text: "الاطلاع على مخاطر الغياب عن الدراسة" },
  { n: 14, text: "تقديم الخدمات الإرشادية للطالب ولأولياء الأمور" },
  { n: 15, text: "التواصل مع إدارة التوجيه والإرشاد في إدارة التعليم" },
  { n: 16, text: "تذليل الصعوبات التي تواجه الطالب ووضع الحلول للحد من الغياب" },
  { n: 17, text: "تقديم الخدمات الإرشادية المناسبة للطالب متكرر الغياب" },
  { n: 18, text: "توعية أولياء الأمور بأهمية متابعة أبنائهم وتحفيزهم على استخدام منصة مدرستي" },
];

export type ReferralStatus = "draft" | "with_agent" | "with_counselor";

export const STATUS_LABELS: Record<ReferralStatus, string> = {
  draft: "مسودة (لم تُرسل)",
  with_agent: "عند وكيل شؤون الطلاب",
  with_counselor: "عند الموجه الطلابي",
};

export type ReferralFileStage = "agent" | "counselor";

export const STAGE_LABELS: Record<ReferralFileStage, string> = {
  agent: "وكيل شؤون الطلاب",
  counselor: "الموجه الطلابي",
};
