/** The pure part of the مسائلات workflow (no database, no PDF reading): turning a PDF's text into one
 *  item per teacher, and the silent decision rule for the delay inquiries. Kept apart so it can be tested. */

export type InquiryKind = "delay" | "other";
export type InquiryDecision = "accepted" | "rejected";

/** More than this many minutes late is rejected (3 or fewer is accepted). */
export const MAX_ACCEPTED_DELAY_MINUTES = 3;

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Loose Arabic normalisation for matching: presentation forms folded, diacritics / tatweel dropped,
 *  alef / ya / ta-marbuta variants unified, digits made ASCII. Never used for display. */
export function normalizeArabic(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_INDIC.indexOf(d)))
    .toLowerCase();
}

const stripAl = (w: string) => (w.startsWith("ال") && w.length > 3 ? w.slice(2) : w);

export interface TeacherName {
  id: string;
  name: string;
}

export interface ParsedInquiry {
  teacherId: string | null;
  teacherName: string | null;
  page: number;
  /** True when this teacher is the only one on the page, so the page can be cut out and given to them alone. */
  pageOnly: boolean;
  text: string;
  minutes: number | null;
}

/** Minutes late as written in a piece of text ("تأخر 7 دقائق", "٥ دقيقة", "10 د"), or null. */
export function extractMinutes(text: string): number | null {
  const t = normalizeArabic(text);
  const direct = t.match(/(\d{1,3})\s*(?:دقيقه|دقايق|دقائق|دقيقة|د\b)/);
  if (direct) return Number(direct[1]);
  const labelled = t.match(/(?:تاخر|تاخير|مده)\w*\s*[:\-]?\s*(\d{1,3})\b/);
  return labelled ? Number(labelled[1]) : null;
}

interface Hit {
  teacher: TeacherName;
  start: number;
  score: number;
}

/** Finds each teacher on a page: the first and last word of their name close together (either order,
 *  since extracted Arabic can come out reversed), with the middle words as a tie-breaker. The page is
 *  cut into one segment per hit, from a name to the next name. */
function findHits(words: string[], teachers: TeacherName[]): Hit[] {
  const norm = words.map((w) => stripAl(normalizeArabic(w)).replace(/[^\p{L}\p{N}]/gu, ""));
  const hits: Hit[] = [];

  for (const teacher of teachers) {
    const parts = normalizeArabic(teacher.name)
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => stripAl(w));
    if (parts.length < 2) continue;
    const first = parts[0];
    const last = parts[parts.length - 1];
    const middle = parts.slice(1, -1);

    for (let i = 0; i < norm.length; i++) {
      if (norm[i] !== first) continue;
      for (let j = Math.max(0, i - 6); j <= Math.min(norm.length - 1, i + 6); j++) {
        if (j === i || norm[j] !== last) continue;
        const lo = Math.min(i, j);
        const hi = Math.max(i, j);
        const between = norm.slice(lo, hi + 1);
        const score = 2 + middle.filter((m) => between.includes(m)).length;
        hits.push({ teacher, start: lo, score });
        break;
      }
    }
  }

  // two teachers can overlap on the same words (same first and last name): keep the better-scoring one
  hits.sort((a, b) => a.start - b.start || b.score - a.score);
  const kept: Hit[] = [];
  for (const h of hits) {
    const clash = kept.find((k) => Math.abs(k.start - h.start) <= 2);
    if (!clash) kept.push(h);
    else if (h.score > clash.score) kept[kept.indexOf(clash)] = h;
  }
  return kept.sort((a, b) => a.start - b.start);
}

interface CharHit {
  teacher: TeacherName;
  /** Index into the original page text where this name starts. */
  at: number;
  score: number;
}

/** The page text as one run of normalised letters with no spaces or punctuation, plus where each letter came from
 *  in the original text. Used when the PDF's text comes out with its spaces lost or in visual (reversed) order. */
function compact(text: string): { s: string; map: number[] } {
  let s = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const piece = normalizeArabic(text[i]).replace(/[^\p{L}\p{N}]/gu, "");
    for (const ch of piece) {
      s += ch;
      map.push(i);
    }
  }
  return { s, map };
}

function findCompactHits(text: string, teachers: TeacherName[]): CharHit[] {
  const { s, map } = compact(text);
  const runs = [
    { str: s, at: (i: number) => map[i] },
    // visual order: the whole line reversed, so reverse it back before matching
    { str: [...s].reverse().join(""), at: (i: number) => map[s.length - 1 - i] },
  ];

  let best: CharHit[] = [];
  for (const run of runs) {
    const hits: CharHit[] = [];
    for (const teacher of teachers) {
      const parts = normalizeArabic(teacher.name)
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => stripAl(w).replace(/[^\p{L}\p{N}]/gu, ""));
      if (parts.length < 2 || parts[0].length < 3 || parts[parts.length - 1].length < 3) continue;
      const first = parts[0];
      const last = parts[parts.length - 1];
      const middle = parts.slice(1, -1);

      let from = 0;
      for (;;) {
        const i = run.str.indexOf(first, from);
        if (i === -1) break;
        from = i + 1;
        const window = run.str.slice(Math.max(0, i - 3), i + first.length + 40);
        if (!window.includes(last)) continue;
        const score = 2 + middle.filter((m) => window.includes(m)).length;
        hits.push({ teacher, at: run.at(i), score });
      }
    }
    // same name read twice in a row (or two teachers on the same spot): keep the better-scoring one
    hits.sort((x, y) => x.at - y.at || y.score - x.score);
    const kept: CharHit[] = [];
    for (const h of hits) {
      const clash = kept.find((k) => Math.abs(k.at - h.at) <= 3);
      if (!clash) kept.push(h);
      else if (h.score > clash.score) kept[kept.indexOf(clash)] = h;
    }
    if (kept.length > best.length) best = kept;
  }
  return best.sort((x, y) => x.at - y.at);
}

