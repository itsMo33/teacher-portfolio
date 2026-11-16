import "server-only";
import fs from "fs";
import path from "path";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import sharp from "sharp";
import fontkit from "@pdf-lib/fontkit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import type { Inquiry } from "@/lib/inquiries";
import { displayText } from "@/lib/inquiry-logic";
import { listInquiryFiles } from "@/lib/inquiry-files";

/** Fills the school's own مساءلة form with what the system holds -- the teacher's answer, the decision and the
 *  director's signature -- by writing onto the very page that was cut out of the school's PDF, so the printed form
 *  keeps its original look. Only the two known templates (delay, absence) can be filled this way. */

const FONT_PATH = path.join(process.cwd(), "lib", "fonts", "NotoSansArabic-Regular.ttf");
const SIGNATURE_PATH = "signatures/director.png";
const STAMP_PATH = "signatures/director_stamp.png";
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

async function loadImage(path: string): Promise<Buffer | null> {
  const { data } = await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).download(path);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}

interface Template {
  justificationBaselines: readonly number[];
  justificationRight: number;
  justificationWidth: number;
  answerLine: { baseline: number; nameRight: number; signCenter: number; dateRight: number };
  directorLines: readonly [{ baseline: number; signCenter: number; dateRight: number }, { baseline: number; signCenter: number; dateRight: number }];
  ticks: { accepted: { x: number; y: number }; rejected: { x: number; y: number } };
}

/** The same template with everything moved up or down (the school's forms differ by a few points in height). */
function shifted(t: Template, dy: number): Template {
  return {
    ...t,
    justificationBaselines: t.justificationBaselines.map((y) => y + dy),
    answerLine: { ...t.answerLine, baseline: t.answerLine.baseline + dy },
    directorLines: [
      { ...t.directorLines[0], baseline: t.directorLines[0].baseline + dy },
      { ...t.directorLines[1], baseline: t.directorLines[1].baseline + dy },
    ],
    ticks: { accepted: { ...t.ticks.accepted, y: t.ticks.accepted.y + dy }, rejected: { ...t.ticks.rejected, y: t.ticks.rejected.y + dy } },
  };
}

/** Where each thing goes on each template (PDF points; y measured from the page's top). */
const DELAY: Template = {
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
};

const TEMPLATES: Record<FormTemplateName, Template> = {
  delay: DELAY,
  // مساءلة حضور غير مكتمل: the same form as the delay one, six points higher
  incomplete: shifted(DELAY, -6),
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
};

export type FormTemplateName = "delay" | "incomplete" | "absence";

/** Which of the school's forms this inquiry is, read from the title printed on its page (an inquiry uploaded under
 *  "المسائلات الأخرى" can be any of them); null for anything else (an older file upload, an unknown form). */
export function formTemplateOf(inquiry: Pick<Inquiry, "kind" | "extractedText">): FormTemplateName | null {
  const text = displayText(inquiry.extractedText).text;
  if (/حضور\s*غير\s*مكتمل/.test(text)) return "incomplete";
  if (/مساءلة\s*عن\s*تأخر|مساءلة\s*تأخر/.test(text) || (inquiry.kind === "delay" && !/مساءلة\s*غياب/.test(text))) return "delay";
  if (/مساءلة\s*غياب/.test(text) || inquiry.kind === "absence") return "absence";
  return null;
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
  const name = formTemplateOf(inquiry);
  if (!name) return null;
  const tpl = TEMPLATES[name];
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

  // the director's stamp and signature: on the line that issued the inquiry, and -- once it is decided -- on the decision line
  const [signature, stampBytes] = await Promise.all([loadImage(SIGNATURE_PATH), loadImage(STAMP_PATH)]);
  if (signature) {
    const image = await doc.embedPng(signature);
    const stamp = stampBytes ? await doc.embedPng(stampBytes) : null;
    const H = page.getHeight();
    const lines = [{ at: tpl.directorLines[0], date: inquiry.createdAt }, ...(decided ? [{ at: tpl.directorLines[1], date: inquiry.decidedAt! }] : [])];
    for (const l of lines) {
      // the stamp sits under the signature, a little to the left, as on the paper original
      if (stamp) {
        const sw = 58;
        const sh = (stamp.height / stamp.width) * sw;
        page.drawImage(stamp, { x: l.at.signCenter - 14 - sw / 2, y: H - l.at.baseline - sh * 0.35, width: sw, height: sh, opacity: 0.85 });
      }
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

  await appendAttachments(doc, inquiry.id);

  return doc.save();
}

/** The files the recipient attached follow the form: images and PDFs are put in as pages, anything else (Word) is only
 *  listed on a last page because it cannot be merged into a PDF. A file that cannot be read is skipped, never fatal. */
async function appendAttachments(doc: PDFDocument, inquiryId: string): Promise<void> {
  let files: Awaited<ReturnType<typeof listInquiryFiles>> = [];
  try {
    files = await listInquiryFiles(inquiryId);
  } catch {
    return;
  }
  const notMerged: string[] = [];
  for (const f of files) {
    try {
      const { data } = await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).download(f.filePath);
      if (!data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());
      const name = f.fileName.toLowerCase();
      if (f.mimeType === "application/pdf" || name.endsWith(".pdf")) {
        const src = await PDFDocument.load(bytes);
        const pages = await doc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => doc.addPage(p));
      } else if (f.mimeType.startsWith("image/") || /\.(png|jpe?g)$/.test(name)) {
        const image = /\.png$/.test(name) || f.mimeType === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const page = doc.addPage([595, 842]);
        await drawLine(doc, page, `مرفق: ${f.fileName}`, { right: 560, baseline: 50, size: 11 });
        const scale = Math.min(515 / image.width, 740 / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, { x: (595 - w) / 2, y: 842 - 70 - h, width: w, height: h });
      } else {
        notMerged.push(f.fileName);
      }
    } catch {
      notMerged.push(f.fileName);
    }
  }
  if (notMerged.length > 0) {
    const page = doc.addPage([595, 842]);
    await drawLine(doc, page, "مرفقات أخرى لم تُدمج في هذا الملف (موجودة في حساب المسائلة):", { right: 560, baseline: 60, size: 12 });
    for (let i = 0; i < notMerged.length; i++) await drawLine(doc, page, notMerged[i], { right: 540, baseline: 95 + i * 20, size: 11 });
  }
}
