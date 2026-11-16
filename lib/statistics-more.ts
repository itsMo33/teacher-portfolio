import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { DAY_LABELS, count, fetchAll, rangeStart, userNames, type StatRange } from "@/lib/statistics";
import { addDays, weekStartOf } from "@/lib/teacher-performance";
import { getWeeklyPlanStatuses } from "@/lib/weekly-plan";

// ---- الجدول المدرسي ----

export interface ScheduleStats {
  teachers: number;
  slots: number;
  sections: number;
  avgLoad: number;
  byTeacher: [string, number][];
  bySubject: [string, number][];
  byDay: [string, number][];
  byPeriod: [string, number][];
}

export async function getScheduleStats(): Promise<ScheduleStats> {
  const [slots, names, sections] = await Promise.all([
    fetchAll<{ teacher_id: string; day: string; period: string; subject: { name_ar: string } | { name_ar: string }[] | null }>((from, to) =>
      supabaseAdmin.from("schedule_slots").select("teacher_id, day, period, subject:subjects(name_ar)").order("id").range(from, to)
    ),
    userNames(),
    supabaseAdmin.from("class_sections").select("id", { count: "exact", head: true }),
  ]);
  const subjectName = (s: (typeof slots)[number]) => (Array.isArray(s.subject) ? s.subject[0]?.name_ar : s.subject?.name_ar);
  const teachers = new Set(slots.map((s) => s.teacher_id)).size;
  return {
    teachers,
    slots: slots.length,
    sections: sections.count ?? 0,
    avgLoad: teachers ? Math.round((slots.length / teachers) * 10) / 10 : 0,
    byTeacher: count(slots, (s) => names.get(s.teacher_id)),
    bySubject: count(slots, subjectName).slice(0, 20),
    byDay: count(slots, (s) => DAY_LABELS[s.day] ?? s.day),
    byPeriod: count(slots, (s) => `الحصة ${s.period}`).sort((a, b) => a[0].localeCompare(b[0])),
  };
}

// ---- الخطة الأسبوعية ----

export interface WeeklyPlanStats {
  weeks: { week: string; uploaded: number; missing: number }[];
  /** How many of the weeks shown each teacher missed, most first. */
  missedMost: [string, number][];
}

export async function getWeeklyPlanStats(weeksBack = 6): Promise<WeeklyPlanStats> {
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const current = weekStartOf(today);
  const starts = Array.from({ length: weeksBack }, (_, i) => addDays(current, -7 * i));
  const results = await Promise.all(starts.map((w) => getWeeklyPlanStatuses(w)));
  const missed = new Map<string, number>();
  const weeks = starts.map((week, i) => {
    const rows = results[i].filter((r) => r.status !== "na");
    for (const r of rows) if (r.status === "missing") missed.set(r.name, (missed.get(r.name) ?? 0) + 1);
    return { week, uploaded: rows.filter((r) => r.status === "uploaded").length, missing: rows.filter((r) => r.status === "missing").length };
  });
  return { weeks, missedMost: [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20) };
}

// ---- إدارة المدرسة ----

export interface SchoolFilesStats {
  total: number;
  byCategory: [string, number][];
  byUploader: [string, number][];
}

export async function getSchoolFilesStats(range: StatRange): Promise<SchoolFilesStats> {
  const since = rangeStart(range);
  const [rows, names, cats] = await Promise.all([
    fetchAll<{ category: string; uploaded_by: string }>((from, to) => {
      let q = supabaseAdmin.from("school_files").select("category, uploaded_by").is("deleted_at", null).order("uploaded_at");
      if (since) q = q.gte("uploaded_at", since);
      return q.range(from, to);
    }),
    userNames(),
    supabaseAdmin.from("school_management_categories").select("key, label_ar"),
  ]);
  const label = new Map((cats.data ?? []).map((c) => [c.key as string, c.label_ar as string]));
  return {
    total: rows.length,
    byCategory: count(rows, (r) => label.get(r.category) ?? r.category),
    byUploader: count(rows, (r) => names.get(r.uploaded_by)).slice(0, 15),
  };
}

// ---- قياس الأثر ----

export interface ImpactStats {
  total: number;
  avgImprovementPct: number | null;
  byLevel: [string, number][];
  bySubject: [string, number][];
  byTeacher: [string, number][];
}

