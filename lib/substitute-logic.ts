import { DAYS, DayKey, OFFICIAL_LOAD, PERIODS, PeriodKey, TEACHER_BY_NAME } from "./substitute-data";
import { STATIC_RANK_TABLE } from "./substitute-static-schedule";

export interface SubstituteAssignment {
  day: DayKey;
  period: PeriodKey;
  absentTeacher: string;
  section: string;
  substitute: string;
  rank: number;
  timestamp: string;
}

export interface Candidate {
  name: string;
  official: number;
  subCount: number;
  total: number;
}

function weeklySubCount(assignments: SubstituteAssignment[], name: string): number {
  return assignments.filter((a) => a.substitute === name).length;
}

function isAlreadyAssignedThatSlot(
  assignments: SubstituteAssignment[],
  name: string,
  day: DayKey,
  period: PeriodKey
): boolean {
  return assignments.some((a) => a.substitute === name && a.day === day && a.period === period);
}

/**
 * Ranked substitute candidates for a given (day, period, absent teacher) slot, best first.
 * The ranking itself comes from the school's finalized static schedule (STATIC_RANK_TABLE) --
 * the only runtime filtering is excluding whoever is already covering a *different* absence in
 * this exact slot, since one teacher can't be in two places at the same time.
 */
export function getCandidates(
  assignments: SubstituteAssignment[],
  day: DayKey,
  period: PeriodKey,
  absentTeacherName: string
): Candidate[] {
  const staticList = STATIC_RANK_TABLE[day]?.[period] ?? [];

  return staticList
    .filter((name) => name !== absentTeacherName)
    .filter((name) => !isAlreadyAssignedThatSlot(assignments, name, day, period))
    .map((name) => {
      const official = OFFICIAL_LOAD[name] ?? 0;
      const subCount = weeklySubCount(assignments, name);
      return { name, official, subCount, total: official + subCount };
    });
}

export const RANK_LABELS = [
  "المنتظر الأول",
  "المنتظر الثاني",
  "المنتظر الثالث",
  "المنتظر الرابع",
  "المنتظر الخامس",
];

export interface AbsenceGroupRow {
  period: PeriodKey;
  section: string | null;
  assignment: SubstituteAssignment | null;
}

export interface AbsenceGroup {
  day: DayKey;
  absentTeacher: string;
  rows: AbsenceGroupRow[];
}

/** One printable slip per (day, absent teacher) pair that has at least one assignment, covering all 7 periods of that day. */
export function buildAbsenceGroups(assignments: SubstituteAssignment[]): AbsenceGroup[] {
  const seen = new Map<string, { day: DayKey; absentTeacher: string }>();
  for (const a of assignments) {
    const key = `${a.day}|${a.absentTeacher}`;
    if (!seen.has(key)) seen.set(key, { day: a.day, absentTeacher: a.absentTeacher });
  }

  const groups: AbsenceGroup[] = [...seen.values()].map(({ day, absentTeacher }) => {
    const teacher = TEACHER_BY_NAME[absentTeacher];
    const rows: AbsenceGroupRow[] = PERIODS.map((period) => ({
      period,
      section: teacher ? teacher.schedule[day][period] : null,
      assignment: assignments.find((a) => a.day === day && a.period === period && a.absentTeacher === absentTeacher) ?? null,
    }));
    return { day, absentTeacher, rows };
  });

  groups.sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.absentTeacher.localeCompare(b.absentTeacher, "ar");
  });

  return groups;
}
