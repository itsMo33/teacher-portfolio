import { describe, expect, it } from "vitest";
import { matchShortName, OFFICIAL_LOAD, TEACHERS, DAYS, PERIODS } from "./substitute-data";

describe("matchShortName", () => {
  it("matches a full three-part name to its short two-part form", () => {
    expect(matchShortName("عثمان علي الزهراني")).toBe("عثمان الزهراني");
    expect(matchShortName("طلال سعد العسيري")).toBe("طلال العسيري");
  });

  it("tolerates a one-letter spelling variant in the family name", () => {
    // الرزاق vs الرازق -- a real case that surfaced when matching production teacher accounts.
    expect(matchShortName("عبدالرازق سلمان الموسى")).toBe("عبدالرزاق الموسى");
  });

  it("tolerates an آل/ال family-name prefix difference", () => {
    expect(matchShortName("حيدر علي آل صويمل")).toBe("حيدر الصويمل");
  });

  it("matches a short name against itself", () => {
    for (const name of Object.keys(OFFICIAL_LOAD)) {
      expect(matchShortName(name)).toBe(name);
    }
  });

  it("returns null for a name with no plausible match", () => {
    expect(matchShortName("زيد بن غير موجود الوهمي")).toBeNull();
  });

  it("returns null for an empty or whitespace-only name", () => {
    expect(matchShortName("")).toBeNull();
    expect(matchShortName("   ")).toBeNull();
  });
});

describe("OFFICIAL_LOAD", () => {
  it("equals the count of non-null schedule slots for every teacher", () => {
    for (const teacher of TEACHERS) {
      const expected = DAYS.reduce(
        (sum, day) => sum + PERIODS.filter((p) => teacher.schedule[day][p] !== null).length,
        0
      );
      expect(OFFICIAL_LOAD[teacher.name]).toBe(expected);
    }
  });
});
