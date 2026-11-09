/** The pure part of the مسائلات workflow (no database, no PDF reading): turning a PDF's text into one
 *  item per teacher, and the silent decision rule for the delay inquiries. Kept apart so it can be tested. */

export type InquiryKind = "delay" | "absence" | "other";
export type InquiryDecision = "accepted" | "rejected";

/** More than this many minutes late is rejected (3 or fewer is accepted). */

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
  /** The teacher's national ID (السجل المدني) -- when the PDF prints it, it is the surest way to tell who a page is about. */
  nationalId?: string | null;
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
  const find = (source: string): number | null => {
    const t = normalizeArabic(source);
    // the school's lateness form: "... عدد 3 مرة وبإجمالي دقائق 10 حسب التفصيل أدناه" -- the total is what counts
    const total = t.match(/اجمالي\s*(?:ال)?دقائق\s*[:\-]?\s*(\d{1,4})/);
    if (total) return Number(total[1]);
    const direct = t.match(/(\d{1,3})\s*(?:دقيقه|دقايق|دقائق|دقيقة|د\b)/);
    if (direct) return Number(direct[1]);
    const labelled = t.match(/(?:تاخر|تاخير)\w*\s*[:\-]?\s*(\d{1,3})\b/);
    if (labelled) return Number(labelled[1]);
    // last resort: the form's table lists each late day with its duration as hours:minutes (00:10) -- add them up
    const durations = [...t.matchAll(/(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])/g)];
    return durations.length > 0 ? durations.reduce((sum, m) => sum + Number(m[1]) * 60 + Number(m[2]), 0) : null;
  };
  // as written first; a form exported in visual order has its words and letters reversed, so read it back if that fails
  const minutes = find(text) ?? (isVisualOrder(text) ? find(fixVisualArabic(text)) : null);
  // zero minutes means the lateness line was left empty (the form was filled for leaving early / being away), not "on time"
  return minutes === 0 ? null : minutes;
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
    // a name is matched by its first and last words, which must be actual words (not numbers)
    if (parts.length < 2 || /^\d+$/.test(parts[0]) || /^\d+$/.test(parts[parts.length - 1])) continue;
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
      if (/^\d+$/.test(parts[0]) || /^\d+$/.test(parts[parts.length - 1])) continue;
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

/** Keeps only the first hit of each teacher: a page can name the same person several times (in the header, in
 *  the greeting, in the body), and that is still one inquiry. */
function firstHitPerTeacher<T extends { teacher: TeacherName }>(hits: T[]): T[] {
  const seen = new Set<string>();
  return hits.filter((h) => (seen.has(h.teacher.id) ? false : (seen.add(h.teacher.id), true)));
}

interface IdHit {
  teacher: TeacherName;
  /** Index into the original page text where the ID starts. */
  at: number;
}

/** 10-digit national IDs printed on the page that belong to a known teacher. Reports exported from the school's
 *  systems print the person's ID (السجل المدني) on every page, and digits survive every PDF text quirk that
 *  mangles Arabic letters, so this is checked before any name matching. An ID that came out reversed counts too. */
function findIdHits(pageText: string, teachers: TeacherName[]): IdHit[] {
  const byId = new Map<string, TeacherName>();
  for (const t of teachers) {
    const id = (t.nationalId ?? "").replace(/\D/g, "");
    if (id.length === 10) byId.set(id, t);
  }
  if (byId.size === 0) return [];

  // the page as normalised characters (digits made ASCII), remembering where each one came from in the original
  let scan = "";
  const origin: number[] = [];
  for (let i = 0; i < pageText.length; i++) {
    for (const ch of normalizeArabic(pageText[i])) {
      scan += ch;
      origin.push(i);
    }
  }

  const hits: IdHit[] = [];
  for (const m of scan.matchAll(/(?<!\d)\d{10}(?!\d)/g)) {
    const digits = m[0];
    const teacher = byId.get(digits) ?? byId.get([...digits].reverse().join(""));
    if (teacher) hits.push({ teacher, at: origin[m.index ?? 0] ?? 0 });
  }
  return firstHitPerTeacher(hits);
}

/** Whether the page prints a Saudi national / resident ID (10 digits starting with 1 or 2). */
function printsOtherNationalId(pageText: string): boolean {
  const scan = [...pageText].map((ch) => normalizeArabic(ch)).join("");
  return [...scan.matchAll(/(?<!\d)\d{10}(?!\d)/g)].some((m) => /^[12]/.test(m[0]));
}

/** One item per teacher found, per page. A page that names nobody comes back as an unmatched item so
 *  the person uploading can place it by hand instead of it silently disappearing. */
