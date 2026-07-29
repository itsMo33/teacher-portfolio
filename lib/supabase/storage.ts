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

export function buildPortfolioPath(
  teacherId: string,
  category: string,
  subcategory: string | null,
  fileName: string
) {
  const sub = subcategory ?? "none";
  return `portfolio/${teacherId}/${category}/${sub}/${randomUUID()}-${fileName}`;
}

export function buildSchedulePath(teacherId: string, fileName: string) {
  return `schedules/${teacherId}/${randomUUID()}-${fileName}`;
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
