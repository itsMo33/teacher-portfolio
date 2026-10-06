import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_BUCKET, SCHEDULE_BUCKET } from "@/lib/supabase/storage";
import { getSection } from "@/lib/portfolio-sections";

export type ReviewStatus = "accepted" | "needs_revision";

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  accepted: "مقبول",
  needs_revision: "يحتاج تعديل",
};

/** Who may use متابعة ملفات المعلمين (the weekly review): admin-level accounts with no category scope (e.g. رائد الحمدان, the
 *  manager). They can already open every teacher's files one by one, so this adds no new access. */
export function canReview(user: { role: string; restrictedCategory?: string | null; demoViewOnly?: boolean }): boolean {
  return (user.role === "agent" || user.role === "manager") && !user.restrictedCategory && !user.demoViewOnly;
}

export interface ReviewFile {
  id: string;
  /** Schedule files have no per-file verdict -- the schedule is a single upload, not a weekly deliverable. */
  kind: "attachment" | "schedule";
  sectionLabel: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  signedUrl: string;
  reviewStatus: ReviewStatus | null;
  reviewNote: string | null;
}

export interface ReviewGroup {
  teacherId: string;
  name: string;
  subject: string | null;
  files: ReviewFile[];
}

export interface MissingTeacher {
  id: string;
  name: string;
  subject: string | null;
}

export interface WeeklyReview {
  groups: ReviewGroup[];
  missingPlan: MissingTeacher[];
  missingAny: MissingTeacher[];
  teacherCount: number;
  firstPassFrom: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

type AttachmentRow = {
  id: string;
  teacher_id: string;
  category: string;
  subcategory: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  uploaded_at: string;
  review_status: string | null;
  review_note: string | null;
};
type ScheduleRow = { id: string; teacher_id: string; file_name: string; file_path: string; uploaded_at: string };

/** Signs the files' URLs and shapes them for the review screens, grouped by teacher. */
async function toReviewFiles(attachments: AttachmentRow[], schedules: ScheduleRow[]): Promise<Map<string, ReviewFile[]>> {
  const newAttachments = attachments;
  const newSchedules = schedules;
  const signed = new Map<string, string>();
  const sign = async (bucket: string, paths: string[]) => {
    for (let i = 0; i < paths.length; i += 200) {
      const chunk = paths.slice(i, i + 200);
      const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrls(chunk, SIGNED_URL_TTL_SECONDS);
      (data ?? []).forEach((d) => {
        if (d.path && d.signedUrl) signed.set(`${bucket}:${d.path}`, d.signedUrl);
      });
    }
  };
  await Promise.all([
    sign(PORTFOLIO_BUCKET, newAttachments.map((a) => a.file_path)),
    sign(SCHEDULE_BUCKET, newSchedules.map((s) => s.file_path)),
  ]);

  const filesByTeacher = new Map<string, ReviewFile[]>();
  const push = (teacherId: string, file: ReviewFile) => {
    const list = filesByTeacher.get(teacherId) ?? [];
    list.push(file);
    filesByTeacher.set(teacherId, list);
  };

  for (const a of newAttachments) {
    const section = getSection(a.category);
    const subLabel = a.subcategory ? section?.subsections?.find((s) => s.key === a.subcategory)?.labelAr ?? a.subcategory : null;
    push(a.teacher_id, {
      id: a.id,
      kind: "attachment",
      sectionLabel: [section?.labelAr ?? a.category, subLabel].filter(Boolean).join(" / "),
      fileName: a.file_name,
      mimeType: a.mime_type || guessMimeType(a.file_name),
      uploadedAt: a.uploaded_at,
      signedUrl: signed.get(`${PORTFOLIO_BUCKET}:${a.file_path}`) ?? "",
      reviewStatus: (a.review_status as ReviewStatus | null) ?? null,
      reviewNote: a.review_note,
    });
  }
  for (const s of newSchedules) {
    push(s.teacher_id, {
      id: s.id,
      kind: "schedule",
      sectionLabel: "الجدول المدرسي",
      fileName: s.file_name,
      mimeType: guessMimeType(s.file_name),
      uploadedAt: s.uploaded_at,
      signedUrl: signed.get(`${SCHEDULE_BUCKET}:${s.file_path}`) ?? "",
      reviewStatus: null,
      reviewNote: null,
    });
  }
  return filesByTeacher;
}

/** What `reviewerId` has yet to look at, plus who hasn't uploaded in the last `days` days.
 *
 *  "New" is per teacher: files the teacher uploaded after the reviewer last pressed "تمت المراجعة"
 *  on them. A teacher the reviewer has never marked starts from a default of the last 7 days, so
 *  the very first visit shows a week of uploads rather than every file ever submitted. */
export async function getWeeklyReview(reviewerId: string, days: number): Promise<WeeklyReview> {
  const now = Date.now();
  const firstPassFromMs = now - 7 * DAY_MS;
  const windowStartMs = now - days * DAY_MS;
  const firstPassFrom = new Date(firstPassFromMs).toISOString();

  const [{ data: teachers }, { data: marks }] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, subject").eq("role", "teacher").is("deleted_at", null).order("name"),
    supabaseAdmin.from("weekly_review_marks").select("teacher_id, reviewed_at").eq("reviewer_id", reviewerId),
  ]);
  const teacherList = teachers ?? [];
  // Timestamps from the database and from JS have different string formats, so compare as numbers.
  const markOf = new Map((marks ?? []).map((m) => [m.teacher_id as string, new Date(m.reviewed_at as string).getTime()]));

  // The oldest point any teacher's "new" window can start from bounds how far back to fetch.
  const fetchFrom = new Date(Math.min(firstPassFromMs, windowStartMs, ...markOf.values())).toISOString();

  const [{ data: attachments }, { data: schedules }] = await Promise.all([
    supabaseAdmin
      .from("attachments")
      .select("id, teacher_id, category, subcategory, file_name, file_path, mime_type, uploaded_at, uploaded_by, review_status, review_note")
      .gte("uploaded_at", fetchFrom)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("schedules")
      .select("id, teacher_id, file_name, file_path, uploaded_at, uploaded_by")
      .gte("uploaded_at", fetchFrom)
      .is("deleted_at", null),
  ]);

  // Only what the teacher uploaded themselves counts -- files an admin uploaded *for* a teacher
  // aren't something the teacher "sent".
  const fromTeacher = <T extends { teacher_id: string; uploaded_by: string }>(rows: T[] | null) =>
    (rows ?? []).filter((r) => r.uploaded_by === r.teacher_id);
  const ownAttachments = fromTeacher(attachments);
  const ownSchedules = fromTeacher(schedules);

  const baselineOf = (teacherId: string) => markOf.get(teacherId) ?? firstPassFromMs;

  const newAttachments = ownAttachments.filter((a) => new Date(a.uploaded_at).getTime() > baselineOf(a.teacher_id));
  const newSchedules = ownSchedules.filter((s) => new Date(s.uploaded_at).getTime() > baselineOf(s.teacher_id));

  const filesByTeacher = await toReviewFiles(newAttachments, newSchedules);

  const groups: ReviewGroup[] = teacherList
    .filter((t) => filesByTeacher.has(t.id))
    .map((t) => ({
      teacherId: t.id,
      name: t.name,
      subject: t.subject,
      files: (filesByTeacher.get(t.id) ?? []).sort((x, y) => new Date(y.uploadedAt).getTime() - new Date(x.uploadedAt).getTime()),
    }));

  // Who hasn't sent anything lately -- judged over the chosen window, independent of review marks.
  const uploadedPlan = new Set<string>();
  const uploadedAny = new Set<string>();
  for (const a of ownAttachments) {
    if (new Date(a.uploaded_at).getTime() < windowStartMs) continue;
    uploadedAny.add(a.teacher_id);
    if (a.category === "weekly_plan_admin") uploadedPlan.add(a.teacher_id);
  }
  for (const s of ownSchedules) {
    if (new Date(s.uploaded_at).getTime() >= windowStartMs) uploadedAny.add(s.teacher_id);
  }
  const toMissing = (t: { id: string; name: string; subject: string | null }): MissingTeacher => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
  });

  return {
    groups,
    missingPlan: teacherList.filter((t) => !uploadedPlan.has(t.id)).map(toMissing),
    missingAny: teacherList.filter((t) => !uploadedAny.has(t.id)).map(toMissing),
    teacherCount: teacherList.length,
    firstPassFrom,
  };
}

