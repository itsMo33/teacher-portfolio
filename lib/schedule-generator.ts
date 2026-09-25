import { SCHEDULE_DAYS, SCHEDULE_PERIODS, ScheduleDay, SchedulePeriod } from "@/lib/schedule-builder";

export interface GeneratorTask {
  requirementId: string;
  sectionId: string;
  sectionName: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

export interface GeneratorPlacement {
  sectionId: string;
  subjectId: string;
  teacherId: string;
  day: ScheduleDay;
  period: SchedulePeriod;
}

export const ALL_SLOTS: { day: ScheduleDay; period: SchedulePeriod }[] = SCHEDULE_DAYS.flatMap((day) =>
  SCHEDULE_PERIODS.map((period) => ({ day, period }))
);

export function slotKey(day: string, period: string) {
  return `${day}::${period}`;
}

/** Best-effort constraint-based generator: places every (section, subject, teacher) requirement's
 *  remaining periods/week into free slots, never double-booking a teacher or a section, and never
 *  violating a teacher's unavailability. Uses a randomized "most constrained first" greedy search
 *  with several restarts, keeping whichever attempt leaves the fewest requirements unmet -- a full
 *  optimal solver isn't worth the complexity at this scale (a handful of sections, 35 slots each). */
export function runGeneratorAttempt(
  tasksIn: GeneratorTask[],
  sectionBusyIn: Map<string, Set<string>>,
  teacherBusyIn: Map<string, Set<string>>,
  subjectDayCountIn: Map<string, number>,
  isUnavailable: (teacherId: string, day: ScheduleDay, period: SchedulePeriod) => boolean
) {
  const sectionBusy = new Map(Array.from(sectionBusyIn, ([k, v]) => [k, new Set(v)]));
  const teacherBusy = new Map(Array.from(teacherBusyIn, ([k, v]) => [k, new Set(v)]));
  const subjectDayCount = new Map(subjectDayCountIn);
  const remaining = [...tasksIn].sort(() => Math.random() - 0.5);
  const placements: GeneratorPlacement[] = [];
  const unmet: GeneratorTask[] = [];

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestCandidates: { day: ScheduleDay; period: SchedulePeriod }[] = [];

    for (let i = 0; i < remaining.length; i++) {
      const task = remaining[i];
      const candidates = ALL_SLOTS.filter(
        ({ day, period }) =>
          !sectionBusy.get(task.sectionId)?.has(slotKey(day, period)) &&
          !teacherBusy.get(task.teacherId)?.has(slotKey(day, period)) &&
          !isUnavailable(task.teacherId, day, period)
      );
      if (bestIdx === -1 || candidates.length < bestCandidates.length) {
        bestIdx = i;
        bestCandidates = candidates;
        if (candidates.length === 0) break;
      }
    }

    const task = remaining[bestIdx];
    remaining.splice(bestIdx, 1);

    if (bestCandidates.length === 0) {
      unmet.push(task);
      continue;
    }

    // Prefer a day this subject hasn't already used in this section, to spread periods out
    // across the week instead of stacking them all on one day.
    let minCount = Infinity;
    for (const c of bestCandidates) {
      const count = subjectDayCount.get(`${task.sectionId}::${task.subjectId}::${c.day}`) ?? 0;
      if (count < minCount) minCount = count;
    }
    const spreadCandidates = bestCandidates.filter(
      (c) => (subjectDayCount.get(`${task.sectionId}::${task.subjectId}::${c.day}`) ?? 0) === minCount
    );
    const chosen = spreadCandidates[Math.floor(Math.random() * spreadCandidates.length)];

    const key = slotKey(chosen.day, chosen.period);
    if (!sectionBusy.has(task.sectionId)) sectionBusy.set(task.sectionId, new Set());
    if (!teacherBusy.has(task.teacherId)) teacherBusy.set(task.teacherId, new Set());
    sectionBusy.get(task.sectionId)!.add(key);
    teacherBusy.get(task.teacherId)!.add(key);
    const dayCountKey = `${task.sectionId}::${task.subjectId}::${chosen.day}`;
    subjectDayCount.set(dayCountKey, (subjectDayCount.get(dayCountKey) ?? 0) + 1);

    placements.push({
      sectionId: task.sectionId,
      subjectId: task.subjectId,
      teacherId: task.teacherId,
      day: chosen.day,
      period: chosen.period,
    });
  }

  return { placements, unmet };
}

export function runGenerator(
  tasks: GeneratorTask[],
  sectionBusy: Map<string, Set<string>>,
  teacherBusy: Map<string, Set<string>>,
  subjectDayCount: Map<string, number>,
  isUnavailable: (teacherId: string, day: ScheduleDay, period: SchedulePeriod) => boolean,
  attempts = 15
) {
  let best: { placements: GeneratorPlacement[]; unmet: GeneratorTask[] } | null = null;
  for (let i = 0; i < attempts; i++) {
    const result = runGeneratorAttempt(tasks, sectionBusy, teacherBusy, subjectDayCount, isUnavailable);
    if (!best || result.unmet.length < best.unmet.length) best = result;
    if (best.unmet.length === 0) break;
  }
  return best!;
}
