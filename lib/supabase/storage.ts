import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./server";

export const PORTFOLIO_BUCKET = "portfolio-files";
export const SCHEDULE_BUCKET = "schedules";

export async function ensureBuckets() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const names = new Set((buckets ?? []).map((b) => b.name));
  if (!names.has(PORTFOLIO_BUCKET)) {
    await supabaseAdmin.storage.createBucket(PORTFOLIO_BUCKET, { public: false });
  }
  if (!names.has(SCHEDULE_BUCKET)) {
    await supabaseAdmin.storage.createBucket(SCHEDULE_BUCKET, { public: false });
  }
}

/** Supabase Storage object keys reject non-ASCII characters (e.g. Arabic file names),
 *  so we only carry a safe extension through to the storage key; the original file name
 *  is kept separately in the database `file_name` column for display/download. */
function safeExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return "";
  const ext = fileName.slice(dot).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

export function buildPortfolioPath(
  teacherId: string,
  category: string,
  subcategory: string | null,
  fileName: string
) {
  const sub = subcategory ?? "none";
  return `portfolio/${teacherId}/${category}/${sub}/${randomUUID()}${safeExtension(fileName)}`;
}

export function buildSchedulePath(teacherId: string, fileName: string) {
  return `schedules/${teacherId}/${randomUUID()}${safeExtension(fileName)}`;
}

export function buildSchoolFilePath(category: string, fileName: string) {
  return `school-management/${category}/${randomUUID()}${safeExtension(fileName)}`;
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  mimeType: string
) {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, { contentType: mimeType, upsert: false });
  if (error) throw error;
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 300) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * A one-time URL the browser can upload directly to, bypassing our own serverless function --
 * Vercel hard-caps a serverless function's request body at 4.5MB, well under the 10MB files this
 * app accepts, so large files must go straight from the browser to storage instead of through
 * our API route.
 */
export async function createUploadSignedUrl(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}
