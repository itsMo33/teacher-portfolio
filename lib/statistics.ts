import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { INQUIRY_DEADLINE_DAYS } from "@/lib/inquiry-logic";

export type StatRange = "week" | "month" | "all";

export const RANGE_LABELS: Record<StatRange, string> = { week: "آخر 7 أيام", month: "آخر 30 يوم", all: "الكل" };

export function parseRange(value: string | undefined): StatRange {
  return value === "week" || value === "month" ? value : "all";
}

/** The start of the range as an ISO timestamp, or null for "all". */
export function rangeStart(range: StatRange): string | null {
  if (range === "all") return null;
  const days = range === "week" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** People left out of every statistic: their account, files and records stay exactly as they are -- they just do not
 *  count in the numbers (احمد الياسين). Matched by national ID. */
export const STATS_EXCLUDED_NATIONAL_IDS = ["1870007438"];

export interface StatsExclusion {
  ids: Set<string>;
  names: Set<string>;
}

export async function excludedUsers(): Promise<StatsExclusion> {
  const { data } = await supabaseAdmin.from("users").select("id, name").in("national_id", STATS_EXCLUDED_NATIONAL_IDS);
  return { ids: new Set((data ?? []).map((u) => u.id as string)), names: new Set((data ?? []).map((u) => u.name as string)) };
}

/** The rows that are not about an excluded person. */
export function without<T>(rows: T[], excluded: Set<string>, idOf: (row: T) => string | null | undefined): T[] {
  return excluded.size === 0 ? rows : rows.filter((r) => !excluded.has(idOf(r) ?? ""));
}

/** Reads every row of a query that may hold more than the 1000 rows a single request returns. */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function userNames(): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin.from("users").select("id, name");
  return new Map((data ?? []).map((u) => [u.id as string, u.name as string]));
}