/** Files a reviewer sent back to this teacher, for the notice on the teacher's dashboard. */
export async function getFilesNeedingRevision(teacherId: string) {
  const { data } = await supabaseAdmin
    .from("attachments")
    .select("id, category, subcategory, file_name, review_note, reviewed_at")
    .eq("teacher_id", teacherId)
    .eq("review_status", "needs_revision")
    .is("deleted_at", null)
    .order("reviewed_at", { ascending: false });

  return (data ?? []).map((a) => {
    const section = getSection(a.category);
    return {
      id: a.id as string,
      category: a.category as string,
      sectionLabel: section?.labelAr ?? (a.category as string),
      fileName: a.file_name as string,
      note: (a.review_note as string | null) ?? null,
    };
  });
}

/** Everything one teacher has ever uploaded themselves (newest first), for reviewing older files that
 *  fell outside the weekly window -- the same accept / send-back verdicts apply. */
export async function getAllFilesForTeacher(teacherId: string): Promise<ReviewFile[]> {
  const [{ data: attachments }, { data: schedules }] = await Promise.all([
    supabaseAdmin
      .from("attachments")
      .select("id, teacher_id, category, subcategory, file_name, file_path, mime_type, uploaded_at, uploaded_by, review_status, review_note")
      .eq("teacher_id", teacherId)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("schedules")
      .select("id, teacher_id, file_name, file_path, uploaded_at, uploaded_by")
      .eq("teacher_id", teacherId)
      .is("deleted_at", null),
  ]);
  const own = <T extends { uploaded_by: string }>(rows: T[] | null) => (rows ?? []).filter((r) => r.uploaded_by === teacherId);
  const grouped = await toReviewFiles(own(attachments) as AttachmentRow[], own(schedules) as ScheduleRow[]);
  return (grouped.get(teacherId) ?? []).sort((x, y) => new Date(y.uploadedAt).getTime() - new Date(x.uploadedAt).getTime());
}