export function parseInquiryPages(pages: string[], teachers: TeacherName[]): ParsedInquiry[] {
  const out: ParsedInquiry[] = [];
  pages.forEach((pageText, index) => {
    const page = index + 1;
    const words = pageText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    const idHits = findIdHits(pageText, teachers);
    if (idHits.length > 0) {
      idHits.forEach((hit, k) => {
        const end = k + 1 < idHits.length ? idHits[k + 1].at : pageText.length;
        // a page about one person is passed on whole; a page listing several is cut at each ID
        const text = idHits.length === 1 ? pageText.trim() : pageText.slice(hit.at, end).trim();
        out.push({
          teacherId: hit.teacher.id,
          teacherName: hit.teacher.name,
          page,
          pageOnly: idHits.length === 1,
          text: text.slice(0, 1500),
          minutes: extractMinutes(text),
        });
      });
      return;
    }

    // The page prints a national ID that is nobody's on the list (رائد's own, a guest...): don't guess a teacher by name
    if (printsOtherNationalId(pageText)) {
      out.push({ teacherId: null, teacherName: null, page, pageOnly: false, text: pageText.trim().slice(0, 1500), minutes: extractMinutes(pageText) });
      return;
    }

    const hits = firstHitPerTeacher(findHits(words, teachers));

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
    const charHits = firstHitPerTeacher(findCompactHits(pageText, teachers));
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

/** The extracted PDF text made fit to show: Arabic presentation forms folded back to plain letters, and a check for
 *  whether it came out readable. Text with stray symbols (a font whose letters don't map back) or long runs of
 *  letters with no spaces is not worth showing -- the original page is better. */
export function displayText(raw: string): { text: string; readable: boolean } {
  // text that came out in visual order is put back in reading order first -- but only when that really reads better
  const mostlyShaped = isVisualOrder(raw);
  const chosen = mostlyShaped && readingScore(fixVisualArabic(raw)) > readingScore(raw) ? fixVisualArabic(raw) : raw;
  const text = chosen.normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  // anything outside Arabic, Latin letters, digits, spaces and everyday punctuation is a sign of broken text
  const stray = /[^؀-ۿݐ-ݿA-Za-z0-9\s.,:;!?()\-–—/«»"'،؛؟%+=_‎‏☐☑☒✓✗•●■□]/.test(text);
  // a form exported in visual order always has a few run-together words (labels and values), which is normal there
  const merged = !mostlyShaped && /[؀-ۿ]{26,}/.test(text);
  return { text, readable: !stray && !merged };
}

const SHAPED = /[\uFB50-\uFDFF\uFE70-\uFEFF]/;
const isShaped = (ch: string) => SHAPED.test(ch);

/** Words that appear on these school forms and in everyday Arabic. A text in the right reading order contains many of
 *  them; the same text reversed contains almost none -- which is how the two are told apart. */
const COMMON_WORDS = new Set(
  [
    "\u0645\u0646", "\u0641\u064A", "\u0639\u0644\u0649", "\u0625\u0644\u0649", "\u0639\u0646", "\u0623\u0646", "\u0625\u0646", "\u0647\u0630\u0627", "\u0630\u0644\u0643", "\u0627\u0644\u0644\u0647", "\u0627\u0644\u0633\u0644\u0627\u0645", "\u0639\u0644\u064A\u0643\u0645", "\u0648\u0631\u062D\u0645\u0629", "\u0648\u0628\u0631\u0643\u0627\u062A\u0647", "\u0648\u0628\u0639\u062F",
    "\u0627\u0644\u0645\u0643\u0631\u0645", "\u0645\u062F\u064A\u0631", "\u0645\u062F\u0631\u0633\u0629", "\u0648\u0632\u0627\u0631\u0629", "\u0627\u0644\u062A\u0639\u0644\u064A\u0645", "\u0627\u0644\u0645\u0645\u0644\u0643\u0629", "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", "\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629", "\u0627\u0644\u0625\u062F\u0627\u0631\u0629", "\u0627\u0644\u0639\u0627\u0645\u0629", "\u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629",
    "\u0627\u0644\u0631\u0642\u0645", "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", "\u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062A", "\u0627\u0644\u0633\u062C\u0644", "\u0627\u0644\u0645\u062F\u0646\u064A", "\u0627\u0644\u0627\u0633\u0645", "\u0627\u0644\u0648\u0638\u064A\u0641\u0629", "\u0627\u0644\u0645\u0639\u0644\u0645", "\u0645\u0639\u0644\u0645", "\u062A\u0623\u062E\u0631", "\u0627\u0644\u062A\u0623\u062E\u0631", "\u063A\u064A\u0627\u0628",
    "\u0627\u0644\u063A\u064A\u0627\u0628", "\u0645\u0633\u0627\u0621\u0644\u0629", "\u0627\u0644\u0625\u0641\u0627\u062F\u0629", "\u0627\u0644\u062A\u0648\u0642\u064A\u0639", "\u0627\u0644\u0645\u0628\u0627\u0634\u0631", "\u0637\u0644\u0628", "\u0627\u0644\u0641\u062A\u0631\u0629", "\u0623\u0633\u0628\u0627\u0628", "\u0639\u0630\u0631\u0643\u0645", "\u062E\u0644\u0627\u0644", "\u0623\u0633\u0628\u0648\u0639", "\u062F\u0642\u064A\u0642\u0629",
    "\u062F\u0642\u0627\u0626\u0642", "\u0631\u0642\u0645", "\u0627\u0644\u062C\u0648\u0627\u0644", "\u0627\u0644\u0645\u0633\u0645\u0649", "\u0627\u0644\u0648\u0638\u064A\u0641\u064A", "\u0627\u0644\u0645\u0643\u0631\u0645\u0629", "\u0645\u0643\u0629", "\u0648\u0641\u0642\u0647", "\u0627\u0644\u0631\u0628\u0627\u0639\u064A", "\u0627\u0644\u0623\u064A\u0627\u0645", "\u0623\u064A\u0627\u0645", "\u0639\u062F\u062F", "\u0645\u062F\u0629",
  ].map((w) => normalizeArabic(w))
);

/** How many words of the text are common Arabic words -- higher means closer to the right reading order. */
function readingScore(text: string): number {
  return text
    .normalize("NFKC")
    .split(/[\s:/.,()\-]+/)
    .filter((w) => COMMON_WORDS.has(normalizeArabic(w))).length;
}

/** True when most of the Arabic letters in the text are presentation-form glyphs -- the sign of a PDF export in
 *  visual order. */
export function isVisualOrder(text: string): boolean {
  const letters = [...text].filter((c) => /[؀-ۿﭐ-﷿ﹰ-﻿]/.test(c));
  return letters.length > 0 && letters.filter(isShaped).length / letters.length >= 0.5;
}

/** Some PDFs (the school's report exports) hand back Arabic in visual order: words in reverse order and the
 *  letters of connected words reversed, as presentation-form glyphs. Reading it back means undoing that per
 *  word -- reverse the run of glyphs, keep plain letters and digits as they are -- and then reversing the words. */
export function fixVisualArabic(raw: string): string {
  // three kinds of character: presentation-form glyphs (reversed in the export), plain Arabic letters (an alef or a
  // ta can come out in its base form right next to the glyphs), and everything else (digits, punctuation, symbols)
  const kindOf = (ch: string) => (isShaped(ch) ? "shaped" : /[؀-ۿ]/.test(ch) ? "base" : "other");
  const fixToken = (token: string): string => {
    const runs: { kind: string; text: string }[] = [];
    for (const ch of token) {
      const kind = kindOf(ch);
      const last = runs[runs.length - 1];
      if (last && last.kind === kind) last.text += ch;
      else runs.push({ kind, text: ch });
    }
    return runs
      .reverse()
      // a glyph can expand to more than one letter (لا, الله): reverse the glyphs, not the letters they expand to
      .map((r) => (r.kind === "shaped" ? [...r.text].map((g) => g.normalize("NFKC")).reverse().join("") : r.text))
      .join("");
  };
  return raw
    .split("\n")
    .map((line) => line.split(/\s+/).filter(Boolean).reverse().map(fixToken).join(" "))
    .join("\n");
}

export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = {
  delay: "مسائلة تأخير",
  absence: "مسائلة غياب",
  other: "مسائلة",
};

/** The form gives the teacher a week to answer. */
export const INQUIRY_DEADLINE_DAYS = 7;

/** Whole days left to answer (negative once the week is over), counted from when the inquiry was sent. */
export function inquiryDaysLeft(createdAtIso: string, now: number = Date.now()): number {
  const due = new Date(createdAtIso).getTime() + INQUIRY_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
  return Math.ceil((due - now) / (24 * 60 * 60 * 1000));
}

/** The period the form covers ("خلال الفترة من 02-11-2026 إلى 02-11-2026"), if the text has it. */
export function extractPeriod(text: string): { from: string; to: string } | null {
  const m = text.match(/الفترة\s*من\s*(\d{2}-\d{2}-\d{4})\s*إلى\s*(\d{2}-\d{2}-\d{4})/);
  return m ? { from: m[1], to: m[2] } : null;
}
