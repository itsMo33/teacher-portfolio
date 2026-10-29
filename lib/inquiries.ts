import "server-only";
import { randomUUID } from "crypto";
import { getDocumentProxy, extractText } from "unpdf";
import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { evaluateDelay, parseInquiryPages, type InquiryDecision, type InquiryKind, type ParsedInquiry } from "@/lib/inquiry-logic";

export const INQUIRY_OFFICER_CATEGORY = "inquiries_officer";

export type InquiryRole = "officer" | "reviewer" | "teacher";

/** Who plays which part: the account that uploads the PDFs (a restricted account), the reviewers (رائد and the
 *  manager -- admin-level accounts with no category scope), and the teachers who receive them. */
export function getInquiryRole(user: { role: string; restrictedCategory?: string | null; demoViewOnly?: boolean }): InquiryRole | null {
  if (user.role === "agent" && user.restrictedCategory === INQUIRY_OFFICER_CATEGORY) return "officer";
  if ((user.role === "agent" || user.role === "manager") && !user.restrictedCategory) return "reviewer";
  if (user.role === "teacher") return "teacher";
  return null;
}

export interface Inquiry {
  id: string;
  kind: InquiryKind;
  teacherId: string;
  teacherName: string;
  createdAt: string;
  delayMinutes: number | null;
  extractedText: string;
  hasTeacherFile: boolean;
  teacherOpenedAt: string | null;
  justification: string | null;
  justifiedAt: string | null;
  systemDecision: InquiryDecision | null;
  systemNote: string | null;
  decision: InquiryDecision | null;
  decisionNote: string | null;
  decidedAt: string | null;
}

const SELECT =
  "id, kind, teacher_id, created_at, delay_minutes, extracted_text, teacher_file_path, teacher_opened_at, justification, justified_at, system_decision, system_note, decision, decision_note, decided_at, teacher:users!inquiries_teacher_id_fkey(name)";

interface Row {
  id: string;
  kind: InquiryKind;
  teacher_id: string;
  created_at: string;
  delay_minutes: number | null;
  extracted_text: string;
  teacher_file_path: string | null;
  teacher_opened_at: string | null;
  justification: string | null;
  justified_at: string | null;
  system_decision: InquiryDecision | null;
  system_note: string | null;
  decision: InquiryDecision | null;
  decision_note: string | null;
  decided_at: string | null;
  teacher: { name: string } | { name: string }[] | null;
}

function toInquiry(r: Row): Inquiry {
  return {
    id: r.id,
    kind: r.kind,
    teacherId: r.teacher_id,
    teacherName: (Array.isArray(r.teacher) ? r.teacher[0]?.name : r.teacher?.name) ?? "",
    createdAt: r.created_at,
    delayMinutes: r.delay_minutes,
    extractedText: r.extracted_text,
    hasTeacherFile: !!r.teacher_file_path,
    teacherOpenedAt: r.teacher_opened_at,
    justification: r.justification,
    justifiedAt: r.justified_at,
    systemDecision: r.system_decision,
    systemNote: r.system_note,
    decision: r.decision,
    decisionNote: r.decision_note,
    decidedAt: r.decided_at,
  };
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const { data } = await supabaseAdmin.from("inquiries").select(SELECT).eq("id", id).maybeSingle();
  return data ? toInquiry(data as unknown as Row) : null;
}

/** Everything for the reviewers (newest first); only that teacher's own for a teacher. */
export async function listInquiries(opts: { teacherId?: string } = {}): Promise<Inquiry[]> {
  let query = supabaseAdmin.from("inquiries").select(SELECT).order("created_at", { ascending: false }).limit(2000);
  if (opts.teacherId) query = query.eq("teacher_id", opts.teacherId);
  const { data } = await query;
  return (data ?? []).map((r) => toInquiry(r as unknown as Row));
}

/** What a teacher is allowed to see of their own inquiry: the decision only once رائد has confirmed it, and
 *  never the system's suggestion or note. */
export interface TeacherInquiryView {
  id: string;
  kind: InquiryKind;
  createdAt: string;
  delayMinutes: number | null;
  extractedText: string;
  hasTeacherFile: boolean;
  justification: string | null;
  justifiedAt: string | null;
  decision: InquiryDecision | null;
  decisionNote: string | null;
}

