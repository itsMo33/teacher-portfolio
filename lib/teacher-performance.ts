export type PerformanceCategory =
  | "morning_lineup"
  | "supervision"
  | "duty"
  | "waiting_period_activation"
  | "class_time_commitment";

export interface PerformanceCategoryConfig {
  key: PerformanceCategory;
  labelAr: string;
  /** "assumed-present" categories default every teacher to ✓ and only ever store an 'absent'
   *  exception row; "explicit" categories default every teacher to blank and require the admin to
   *  actively mark 'present' or 'absent' for whoever the duty actually applied to that day. */
  mode: "assumed-present" | "explicit";
}

export const PERFORMANCE_CATEGORIES: PerformanceCategoryConfig[] = [
  { key: "morning_lineup", labelAr: "الطابور الصباحي", mode: "assumed-present" },
  { key: "supervision", labelAr: "الإشراف", mode: "explicit" },
  { key: "duty", labelAr: "المناوبة", mode: "explicit" },
  { key: "waiting_period_activation", labelAr: "تفعيل حصص الانتظار", mode: "explicit" },
  { key: "class_time_commitment", labelAr: "الالتزام بزمن الحصة", mode: "assumed-present" },
];

export function getPerformanceCategory(key: string): PerformanceCategoryConfig | undefined {
  return PERFORMANCE_CATEGORIES.find((c) => c.key === key);
}

export function isValidPerformanceCategory(key: string): key is PerformanceCategory {
  return getPerformanceCategory(key) !== undefined;
}
