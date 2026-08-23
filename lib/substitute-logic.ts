import {
  CAPPED_TEACHERS,
  CAPPED_WEEKLY_LIMIT,
  DayKey,
  EXEMPT_TEACHERS,
  MAX_TOTAL_PERIODS,
  OFFICIAL_LOAD,
  PeriodKey,
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