export function toTeacherView(i: Inquiry): TeacherInquiryView {
  const decided = i.decidedAt !== null;
  return {
    id: i.id,
    kind: i.kind,
    createdAt: i.createdAt,
    delayMinutes: i.delayMinutes,
    extractedText: i.extractedText,
    hasTeacherFile: i.hasTeacherFile,
    justification: i.justification,
    justifiedAt: i.justifiedAt,
    decision: decided ? i.decision : null,
    decisionNote: decided ? i.decisionNote : null,
  };
}

/** A short-lived link to the page cut out for this teacher alone (never the whole PDF, which names everyone). */
export async function getTeacherFileUrl(inquiryId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("inquiries").select("teacher_file_path").eq("id", inquiryId).maybeSingle();
  return data?.teacher_file_path ? getSignedUrl(PORTFOLIO_BUCKET, data.teacher_file_path as string, 600) : null;
}

export async function getSourceUrl(inquiryId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("inquiries").select("source_path").eq("id", inquiryId).maybeSingle();
  return data?.source_path ? getSignedUrl(PORTFOLIO_BUCKET, data.source_path as string, 600) : null;
}

export async function readPdfPages(path: string): Promise<{ pages: string[]; bytes: Uint8Array }> {
  const { data, error } = await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).download(path);
  if (error || !data) throw new Error("تعذّر قراءة الملف المرفوع");
  const bytes = new Uint8Array(await data.arrayBuffer());
  // unpdf takes ownership of the buffer, so hand it a copy and keep ours for cutting pages out later
  const pdf = await getDocumentProxy(bytes.slice());
  const { text } = await extractText(pdf, { mergePages: false });
  return { pages: text, bytes };
}

export async function parseUploadedPdf(
  path: string
): Promise<{ items: ParsedInquiry[]; teachers: { id: string; name: string }[]; pageCount: number }> {
  const [{ pages }, { data: teachers }] = await Promise.all([
    readPdfPages(path),
    supabaseAdmin.from("users").select("id, name").eq("role", "teacher").is("deleted_at", null).order("name"),
  ]);
  const list = (teachers ?? []) as { id: string; name: string }[];
  return { items: parseInquiryPages(pages, list), teachers: list, pageCount: pages.length };
}

export interface SendItem {
  teacherId: string;
  page: number;
  pageOnly: boolean;
  text: string;
  minutes: number | null;
}

/** Creates the inquiries from what the uploader confirmed: one row per teacher, with their own page cut out
 *  when the page is theirs alone. For delay inquiries the system's suggestion is worked out here. */
export async function createInquiries(opts: { kind: InquiryKind; sourcePath: string; uploadedBy: string; items: SendItem[] }) {
  const { bytes } = await readPdfPages(opts.sourcePath);
  const source = await PDFDocument.load(bytes);
  const batchId = randomUUID();
  let created = 0;

  for (const item of opts.items) {
    const id = randomUUID();
    let teacherFilePath: string | null = null;
    if (item.pageOnly && item.page >= 1 && item.page <= source.getPageCount()) {
      const single = await PDFDocument.create();
      const [copied] = await single.copyPages(source, [item.page - 1]);
      single.addPage(copied);
      const path = `inquiries/${batchId}/${id}.pdf`;
      const { error } = await supabaseAdmin.storage
        .from(PORTFOLIO_BUCKET)
        .upload(path, Buffer.from(await single.save()), { contentType: "application/pdf", upsert: false });
      if (!error) teacherFilePath = path;
    }

    const evaluation = opts.kind === "delay" ? evaluateDelay(item.minutes, null) : { decision: null, note: null };
    const { error } = await supabaseAdmin.from("inquiries").insert({
      id,
      kind: opts.kind,
      teacher_id: item.teacherId,
      batch_id: batchId,
      source_path: opts.sourcePath,
      source_page: item.page,
      teacher_file_path: teacherFilePath,
      extracted_text: item.text,
      delay_minutes: opts.kind === "delay" ? item.minutes : null,
      uploaded_by: opts.uploadedBy,
      system_decision: evaluation.decision,
      system_note: evaluation.note,
    });
    if (!error) created++;
  }
  return { created, batchId };
}

/** Re-runs the delay rule once the teacher's justification is in, so رائد sees the excuse noted. */
export async function applyJustification(inquiry: Inquiry, justification: string) {
  const evaluation = inquiry.kind === "delay" ? evaluateDelay(inquiry.delayMinutes, justification) : { decision: null, note: null };
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("inquiries")
    .update({
      justification,
      justified_at: now,
      ...(inquiry.kind === "delay" ? { system_decision: evaluation.decision, system_note: evaluation.note } : {}),
    })
    .eq("id", inquiry.id)
    .is("decided_at", null);
  return error;
}