/** One item per teacher found, per page. A page that names nobody comes back as an unmatched item so
 *  the person uploading can place it by hand instead of it silently disappearing. */
export function parseInquiryPages(pages: string[], teachers: TeacherName[]): ParsedInquiry[] {
  const out: ParsedInquiry[] = [];
  pages.forEach((pageText, index) => {
    const page = index + 1;
    const words = pageText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    const hits = findHits(words, teachers);

    if (hits.length > 0) {
      hits.forEach((hit, k) => {
        const end = k + 1 < hits.length ? hits[k + 1].start : words.length;
        const text = words.slice(hit.start, end).join(" ");
        out.push({
          teacherId: hit.teacher.id,
          teacherName: hit.teacher.name,
          page,
          pageOnly: hits.length === 1,
          text: text.slice(0, 1200),
          minutes: extractMinutes(text),
        });
      });
      return;
    }

    // no luck with whole words (spaces lost / reversed text): match on the run of letters instead
    const charHits = findCompactHits(pageText, teachers);
    if (charHits.length > 0) {
      charHits.forEach((hit, k) => {
        const end = k + 1 < charHits.length ? charHits[k + 1].at : pageText.length;
        const text = pageText.slice(hit.at, end).trim();
        out.push({
          teacherId: hit.teacher.id,
          teacherName: hit.teacher.name,
          page,
          pageOnly: charHits.length === 1,
          text: text.slice(0, 1200),
          minutes: extractMinutes(text),
        });
      });
      return;
    }

    out.push({ teacherId: null, teacherName: null, page, pageOnly: false, text: pageText.trim().slice(0, 1200), minutes: extractMinutes(pageText) });
  });
  return out;
}

/** The excuses رائد wants to hear about: a teacher who was late by more than the limit and still wrote one
 *  of these. Matched loosely on the normalised text, covering the usual spellings and phrasings. */
const EXCUSE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "أبناء", pattern: /(ابناء|ابنائي|ابني|ابنتي|بنتي|اولادي|ولدي|اطفالي|اطفال|عيالي|توصيل.{0,12}(?:ولد|بنت|ابن))/ },
  { label: "ازدحام", pattern: /(ازدحام|زحام|زحمه|زحمة)/ },
  { label: "مرض", pattern: /(مرض|مريض|مرضي|وعكه|ظرف صحي|ظروف صحيه|اعراض|مستشفي|مستوصف|عياده|صداع|حمي|زكام|تعب)/ },
  { label: "عطل", pattern: /(عطل|تعطل|عطلان|خربت|خرب|بنشر|بنشير|بطاريه)/ },
  { label: "عرقلة سير", pattern: /(عرق[لة]?[هة]? ?(?:ال)?سير|عرقله|حادث|حوادث|ازمه ?(?:سير|مروري)|اغلاق (?:ال)?طريق|سير بطيء|سير بطي)/ },
];

export function detectExcuses(justification: string): string[] {
  const t = normalizeArabic(justification);
  return EXCUSE_PATTERNS.filter((e) => e.pattern.test(t)).map((e) => e.label);
}

export interface DelayEvaluation {
  /** What the system suggests; null when the delay in minutes isn't known. */
  decision: InquiryDecision | null;
  /** A line for رائد explaining the suggestion -- never shown to the teacher. */
  note: string | null;
}

/** The rule: more than 3 minutes late is rejected, 3 or fewer is accepted. When it is rejected and the teacher
 *  also gave one of the usual excuses, the note says so ("he wrote this and I rejected it"). */
export function evaluateDelay(minutes: number | null, justification: string | null): DelayEvaluation {
  if (minutes === null) return { decision: null, note: "لم يُعرف مقدار التأخر من الملف -- بدون اقتراح" };
  if (minutes <= MAX_ACCEPTED_DELAY_MINUTES) {
    return { decision: "accepted", note: `تأخر ${minutes} دقيقة -- ضمن الحد المقبول` };
  }
  const excuses = justification ? detectExcuses(justification) : [];
  if (excuses.length > 0) {
    return {
      decision: "rejected",
      note: `تأخر ${minutes} دقيقة وكتب تبريراً من نوع (${excuses.join("، ")}) -- رُفضت المسائلة تلقائياً`,
    };
  }
  return {
    decision: "rejected",
    note: justification
      ? `تأخر ${minutes} دقيقة -- رُفضت المسائلة تلقائياً`
      : `تأخر ${minutes} دقيقة ولم يكتب تبريراً -- رُفضت المسائلة تلقائياً`,
  };
}

/** The extracted PDF text made fit to show: Arabic presentation forms folded back to plain letters, and a check for
 *  whether it came out readable. Text with stray symbols (a font whose letters don't map back) or long runs of
 *  letters with no spaces is not worth showing -- the original page is better. */
export function displayText(raw: string): { text: string; readable: boolean } {
  const text = raw.normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  // anything outside Arabic, Latin letters, digits, spaces and everyday punctuation is a sign of broken text
  const stray = /[^؀-ۿݐ-ݿA-Za-z0-9\s.,:;!?()\-–—/«»"'،؛؟%+=_‎‏]/.test(text);
  const merged = /[؀-ۿ]{26,}/.test(text);
  return { text, readable: !stray && !merged };
}
