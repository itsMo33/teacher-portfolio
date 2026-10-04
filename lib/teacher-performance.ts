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
   *  exception (متأخر/لم يحضر) is recorded against one specific period rather than the whole day.
   *  "waiting-auto" takes who counts as present from the waiting table (a teacher put in as المنتظر is
   *  green for that day); only a no-show is stored, as an 'absent' row. */
  mode: "assumed-present" | "explicit" | "period-exception" | "waiting-auto";
}

export const PERFORMANCE_CATEGORIES: PerformanceCategoryConfig[] = [
  { key: "morning_lineup", labelAr: "الطابور الصباحي", mode: "assumed-present" },
  { key: "supervision", labelAr: "الإشراف", mode: "explicit" },
  { key: "duty", labelAr: "المناوبة", mode: "explicit" },
  { key: "waiting_period_activation", labelAr: "تفعيل حصص الانتظار", mode: "waiting-auto" },
  { key: "class_time_commitment", labelAr: "الالتزام بزمن الحصة", mode: "period-exception" },
];

export function getPerformanceCategory(key: string): PerformanceCategoryConfig | undefined {
  return PERFORMANCE_CATEGORIES.find((c) => c.key === key);
}

export function isValidPerformanceCategory(key: string): key is PerformanceCategory {
  return getPerformanceCategory(key) !== undefined;
}

/** تحضير مدرستي is tracked once per week, not per day: every teacher starts the week green, and a
 *  click cycles green -> yellow -> red -> green. Green is "no row"; only yellow/red are stored, keyed
 *  by the week's Sunday (see madrasati_prep_weeks). */
export type MadrasatiPrepStatus = "green" | "yellow" | "red";

export const MADRASATI_PREP_LABELS_AR: Record<MadrasatiPrepStatus, string> = {
  green: "أكمل التحضير",
  yellow: "ناقص",
  red: "لم يحضّر",
};

export function nextMadrasatiPrepStatus(current: MadrasatiPrepStatus): MadrasatiPrepStatus {
  return current === "green" ? "yellow" : current === "yellow" ? "red" : "green";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The Sunday on or before `day` (YYYY-MM-DD) -- the school week runs Sunday to Thursday. */
export function weekStartOf(day: string): string {
  const ms = parseDay(day);
  return formatDay(ms - new Date(ms).getUTCDay() * DAY_MS);
}

export function addDays(day: string, days: number): string {
  return formatDay(parseDay(day) + days * DAY_MS);
}

/** The five school days of the week starting on `weekStart`, Sunday first. */
export function schoolWeekDays(weekStart: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
}
