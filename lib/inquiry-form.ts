import "server-only";
import fs from "fs";
import path from "path";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import sharp from "sharp";
import fontkit from "@pdf-lib/fontkit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import type { Inquiry } from "@/lib/inquiries";

/** Fills the school's own مساءلة form with what the system holds -- the teacher's answer, the decision and the
 *  director's signature -- by writing onto the very page that was cut out of the school's PDF, so the printed form
 *  keeps its original look. Only the two known templates (delay, absence) can be filled this way. */

const FONT_PATH = path.join(process.cwd(), "lib", "fonts", "NotoSansArabic-Regular.ttf");
const SIGNATURE_PATH = "signatures/director.png";
const INK = "#0b1f6b";
const SCALE = 4; // text is drawn as images at 4x so it stays sharp when printed

interface FontMetrics {
  ascent: number;
  descent: number;
  measure: (text: string, size: number) => number;
}

let fontMetrics: FontMetrics | null = null;
function getFont(): FontMetrics {
  if (fontMetrics) return fontMetrics;
  const font = fontkit.create(fs.readFileSync(FONT_PATH)) as unknown as {
    unitsPerEm: number;
    ascent: number;
    descent: number;
    layout: (text: string) => { advanceWidth: number };
  };
  fontMetrics = {
    ascent: font.ascent / font.unitsPerEm,
    descent: -font.descent / font.unitsPerEm,
    measure: (text, size) => (font.layout(text).advanceWidth / font.unitsPerEm) * size,
  };
  return fontMetrics;
}

function escapeMarkup(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Placed {
  /** Right edge, left edge or centre of the text (one of them), in PDF points from the page's left. */
  right?: number;
  left?: number;
  center?: number;
  /** The text's baseline, in points from the page's TOP (the same way the page's text positions are measured). */
  baseline: number;
  size: number;
}

/** Writes one line of Arabic/Latin text onto the page. The text is shaped and ordered by Pango (through sharp), which
 *  PDF libraries cannot do for Arabic, and placed as a transparent image. */
async function drawLine(doc: PDFDocument, page: PDFPage, text: string, at: Placed) {
  if (!text.trim()) return;
  const font = getFont();
  const png = await sharp({
    text: {
      text: `<span foreground="${INK}">${escapeMarkup(text)}</span>`,
      font: `Noto Sans Arabic ${at.size}`,
      fontfile: FONT_PATH,
      dpi: 72 * SCALE,
      rgba: true,
    },
  })
    .png()
    .toBuffer();
  const meta = await sharp(png).metadata();
  const w = (meta.width ?? 0) / SCALE;
  const h = (meta.height ?? 0) / SCALE;
  const image = await doc.embedPng(png);
  const x = at.right !== undefined ? at.right - w : at.left !== undefined ? at.left : (at.center ?? 0) - w / 2;
  // the picture's top sits one ascent above the baseline
  const top = at.baseline - font.ascent * at.size;
  page.drawImage(image, { x, y: page.getHeight() - top - h, width: w, height: h });
}

/** Breaks text into lines no wider than `width` points at the given size (words are measured as shaped). */
function wrap(text: string, size: number, width: number): string[] {
  const font = getFont();
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.measure(next, size) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function riyadhDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

function drawCheck(page: PDFPage, cx: number, cy: number) {
  const H = page.getHeight();
  const color = rgb(0.04, 0.12, 0.42);
  page.drawLine({ start: { x: cx - 3.6, y: H - cy - 0.3 }, end: { x: cx - 1, y: H - cy + 3 }, thickness: 1.5, color });
  page.drawLine({ start: { x: cx - 1, y: H - cy + 3 }, end: { x: cx + 4, y: H - cy - 4 }, thickness: 1.5, color });
}

async function loadSignature(): Promise<Buffer | null> {
  const { data } = await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).download(SIGNATURE_PATH);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}

/** Where each thing goes on each template (PDF points; y measured from the page's top). */
const TEMPLATES = {
  delay: {
    justificationBaselines: [575, 590, 605],
    justificationRight: 561,
    justificationWidth: 520,
    // "الاسم / التوقيع / التاريخ" line under the teacher's answer
    answerLine: { baseline: 626, nameRight: 536, signCenter: 302, dateRight: 165 },
    // the director's lines: [the one that issued the inquiry, the one that decides it]
    directorLines: [
      { baseline: 507, signCenter: 312, dateRight: 165 },
      { baseline: 727, signCenter: 312, dateRight: 165 },
    ],
    ticks: { accepted: { x: 553.3, y: 673 }, rejected: { x: 553.3, y: 693.5 } },
  },
  absence: {
    justificationBaselines: [470, 488, 506],
    justificationRight: 550,
    justificationWidth: 500,
    answerLine: { baseline: 555, nameRight: 524, signCenter: 298, dateRight: 166 },
    directorLines: [
      { baseline: 354, signCenter: 258, dateRight: 146 },
      { baseline: 686, signCenter: 258, dateRight: 142 },
    ],
    // accepted = "تحتسب من رصيده", rejected = "يعتمد الحسم"
    ticks: { accepted: { x: 542, y: 629.5 }, rejected: { x: 542, y: 650.5 } },
  },
} as const;

export function hasFormTemplate(kind: Inquiry["kind"]): boolean {
  return kind === "delay" || kind === "absence";
}

/** The original page for this inquiry: the teacher's own cut page, or the right page of the uploaded PDF. */
async function loadOriginalPage(inquiryId: string): Promise<PDFDocument | null> {
  const { data: row } = await supabaseAdmin.from("inquiries").select("teacher_file_path, source_path, source_page").eq("id", inquiryId).maybeSingle();
  if (!row) return null;
  const filePath = (row.teacher_file_path as string | null) ?? (row.source_path as string | null);
  if (!filePath) return null;
  const { data } = await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).download(filePath);
  if (!data) return null;
  const src = await PDFDocument.load(new Uint8Array(await data.arrayBuffer()));
  if (row.teacher_file_path) return src;
  const single = await PDFDocument.create();
  const [copied] = await single.copyPages(src, [Math.max(0, (Number(row.source_page) || 1) - 1)]);
  single.addPage(copied);
  return single;
}

