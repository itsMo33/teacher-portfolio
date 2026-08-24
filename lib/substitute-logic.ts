import {
  CAPPED_TEACHERS,
  CAPPED_WEEKLY_LIMIT,
  DAYS,
  DayKey,
  EXEMPT_TEACHERS,
  MAX_TOTAL_PERIODS,
  OFFICIAL_LOAD,
  PERIODS,
  PeriodKey,
  TEACHER_BY_NAME,
  TEACHERS,
} from "./substitute-data";

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

function daySubCount(assignments: SubstituteAssignment[], name: string, day: DayKey): number {
  return assignments.filter((a) => a.substitute === name && a.day === day).length;
}

function isBusyOwnSchedule(name: string, day: DayKey, period: PeriodKey): boolean {
  const teacher = TEACHERS.find((t) => t.name === name);
  return !!teacher && teacher.schedule[day][period] !== null;
}

function isAlreadyAssignedThatSlot(
  assignments: SubstituteAssignment[],
  name: string,
  day: DayKey,
  period: PeriodKey
): boolean {
  return assignments.some((a) => a.substitute === name && a.day === day && a.period === period);
}

/** Ranks eligible substitute candidates for a given (day, period, absent teacher) slot, best first. */
export function getCandidates(
  assignments: SubstituteAssignment[],
  day: DayKey,
  period: PeriodKey,
  absentTeacherName: string
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const teacher of TEACHERS) {
    if (teacher.name === absentTeacherName) continue;
    if (EXEMPT_TEACHERS.has(teacher.name)) continue;
    if (isBusyOwnSchedule(teacher.name, day, period)) continue;
    if (isAlreadyAssignedThatSlot(assignments, teacher.name, day, period)) continue;

    const subCount = weeklySubCount(assignments, teacher.name);

    if (CAPPED_TEACHERS.has(teacher.name)) {
      if (subCount >= CAPPED_WEEKLY_LIMIT) continue;
      if (daySubCount(assignments, teacher.name, day) >= 1) continue;
    }

    const official = OFFICIAL_LOAD[teacher.name] ?? 0;
    const total = official + subCount;
    if (total >= MAX_TOTAL_PERIODS) continue;

    candidates.push({ name: teacher.name, official, subCount, total });
  }

  candidates.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    if (a.official !== b.official) return a.official - b.official;
    return a.name.localeCompare(b.name, "ar");
  });

  return candidates.slice(0, 5);
}

export const RANK_LABELS = ["المنتظر الأول", "المنتظر الثاني", "المنتظر الثالث", "المنتظر الرابع", "المنتظر الخامس"];

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