export function count<T>(rows: T[], key: (r: T) => string | null | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function avgDays(pairs: [string | null, string | null][]): number | null {
  const diffs = pairs
    .filter((p): p is [string, string] => !!p[0] && !!p[1])
    .map(([from, to]) => (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS)
    .filter((d) => d >= 0);
  if (diffs.length === 0) return null;
  return Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10;
}

// ---- المسائلات ----

export interface InquiryStats {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
  /** Not answered by the teacher and past the one-week deadline. */
  overdue: number;
  withFiles: number;
  avgDaysToAnswer: number | null;
  avgDaysToDecision: number | null;
  byKind: { kind: string; total: number; accepted: number; rejected: number; pending: number }[];
  byTeacher: { name: string; total: number; accepted: number; rejected: number; pending: number; minutes: number }[];
  byDay: [string, number][];
}

export async function getInquiryStats(range: StatRange): Promise<InquiryStats> {
  const since = rangeStart(range);
  const [allRows, names, ex] = await Promise.all([
    fetchAll<{
      id: string;
      kind: string;
      teacher_id: string;
      created_at: string;
      delay_minutes: number | null;
      justified_at: string | null;
      decision: string | null;
      decided_at: string | null;
    }>((from, to) => {
      let q = supabaseAdmin.from("inquiries").select("id, kind, teacher_id, created_at, delay_minutes, justified_at, decision, decided_at").order("created_at");
      if (since) q = q.gte("created_at", since);
      return q.range(from, to);
    }),
    userNames(),
    excludedUsers(),
  ]);
  const rows = without(allRows, ex.ids, (r) => r.teacher_id);

  // inquiries with attached files (the table exists once the attachments feature is switched on)
  let withFilesIds = new Set<string>();
  const filesRes = await supabaseAdmin.from("inquiry_files").select("inquiry_id");
  if (!filesRes.error) withFilesIds = new Set((filesRes.data ?? []).map((f) => f.inquiry_id as string));

  const state = (r: { decision: string | null }) => (r.decision === "accepted" ? "accepted" : r.decision === "rejected" ? "rejected" : "pending");
  const now = Date.now();
  const stats: InquiryStats = {
    total: rows.length,
    accepted: rows.filter((r) => state(r) === "accepted").length,
    rejected: rows.filter((r) => state(r) === "rejected").length,
    pending: rows.filter((r) => state(r) === "pending").length,
    overdue: rows.filter((r) => !r.decision && !r.justified_at && now - new Date(r.created_at).getTime() > INQUIRY_DEADLINE_DAYS * DAY_MS).length,
    withFiles: rows.filter((r) => withFilesIds.has(r.id)).length,
    avgDaysToAnswer: avgDays(rows.map((r) => [r.created_at, r.justified_at])),
    avgDaysToDecision: avgDays(rows.map((r) => [r.created_at, r.decided_at])),
    byKind: ["delay", "absence", "other"].map((kind) => {
      const of = rows.filter((r) => r.kind === kind);
      return { kind, total: of.length, accepted: of.filter((r) => state(r) === "accepted").length, rejected: of.filter((r) => state(r) === "rejected").length, pending: of.filter((r) => state(r) === "pending").length };
    }),
    byTeacher: [],
    byDay: count(rows, (r) => r.created_at.slice(0, 10)).sort((a, b) => a[0].localeCompare(b[0])),
  };

  const per = new Map<string, InquiryStats["byTeacher"][number]>();
  for (const r of rows) {
    const e = per.get(r.teacher_id) ?? { name: names.get(r.teacher_id) ?? "—", total: 0, accepted: 0, rejected: 0, pending: 0, minutes: 0 };
    e.total++;
    e[state(r)]++;
    e.minutes += r.delay_minutes ?? 0;
    per.set(r.teacher_id, e);
  }
  stats.byTeacher = [...per.values()].sort((a, b) => b.total - a.total || b.minutes - a.minutes);
  return stats;
}

// ---- متابعة الأداء ----

export interface PerformanceStats {
  categories: { key: string; label: string; absent: number; late: number; lateMinutes: number }[];
  topTeachers: { name: string; absent: number; late: number; lateMinutes: number }[];
  totalLateMinutes: number;
}

const PERFORMANCE_LABELS: Record<string, string> = {
  morning_lineup: "الطابور الصباحي",
  supervision: "الإشراف",
  duty: "المناوبة",
  waiting_period_activation: "تفعيل حصص الانتظار",
  class_time_commitment: "الالتزام بزمن الحصة",
};

export async function getPerformanceStats(range: StatRange): Promise<PerformanceStats> {
  const since = rangeStart(range);
  const [allRows, names, ex] = await Promise.all([
    fetchAll<{ teacher_id: string; category: string; status: string; late_minutes: number | null }>((from, to) => {
      let q = supabaseAdmin.from("teacher_performance_records").select("teacher_id, category, status, late_minutes").order("record_date");
      if (since) q = q.gte("record_date", since.slice(0, 10));
      return q.range(from, to);
    }),
    userNames(),
    excludedUsers(),
  ]);
  const rows = without(allRows, ex.ids, (r) => r.teacher_id);

  const categories = Object.keys(PERFORMANCE_LABELS).map((key) => {
    const of = rows.filter((r) => r.category === key);
    return {
      key,
      label: PERFORMANCE_LABELS[key],
      absent: of.filter((r) => r.status === "absent").length,
      late: of.filter((r) => r.status === "late").length,
      lateMinutes: of.reduce((s, r) => s + (r.late_minutes ?? 0), 0),
    };
  });

  const per = new Map<string, { name: string; absent: number; late: number; lateMinutes: number }>();
  for (const r of rows) {
    if (r.status === "present") continue;
    const e = per.get(r.teacher_id) ?? { name: names.get(r.teacher_id) ?? "—", absent: 0, late: 0, lateMinutes: 0 };
    if (r.status === "absent") e.absent++;
    else if (r.status === "late") {
      e.late++;
      e.lateMinutes += r.late_minutes ?? 0;
    }
    per.set(r.teacher_id, e);
  }
  const topTeachers = [...per.values()].sort((a, b) => b.absent + b.late - (a.absent + a.late)).slice(0, 15);
  return { categories, topTeachers, totalLateMinutes: categories.reduce((s, c) => s + c.lateMinutes, 0) };
}

// ---- جدول الانتظار ----

export interface WaitingStats {
  total: number;
  bySubstitute: [string, number][];
  byAbsent: [string, number][];
  byDay: [string, number][];
  byPeriod: [string, number][];
}

export const DAY_LABELS: Record<string, string> = { احد: "الأحد", اثنين: "الاثنين", ثلاثاء: "الثلاثاء", اربعاء: "الأربعاء", خميس: "الخميس" };

export async function getWaitingStats(range: StatRange): Promise<WaitingStats> {
  const since = rangeStart(range);
  const ex = await excludedUsers();
  const allRows = await fetchAll<{ day: string; period: string; absent_teacher: string; substitute: string }>((from, to) => {
    let q = supabaseAdmin.from("substitute_assignments").select("day, period, absent_teacher, substitute").order("created_at");
    if (since) q = q.gte("created_at", since);
    return q.range(from, to);
  });
  const rows = allRows.filter((r) => !ex.names.has(r.absent_teacher) && !ex.names.has(r.substitute) && !isExcludedShortName(r.absent_teacher, ex) && !isExcludedShortName(r.substitute, ex));
  return {
    total: rows.length,
    bySubstitute: count(rows, (r) => r.substitute).slice(0, 15),
    byAbsent: count(rows, (r) => r.absent_teacher).slice(0, 15),
    byDay: count(rows, (r) => DAY_LABELS[r.day] ?? r.day),
    byPeriod: count(rows, (r) => `الحصة ${r.period}`).sort((a, b) => a[0].localeCompare(b[0])),
  };
}

// ---- مراجعة ملفات المعلمين ----

export interface ReviewStats {
  files: number;
  accepted: number;
  needsRevision: number;
  notReviewed: number;
  revisionByTeacher: [string, number][];
}

export async function getReviewStats(range: StatRange): Promise<ReviewStats> {
  const since = rangeStart(range);
  const [allRows, names, ex] = await Promise.all([
    fetchAll<{ teacher_id: string; review_status: string | null }>((from, to) => {
      let q = supabaseAdmin.from("attachments").select("teacher_id, review_status").is("deleted_at", null).order("uploaded_at");
      if (since) q = q.gte("uploaded_at", since);
      return q.range(from, to);
    }),
    userNames(),
    excludedUsers(),
  ]);
  const rows = without(allRows, ex.ids, (r) => r.teacher_id);
  return {
    files: rows.length,
    accepted: rows.filter((r) => r.review_status === "accepted").length,
    needsRevision: rows.filter((r) => r.review_status === "needs_revision").length,
    notReviewed: rows.filter((r) => !r.review_status).length,
    revisionByTeacher: count(rows.filter((r) => r.review_status === "needs_revision"), (r) => names.get(r.teacher_id)).slice(0, 15),
  };
}

/** The waiting table keeps short names ("احمد الياسين"); an excluded person matches when their short name equals it. */
function isExcludedShortName(short: string, ex: StatsExclusion): boolean {
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  return [...ex.names].some((full) => {
    const parts = norm(full).split(" ");
    return norm(short) === `${parts[0]} ${parts[parts.length - 1]}`;
  });
}
