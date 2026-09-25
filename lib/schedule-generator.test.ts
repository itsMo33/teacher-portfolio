import { describe, expect, it } from "vitest";
import { GeneratorTask, runGenerator, slotKey } from "./schedule-generator";
import { SCHEDULE_DAYS, SCHEDULE_PERIODS } from "./schedule-builder";

function task(overrides: Partial<GeneratorTask> = {}): GeneratorTask {
  return {
    requirementId: "req-1",
    sectionId: "section-1",
    sectionName: "301",
    subjectId: "subject-1",
    subjectName: "رياضيات",
    teacherId: "teacher-1",
    teacherName: "معلم",
    ...overrides,
  };
}

const noUnavailability = () => false;

describe("runGenerator", () => {
  it("places every task when there's ample room and no conflicts", () => {
    const tasks = [task(), task()];
    const { placements, unmet } = runGenerator(tasks, new Map(), new Map(), new Map(), noUnavailability);
    expect(placements).toHaveLength(2);
    expect(unmet).toHaveLength(0);
    const keys = placements.map((p) => slotKey(p.day, p.period));
    expect(new Set(keys).size).toBe(2);
  });

  it("never double-books the same teacher across two different sections", () => {
    const tasks = [
      task({ sectionId: "section-A" }),
      task({ sectionId: "section-B" }),
    ];
    const { placements, unmet } = runGenerator(tasks, new Map(), new Map(), new Map(), noUnavailability);
    expect(unmet).toHaveLength(0);
    const keys = placements.map((p) => slotKey(p.day, p.period));
    expect(new Set(keys).size).toBe(2);
  });

  it("never double-books the same section for two different teachers", () => {
    const tasks = [
      task({ teacherId: "teacher-A" }),
      task({ teacherId: "teacher-B" }),
    ];
    const { placements, unmet } = runGenerator(tasks, new Map(), new Map(), new Map(), noUnavailability);
    expect(unmet).toHaveLength(0);
    const keys = placements.map((p) => slotKey(p.day, p.period));
    expect(new Set(keys).size).toBe(2);
  });

  it("never places a task in a slot the teacher is marked unavailable for", () => {
    const tasks = Array.from({ length: 10 }, () => task());
    const isUnavailable = (_teacherId: string, _day: string, period: string) => period === "6";
    const { placements } = runGenerator(tasks, new Map(), new Map(), new Map(), isUnavailable as never);
    expect(placements.every((p) => p.period !== "6")).toBe(true);
  });

  it("respects a whole-day unavailability constraint", () => {
    const tasks = Array.from({ length: 10 }, () => task());
    const isUnavailable = (_teacherId: string, day: string) => day === "خميس";
    const { placements } = runGenerator(tasks, new Map(), new Map(), new Map(), isUnavailable as never);
    expect(placements.every((p) => p.day !== "خميس")).toBe(true);
  });

  it("reports unmet tasks instead of double-booking when demand exceeds capacity", () => {
    const totalSlots = SCHEDULE_DAYS.length * SCHEDULE_PERIODS.length;
    const tasks = Array.from({ length: totalSlots + 3 }, () => task());
    const { placements, unmet } = runGenerator(tasks, new Map(), new Map(), new Map(), noUnavailability);
    expect(placements).toHaveLength(totalSlots);
    expect(unmet).toHaveLength(3);
    const keys = placements.map((p) => slotKey(p.day, p.period));
    expect(new Set(keys).size).toBe(totalSlots);
  });

  it("respects slots already occupied by pre-existing bookings", () => {
    const sectionBusy = new Map([["section-1", new Set([slotKey("احد", "1")])]]);
    const teacherBusy = new Map([["teacher-1", new Set([slotKey("احد", "1")])]]);
    const { placements } = runGenerator([task()], sectionBusy, teacherBusy, new Map(), noUnavailability);
    expect(placements).toHaveLength(1);
    expect(slotKey(placements[0].day, placements[0].period)).not.toBe(slotKey("احد", "1"));
  });
});
