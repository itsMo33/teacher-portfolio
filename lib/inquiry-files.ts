import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

/** Supporting files a recipient attaches to their answer (a medical report, a leave slip...). */

export const MAX_INQUIRY_FILES = 5;

export interface InquiryFile {
  id: string;
  inquiryId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
}

interface Row {
  id: string;
  inquiry_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
}

const SELECT = "id, inquiry_id, file_path, file_name, mime_type, uploaded_at";

function toFile(r: Row): InquiryFile {
  return { id: r.id, inquiryId: r.inquiry_id, filePath: r.file_path, fileName: r.file_name, mimeType: r.mime_type, uploadedAt: r.uploaded_at };
}

export function buildInquiryFilePath(inquiryId: string, fileName: string): string {
  const ext = (fileName.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? "").toLowerCase();
  return `inquiries/files/${inquiryId}/${randomUUID()}${ext}`;
}

export async function listInquiryFiles(inquiryId: string): Promise<InquiryFile[]> {
  const { data } = await supabaseAdmin.from("inquiry_files").select(SELECT).eq("inquiry_id", inquiryId).order("uploaded_at");
  return (data ?? []).map((r) => toFile(r as Row));
}

export async function listInquiryFilesWithUrls(inquiryId: string): Promise<(InquiryFile & { url: string })[]> {
  const files = await listInquiryFiles(inquiryId);
  return Promise.all(files.map(async (f) => ({ ...f, url: await getSignedUrl(PORTFOLIO_BUCKET, f.filePath) })));
}

/** How many files each inquiry has (an inquiry with none is left out). Zero everywhere when the table is not there yet. */
export async function countInquiryFiles(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin.from("inquiry_files").select("inquiry_id");
  const counts = new Map<string, number>();
  if (error) return counts;
  for (const r of data ?? []) counts.set(r.inquiry_id as string, (counts.get(r.inquiry_id as string) ?? 0) + 1);
  return counts;
}

export async function addInquiryFile(params: { inquiryId: string; filePath: string; fileName: string; mimeType: string; uploadedBy: string }) {
  const { error } = await supabaseAdmin.from("inquiry_files").insert({
    inquiry_id: params.inquiryId,
    file_path: params.filePath,
    file_name: params.fileName.slice(0, 200),
    mime_type: params.mimeType || "application/octet-stream",
    uploaded_by: params.uploadedBy,
  });
  return error;
}

export async function deleteInquiryFile(inquiryId: string, fileId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("inquiry_files").select("file_path").eq("id", fileId).eq("inquiry_id", inquiryId).maybeSingle();
  if (!data) return false;
  await supabaseAdmin.from("inquiry_files").delete().eq("id", fileId);
  await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).remove([data.file_path as string]).catch(() => {});
  return true;
}

/** Takes the attached files out of storage before their inquiries are deleted (the rows go with the inquiry). */
export async function removeFilesOfInquiries(inquiryIds: string[]): Promise<void> {
  const paths: string[] = [];
  for (let i = 0; i < inquiryIds.length; i += 100) {
    const { data, error } = await supabaseAdmin.from("inquiry_files").select("file_path").in("inquiry_id", inquiryIds.slice(i, i + 100));
    if (error) return;
    paths.push(...(data ?? []).map((r) => r.file_path as string));
  }
  for (let i = 0; i < paths.length; i += 100) {
    await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).remove(paths.slice(i, i + 100)).catch(() => {});
  }
}
