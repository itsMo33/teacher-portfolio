/** The two clocks of an inquiry, counted in school time: the teacher's (from the moment it reaches them to their answer)
 *  and the administration's (from the answer to the decision). Each has two school days. Friday and Saturday do not
 *  count, and neither do the days a teacher is excused (an excuse request, or absent in the waiting table), so nobody is
 *  late because of a weekend or a leave. Pure code -- the browser uses it too. */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const RIYADH_OFFSET = 3 * HOUR;

/** Two school days to answer, and two school days to decide. */
export const INQUIRY_WINDOW_DAYS = 2;
export const INQUIRY_WINDOW_MS = INQUIRY_WINDOW_DAYS * DAY;

/** The Riyadh calendar day (YYYY-MM-DD) of an instant. */
function riyadhDay(ms: number): string {
  return new Date(ms + RIYADH_OFFSET).toISOString().slice(0, 10);
}

/** Friday (5) and Saturday (6) are the weekend. */
function isWeekend(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 5 || weekday === 6;
}

/** Milliseconds of school time between two instants: every Riyadh day from Sunday to Thursday that is not in `exempt`. */
export function schoolMsBetween(fromMs: number, toMs: number, exempt: readonly string[] = []): number {
  if (toMs <= fromMs) return 0;
  const skip = new Set(exempt);
  let total = 0;
  // walk day by day; the guard keeps a bad date from looping forever
  let cursor = fromMs;
  for (let guard = 0; cursor < toMs && guard < 800; guard++) {
    const day = riyadhDay(cursor);
    const dayEnd = (Math.floor((cursor + RIYADH_OFFSET) / DAY) + 1) * DAY - RIYADH_OFFSET;
    const segmentEnd = Math.min(dayEnd, toMs);
    if (!isWeekend(day) && !skip.has(day)) total += segmentEnd - cursor;
    cursor = segmentEnd;
  }
  return total;
}

export type InquiryStage =
  /** Sent to the teacher, who has not opened it. */
  | "teacher_unopened"
  /** The teacher opened it and has not answered yet (still inside their time). */
  | "teacher_opened"
  /** The teacher's two school days are over with no answer: the administration may decide without one. */
  | "teacher_late"
  /** The teacher answered: it waits on the administration. */
  | "admin"
  /** The teacher answered and two school days passed without a decision. */
  | "admin_late"
  | "decided";

export interface StageInput {
  createdAt: string;
  teacherOpenedAt: string | null;
  justifiedAt: string | null;
  decidedAt: string | null;
}

/** Whose turn it is, and whether they are late. `exempt` is the teacher's excused days (they only stop the teacher's clock). */
export function inquiryStage(i: StageInput, exempt: readonly string[] = [], now: number = Date.now()): InquiryStage {
  if (i.decidedAt) return "decided";
  if (!i.justifiedAt) {
    if (schoolMsBetween(new Date(i.createdAt).getTime(), now, exempt) > INQUIRY_WINDOW_MS) return "teacher_late";
    return i.teacherOpenedAt ? "teacher_opened" : "teacher_unopened";
  }
  return schoolMsBetween(new Date(i.justifiedAt).getTime(), now) > INQUIRY_WINDOW_MS ? "admin_late" : "admin";
}

/** Where the inquiry is, in words, for badges. */
export const STAGE_OWNER: Record<InquiryStage, "teacher" | "admin" | null> = {
  teacher_unopened: "teacher",
  teacher_opened: "teacher",
  teacher_late: "teacher",
  admin: "admin",
  admin_late: "admin",
  decided: null,
};