export async function getImpactStats(range: StatRange): Promise<ImpactStats> {
  const since = rangeStart(range);
  const [rows, names] = await Promise.all([
    fetchAll<{ teacher_id: string; subject: string; improvement_level: string; max_score: number; score_before: number; score_after: number }>((from, to) => {
      let q = supabaseAdmin.from("impact_measurements").select("teacher_id, subject, improvement_level, max_score, score_before, score_after").order("created_at");
      if (since) q = q.gte("created_at", since);
      return q.range(from, to);
    }),
    userNames(),
  ]);
  const gains = rows.filter((r) => r.max_score > 0).map((r) => ((r.score_after - r.score_before) / r.max_score) * 100);
  return {
    total: rows.length,
    avgImprovementPct: gains.length ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 10) / 10 : null,
    byLevel: count(rows, (r) => r.improvement_level),
    bySubject: count(rows, (r) => r.subject).slice(0, 15),
    byTeacher: count(rows, (r) => names.get(r.teacher_id)).slice(0, 15),
  };
}

// ---- الاستئذان ----

export interface ExcuseStats {
  total: number;
  bySubsection: [string, number][];
  byTeacher: [string, number][];
}

const EXCUSE_LABELS: Record<string, string> = {
  hospital_appointments: "مواعيد المستشفى",
  health_center_appointments: "مواعيد المراكز الصحية",
  other: "أخرى",
};

export async function getExcuseStats(range: StatRange): Promise<ExcuseStats> {
  const since = rangeStart(range);
  const [rows, names] = await Promise.all([
    fetchAll<{ teacher_id: string; subcategory: string | null }>((from, to) => {
      let q = supabaseAdmin.from("attachments").select("teacher_id, subcategory").eq("category", "excuse_request").is("deleted_at", null).order("uploaded_at");
      if (since) q = q.gte("uploaded_at", since);
      return q.range(from, to);
    }),
    userNames(),
  ]);
  return {
    total: rows.length,
    bySubsection: count(rows, (r) => EXCUSE_LABELS[r.subcategory ?? ""] ?? r.subcategory ?? "غير محدد"),
    byTeacher: count(rows, (r) => names.get(r.teacher_id)).slice(0, 15),
  };
}

// ---- سجل النشاط ----

export interface ActivityStats {
  total: number;
  byAction: [string, number][];
  byActor: [string, number][];
  byDay: [string, number][];
}

export async function getActivityStats(range: StatRange): Promise<ActivityStats> {
  const since = rangeStart(range);
  const rows = await fetchAll<{ action: string; actor_name: string; created_at: string }>((from, to) => {
    let q = supabaseAdmin.from("activity_log").select("action, actor_name, created_at").order("created_at");
    if (since) q = q.gte("created_at", since);
    return q.range(from, to);
  });
  return {
    total: rows.length,
    byAction: count(rows, (r) => r.action).slice(0, 20),
    byActor: count(rows, (r) => r.actor_name).slice(0, 15),
    byDay: count(rows, (r) => r.created_at.slice(0, 10))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14),
  };
}

// ---- الحسابات ----

export interface AccountStats {
  total: number;
  byRole: [string, number][];
  byCategory: [string, number][];
  flags: [string, number][];
}

const ROLE_LABELS: Record<string, string> = { teacher: "معلمون", staff: "إداريون", agent: "وكلاء / موجهون", manager: "مدير" };

export async function getAccountStats(): Promise<AccountStats> {
  const [{ data }, cats] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("role, restricted_category, track_performance, can_build_schedule, can_track_class_time, demo_view_only")
      .is("deleted_at", null)
      .not("national_id", "like", "9999%"),
    supabaseAdmin.from("school_management_categories").select("key, label_ar"),
  ]);
  const rows = data ?? [];
  const label = new Map((cats.data ?? []).map((c) => [c.key as string, c.label_ar as string]));
  return {
    total: rows.length,
    byRole: count(rows, (r) => ROLE_LABELS[r.role as string] ?? (r.role as string)),
    byCategory: count(rows, (r) => (r.restricted_category ? label.get(r.restricted_category as string) ?? (r.restricted_category as string) : null)),
    flags: [
      ["تُتابَع في الأداء", rows.filter((r) => r.track_performance).length],
      ["يبنون الجدول المدرسي", rows.filter((r) => r.can_build_schedule).length],
      ["يرصدون الالتزام بزمن الحصة", rows.filter((r) => r.can_track_class_time).length],
      ["حسابات عرض فقط", rows.filter((r) => r.demo_view_only).length],
    ] as [string, number][],
  };
}
