import { describe, expect, it } from "vitest";
import { inquiryStage, schoolMsBetween } from "./inquiry-clock";

const at = (iso: string) => new Date(iso).getTime();
const HOUR = 60 * 60 * 1000;

describe("schoolMsBetween", () => {
  it("counts a plain school day", () => {
    // Monday 8:00 to Tuesday 8:00 (Riyadh)
    expect(schoolMsBetween(at("2026-11-02T05:00:00Z"), at("2026-11-03T05:00:00Z"))).toBe(24 * HOUR);
  });

  it("leaves out Friday and Saturday", () => {
    // Thursday 8:00 to Sunday 8:00: 16h of Thursday + 8h of Sunday
    expect(schoolMsBetween(at("2026-11-05T05:00:00Z"), at("2026-11-08T05:00:00Z"))).toBe(24 * HOUR);
  });

  it("leaves out an excused day", () => {
    // Sunday 8:00 to Tuesday 8:00 with Monday excused: 24h of Sunday-to-Monday-start + 8h of Tuesday... = 16h + 8h
    expect(schoolMsBetween(at("2026-11-08T05:00:00Z"), at("2026-11-10T05:00:00Z"), ["2026-11-09"])).toBe(24 * HOUR);
  });
});

describe("inquiryStage", () => {
  const base = { createdAt: "2026-11-02T05:00:00Z", teacherOpenedAt: null, justifiedAt: null, decidedAt: null };

  it("starts with the teacher, opened or not", () => {
    expect(inquiryStage(base, [], at("2026-11-02T07:00:00Z"))).toBe("teacher_unopened");
    expect(inquiryStage({ ...base, teacherOpenedAt: "2026-11-02T06:00:00Z" }, [], at("2026-11-02T07:00:00Z"))).toBe("teacher_opened");
  });

  it("is late for the teacher after two school days, weekend not counted", () => {
    expect(inquiryStage(base, [], at("2026-11-04T05:00:00Z"))).toBe("teacher_unopened");
    expect(inquiryStage(base, [], at("2026-11-04T06:00:00Z"))).toBe("teacher_late");
    // sent Thursday: still on time on Sunday
    const thursday = { ...base, createdAt: "2026-11-05T05:00:00Z" };
    expect(inquiryStage(thursday, [], at("2026-11-08T05:00:00Z"))).toBe("teacher_unopened");
    expect(inquiryStage(thursday, [], at("2026-11-09T06:00:00Z"))).toBe("teacher_late");
  });

  it("a teacher's excused days stop only their clock", () => {
    expect(inquiryStage(base, ["2026-11-03"], at("2026-11-04T06:00:00Z"))).toBe("teacher_unopened");
  });

  it("passes to the administration when the teacher answers, and can be late there", () => {
    const answered = { ...base, justifiedAt: "2026-11-03T05:00:00Z" };
    expect(inquiryStage(answered, [], at("2026-11-04T05:00:00Z"))).toBe("admin");
    expect(inquiryStage(answered, [], at("2026-11-05T06:00:00Z"))).toBe("admin_late");
  });

  it("is decided once decided", () => {
    expect(inquiryStage({ ...base, justifiedAt: "2026-11-03T05:00:00Z", decidedAt: "2026-11-03T06:00:00Z" }, [], at("2026-12-01T00:00:00Z"))).toBe("decided");
  });
});
