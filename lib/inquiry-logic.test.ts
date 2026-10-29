import { describe, expect, it } from "vitest";
import { detectExcuses, displayText, evaluateDelay, extractMinutes, parseInquiryPages } from "./inquiry-logic";

const teachers = [
  { id: "t1", name: "عبدالرحيم محمد القرني" },
  { id: "t2", name: "احمد يحيى الزهراني" },
  { id: "t3", name: "احمد عبدالله البراك" },
];

describe("evaluateDelay", () => {
  it("accepts 3 minutes or less and rejects more", () => {
    expect(evaluateDelay(3, null).decision).toBe("accepted");
    expect(evaluateDelay(2, "زحمة").decision).toBe("accepted");
    expect(evaluateDelay(4, null).decision).toBe("rejected");
  });

  it("tells رائد when a late teacher gave one of the usual excuses", () => {
    expect(evaluateDelay(10, "تأخرت بسبب توصيل أبنائي للمدرسة").note).toContain("أبناء");
    expect(evaluateDelay(10, "كان في ازدحام شديد").note).toContain("ازدحام");
    expect(evaluateDelay(7, "كنت مريض").note).toContain("مرض");
    expect(evaluateDelay(7, "تعطلت سيارتي").note).toContain("عطل");
    expect(evaluateDelay(7, "عرقة سير على الطريق").note).toContain("عرقلة سير");
  });

  it("gives no suggestion when the delay is unknown", () => {
    expect(evaluateDelay(null, "مرض").decision).toBeNull();
  });
});

describe("detectExcuses", () => {
  it("finds nothing in an unrelated sentence", () => {
    expect(detectExcuses("نسيت المنبه")).toEqual([]);
  });
});

describe("extractMinutes", () => {
  it("reads Arabic and Western digits", () => {
    expect(extractMinutes("تأخر ٧ دقائق عن الحصة")).toBe(7);
    expect(extractMinutes("التأخر: 12 دقيقة")).toBe(12);
    expect(extractMinutes("بدون رقم")).toBeNull();
  });
});

describe("parseInquiryPages", () => {
  it("gives a one-teacher page to that teacher", () => {
    const items = parseInquiryPages(["مسائلة تأخر المعلم عبدالرحيم محمد القرني تأخر 8 دقائق عن الطابور"], teachers);
    expect(items).toEqual([
      expect.objectContaining({ teacherId: "t1", page: 1, pageOnly: true, minutes: 8 }),
    ]);
  });

  it("splits a table page into one item per teacher", () => {
    const page = "م الاسم التأخر 1 احمد يحيى الزهراني 5 دقائق 2 عبدالرحيم القرني 2 دقيقة";
    const items = parseInquiryPages([page], teachers);
    expect(items.map((i) => [i.teacherId, i.minutes, i.pageOnly])).toEqual([
      ["t2", 5, false],
      ["t1", 2, false],
    ]);
  });

  it("keeps two teachers with the same first name apart", () => {
    const items = parseInquiryPages(["احمد عبدالله البراك تأخر 9 دقائق"], teachers);
    expect(items[0].teacherId).toBe("t3");
  });

  it("returns an unmatched item for a page that names nobody", () => {
    const items = parseInquiryPages(["صفحة بدون أسماء 4 دقائق"], teachers);
    expect(items[0]).toEqual(expect.objectContaining({ teacherId: null, page: 1 }));
  });
});

describe("parseInquiryPages with awkward PDF text", () => {
  it("finds names when the spaces were lost", () => {
    const items = parseInquiryPages(["المعلمعبدالرحيممحمدالقرنيتأخر 6 دقائق"], teachers);
    expect(items[0]).toEqual(expect.objectContaining({ teacherId: "t1", minutes: 6 }));
  });

  it("finds names in presentation-form letters", () => {
    const items = parseInquiryPages(["ﺍﺣﻤﺪﻳﺤﻴﻰﺍǄﺰﻫﺮﺍﻧﻲ ﺗﺄﺧﺮ ٥ ﺩﻗﺎﺋﻖ"], teachers);
    expect(items[0].teacherId).toBe("t2");
    expect(items[0].minutes).toBe(5);
  });

  it("finds names when the line came out reversed", () => {
    const reversed = [..."مسائلة المعلم عبدالرحيم محمد القرني"].reverse().join("");
    const items = parseInquiryPages([reversed], teachers);
    expect(items[0].teacherId).toBe("t1");
  });
});

describe("displayText", () => {
  it("folds presentation forms and accepts clean text", () => {
    expect(displayText("ﻣﺴﺎﺋﻞ ﺗﺄﺧﺮ 5 ﺩﻗﺎﺋﻖ").readable).toBe(true);
    expect(displayText("مسائلة تأخر 5 دقائق").text).toBe("مسائلة تأخر 5 دقائق");
  });

  it("flags text with stray symbols or merged words as unreadable", () => {
    expect(displayText("ﺍǄﺜﺎﻧﻲ ﺗﺄﺧﺮ").readable).toBe(false);
    expect(displayText("تأخر٥دقائقعنالطابورالصباحيهذاالملفتجريبي").readable).toBe(false);
  });
});
