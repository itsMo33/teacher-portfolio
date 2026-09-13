export type PerformanceCategory =
  | "morning_lineup"
  | "supervision"
  | "duty"
  | "waiting_period_activation"
  | "class_time_commitment";

export type PerformanceStatus = "present" | "absent" | "late";

/** The seven class periods in a school day -- used only by the "period-exception" category, since
 *  a class-time violation happens in one specific period, not for the whole day. */
export const PERFORMANCE_PERIODS = ["1", "2", "3", "4", "5", "6", "7"] as const;
export type PerformancePeriod = (typeof PERFORMANCE_PERIODS)[number];

export interface PerformanceCategoryConfig {
  key: PerformanceCategory;
  labelAr: string;
  /** "assumed-present" categories default every teacher to ✓ and only ever store an 'absent'
   *  exception row; "explicit" categories default every teacher to blank and require the admin to
   *  actively mark 'present' or 'absent' for whoever the duty actually applied to that day.
   *  "period-exception" defaults every teacher to ملتزم (compliant) for every period, and an
   *  exception (متأخر/لم يحضر) is recorded against one specific period rather than the whole day. */
  mode: "assumed-present" | "explicit" | "period-exception";
}

export const PERFORMANCE_CATEGORIES: PerformanceCategoryConfig[] = [
  { key: "morning_lineup", labelAr: "الطابور الصباحي", mode: "assumed-present" },
  { key: "supervision", labelAr: "الإشراف", mode: "explicit" },
  { key: "duty", labelAr: "المناوبة", mode: "explicit" },
  { key: "waiting_period_activation", labelAr: "تفعيل حصص الانتظار", mode: "explicit" },
  { key: "class_time_commitment", labelAr: "الالتزام بزمن الحصة", mode: "period-exception" },
];

export function getPerformanceCategory(key: string): PerformanceCategoryConfig | undefined {
  return PERFORMANCE_CATEGORIES.find((c) => c.key === key);
}

export function isValidPerformanceCategory(key: string): key is PerformanceCategory {
  return getPerformanceCategory(key) !== undefined;
}
