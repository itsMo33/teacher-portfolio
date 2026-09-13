import { describe, expect, it } from "vitest";
import { getCandidates, getAlwaysAvailableCandidates, buildAbsenceGroups, SubstituteAssignment } from "./substitute-logic";
import { STATIC_RANK_TABLE, ALWAYS_AVAILABLE_TEACHERS } from "./substitute-static-schedule";

function makeAssignment(overrides: Partial<SubstituteAssignment> = {}): SubstituteAssignment {
  return {
    id: "test-id",
    day: "احد",
    period: "2",
    absentTeacher: "عادل المنصور",
    section: "106",
    substitute: "عثمان الزهراني",
    rank: 1,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("getCandidates", () => {
  it("returns the static ranking in order for an empty slot", () => {
    const expected = STATIC_RANK_TABLE["احد"]!["2"]!;
    const candidates = getCandidates([], "احد", "2", "غير موجود");
    expect(candidates.map((c) => c.name)).toEqual(expected);
  });

  it("excludes the absent teacher even if they appear in the static ranking", () => {
    const list = STATIC_RANK_TABLE["احد"]!["2"]!;
    const candidates = getCandidates([], "احد", "2", list[0]);
    expect(candidates.map((c) => c.name)).not.toContain(list[0]);
  });

  it("excludes a candidate already covering a different absence in the same slot", () => {
    const list = STATIC_RANK_TABLE["احد"]!["2"]!;
    const assignments = [makeAssignment({ day: "احد", period: "2", substitute: list[1] })];
    const candidates = getCandidates(assignments, "احد", "2", "شخص آخر غائب");
    expect(candidates.map((c) => c.name)).not.toContain(list[1]);
  });

  it("counts a candidate's own weekly substitute assignments toward their total", () => {
    const list = STATIC_RANK_TABLE["اثنين"]!["3"]!;
    const substitute = list[0];
    const assignments = [makeAssignment({ day: "احد", period: "2", substitute, absentTeacher: "شخص غائب آخر" })];
    const candidates = getCandidates(assignments, "اثنين", "3", "غير موجود");
    const match = candidates.find((c) => c.name === substitute)!;
    expect(match.subCount).toBe(1);
    expect(match.total).toBe(match.official + 1);
  });

  it("returns an empty list for a slot with no static ranking", () => {
    expect(getCandidates([], "احد", "1", "غير موجود")).toEqual([]);
  });
});

describe("getAlwaysAvailableCandidates", () => {
  it("returns nothing for period 1 or 7", () => {
    expect(getAlwaysAvailableCandidates([], "احد", "1", "غير موجود")).toEqual([]);
    expect(getAlwaysAvailableCandidates([], "احد", "7", "غير موجود")).toEqual([]);
  });

  it("returns all four standing substitutes for a mid-day period", () => {
    const names = getAlwaysAvailableCandidates([], "احد", "4", "غير موجود");
    expect(names.sort()).toEqual([...ALWAYS_AVAILABLE_TEACHERS].sort());
  });

  it("excludes one already assigned to a different absence in that slot", () => {
    const assignments = [makeAssignment({ day: "احد", period: "4", substitute: ALWAYS_AVAILABLE_TEACHERS[0] })];
    const names = getAlwaysAvailableCandidates(assignments, "احد", "4", "شخص آخر غائب");
    expect(names).not.toContain(ALWAYS_AVAILABLE_TEACHERS[0]);
    expect(names.length).toBe(ALWAYS_AVAILABLE_TEACHERS.length - 1);
  });
});

describe("buildAbsenceGroups", () => {
  it("groups assignments by (day, absentTeacher) and covers all 7 periods", () => {
    const assignments = [
      makeAssignment({ day: "احد", period: "2", absentTeacher: "عادل المنصور" }),
      makeAssignment({ day: "احد", period: "4", absentTeacher: "عادل المنصور", substitute: "شخص ثاني" }),
    ];
    const groups = buildAbsenceGroups(assignments);
    expect(groups).toHaveLength(1);
    expect(groups[0].day).toBe("احد");
    expect(groups[0].absentTeacher).toBe("عادل المنصور");
    expect(groups[0].rows).toHaveLength(7);
    expect(groups[0].rows.find((r) => r.period === "2")?.assignment?.substitute).toBe("عثمان الزهراني");
    expect(groups[0].rows.find((r) => r.period === "4")?.assignment?.substitute).toBe("شخص ثاني");
    expect(groups[0].rows.find((r) => r.period === "1")?.assignment).toBeNull();
  });

  it("keeps separate absences on the same day as separate groups", () => {
    const assignments = [
      makeAssignment({ day: "احد", absentTeacher: "معلم أول" }),
      makeAssignment({ day: "احد", absentTeacher: "معلم ثاني" }),
    ];
    expect(buildAbsenceGroups(assignments)).toHaveLength(2);
  });

  it("returns an empty list for no assignments", () => {
    expect(buildAbsenceGroups([])).toEqual([]);
  });
});