export async function buildCompletedForm(inquiry: Inquiry): Promise<Uint8Array | null> {
  if (!hasFormTemplate(inquiry.kind)) return null;
  const tpl = TEMPLATES[inquiry.kind as "delay" | "absence"];
  const doc = await loadOriginalPage(inquiry.id);
  if (!doc) return null;
  const page = doc.getPage(0);

  // the teacher's answer, on the dotted lines
  let continuation: string | null = null;
  if (inquiry.justification) {
    let size = 9.5;
    let lines = wrap(inquiry.justification, size, tpl.justificationWidth);
    while (lines.length > tpl.justificationBaselines.length && size > 7) {
      size -= 0.5;
      lines = wrap(inquiry.justification, size, tpl.justificationWidth);
    }
    if (lines.length > tpl.justificationBaselines.length) {
      continuation = inquiry.justification;
      lines = lines.slice(0, tpl.justificationBaselines.length);
      lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, lines[lines.length - 1].length - 30))} ... (تتمة الإفادة في الصفحة التالية)`;
    }
    for (let i = 0; i < lines.length; i++) {
      await drawLine(doc, page, lines[i], { right: tpl.justificationRight, baseline: tpl.justificationBaselines[i] - 2, size });
    }
    // the teacher's electronic acknowledgement on the name / signature / date line
    const a = tpl.answerLine;
    await drawLine(doc, page, inquiry.teacherName.trim(), { right: a.nameRight, baseline: a.baseline - 1.5, size: 8 });
    await drawLine(doc, page, "إقرار إلكتروني", { center: a.signCenter, baseline: a.baseline - 1.5, size: 6.5 });
    if (inquiry.justifiedAt) await drawLine(doc, page, riyadhDate(inquiry.justifiedAt), { right: a.dateRight, baseline: a.baseline - 1.5, size: 8 });
  }

  // the decision
  const decided = inquiry.decision !== null && inquiry.decidedAt !== null;
  if (decided) {
    const t = tpl.ticks[inquiry.decision!];
    drawCheck(page, t.x, t.y);
  }

  // the director's signature: on the line that issued the inquiry, and -- once it is decided -- on the decision line
  const signature = await loadSignature();
  if (signature) {
    const image = await doc.embedPng(signature);
    const H = page.getHeight();
    const lines = [{ at: tpl.directorLines[0], date: inquiry.createdAt }, ...(decided ? [{ at: tpl.directorLines[1], date: inquiry.decidedAt! }] : [])];
    for (const l of lines) {
      const w = 46;
      const h = (image.height / image.width) * w;
      page.drawImage(image, { x: l.at.signCenter - w / 2, y: H - l.at.baseline - h * 0.2, width: w, height: h });
      await drawLine(doc, page, riyadhDate(l.date), { right: l.at.dateRight, baseline: l.at.baseline - 1.5, size: 8 });
    }
  }

  // a long answer continues on a page of its own
  if (continuation) {
    const extra = doc.addPage([595, 842]);
    await drawLine(doc, extra, `تتمة إفادة المعلم: ${inquiry.teacherName.trim()}`, { right: 550, baseline: 60, size: 13 });
    const lines = wrap(continuation, 11, 500).slice(0, 45);
    for (let i = 0; i < lines.length; i++) await drawLine(doc, extra, lines[i], { right: 550, baseline: 95 + i * 17, size: 11 });
  }

  return doc.save();
}
