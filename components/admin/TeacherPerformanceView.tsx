"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDays,
  MADRASATI_PREP_LABELS_AR,
  nextMadrasatiPrepStatus,
  PERFORMANCE_CATEGORIES,
  PERFORMANCE_PERIODS,
  PerformanceCategory,
  PerformancePeriod,
  weekStartOf,
  type MadrasatiPrepStatus,
} from "@/lib/teacher-performance";

interface Teacher {
  id: string;
  name: string;
}

type Status = "present" | "absent" | "late";

interface Record_ {
  teacherId: string;
  category: PerformanceCategory;
  status: Status;
  period: string | null;
  /** Minutes late -- only ever set on a "late" period record. */
  minutes: number | null;
}

interface StatsRecord {
  category: PerformanceCategory;
  date: string;
  status: Status;
  period: string | null;
  minutes: number | null;
}

/** Quick picks for how long a teacher was late; any other number can be typed. */
const MINUTE_CHOICES = [5, 10, 15, 20, 30];

const NAME_BUTTON =
  "flex w-full select-none items-center gap-1.5 rounded-xl border px-3 py-2.5 text-right text-sm transition-all duration-150 hover:shadow-sm active:scale-[0.97]";

const STATUS_COLORS = {
  present: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  late: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  absent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  none: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
} as const;

const PREP_COLORS = {
  green: STATUS_COLORS.present,
  yellow: STATUS_COLORS.late,
  red: STATUS_COLORS.absent,
} as const;

const PREP_DOT = { green: "bg-green-500", yellow: "bg-amber-400", red: "bg-red-500" } as const;

function formatArDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The متابعة أداء المعلمين screen. With `classTimeOnly` it is the cut-down version for accounts that
 *  only track الالتزام بزمن الحصة: just that one section, without the other categories, تحضير
 *  مدرستي, the statistics or the weekly print. */
export function TeacherPerformanceView({
  classTimeOnly = false,
  backHref = "/admin",
}: {
  classTimeOnly?: boolean;
  backHref?: string;
}) {
  const [date, setDate] = useState(todayStr());
  const [activeCategory, setActiveCategory] = useState<PerformanceCategory>(
    classTimeOnly ? "class_time_commitment" : PERFORMANCE_CATEGORIES[0].key
  );
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  // تفعيل حصص الانتظار: who was put in as المنتظر on the chosen day (from the waiting table), and in which periods.
  const [waiting, setWaiting] = useState<Record<string, string[]>>({});
  const [records, setRecords] = useState<Record_[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"track" | "prep" | "stats">("track");
  const [prepMarks, setPrepMarks] = useState<Partial<Record<string, "yellow" | "red">>>({});
  // Saves for the same name go out strictly in click order, so tapping through the colors quickly
  // always ends on the state you see; and only the newest load's answer is ever applied.
  const saveQueue = useRef(new Map<string, Promise<void>>());
  const pendingSaves = useRef(0);
  const loadSeq = useRef(0);
  const [statsTeacherId, setStatsTeacherId] = useState("");
  const [statsRecords, setStatsRecords] = useState<StatsRecord[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(true);
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);

  const load = useCallback((d: string, silent = false) => {
    const seq = ++loadSeq.current;
    if (!silent) setLoading(true);
    return fetch(`/api/teacher-performance?date=${d}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        if (seq !== loadSeq.current) return;
        setTeachers(data.teachers ?? []);
        setWaiting(
          Object.fromEntries(((data.waiting ?? []) as { teacherId: string; periods: string[] }[]).map((w) => [w.teacherId, w.periods]))
        );
        setRecords(data.records ?? []);
        setError("");
      })
      .catch(() => {
        if (seq === loadSeq.current) setError("تعذّر تحميل البيانات");
      })
      .finally(() => {
        if (seq !== loadSeq.current) return;
        setLoaded(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  // The marks are shared between everyone who tracks the day (رائد, the وكلاء, مفيد, صالح), so keep the
  // screen in step with what the others record -- but never refresh over this user's own unsaved taps.
  useEffect(() => {
    if (viewMode !== "track") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && pendingSaves.current === 0) load(date, true);
    }, 8000);
    return () => clearInterval(timer);
  }, [viewMode, date, load]);

  const loadPrep = useCallback((d: string) => {
    return fetch(`/api/teacher-performance/madrasati-prep?date=${d}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: { marks: { teacherId: string; status: "yellow" | "red" }[] }) => {
        setPrepMarks(Object.fromEntries(data.marks.map((m) => [m.teacherId, m.status])));
        setError("");
      })
      .catch(() => setError("تعذّر تحميل تحضير مدرستي"));
  }, []);

  useEffect(() => {
    if (viewMode === "prep") loadPrep(date);
  }, [viewMode, date, loadPrep]);

  /** Runs `task` after every earlier save for the same `key` has finished; a failed save reverts the
   *  screen to what the server really has instead of leaving a mark that never got stored. */
  const enqueueSave = useCallback(
    (key: string, task: () => Promise<Response>, onFail: () => void) => {
      pendingSaves.current++;
      const run = async () => {
        try {
          const res = await task();
          if (!res.ok) throw new Error("failed");
        } catch {
          onFail();
        } finally {
          pendingSaves.current--;
        }
      };
      const previous = saveQueue.current.get(key) ?? Promise.resolve();
      saveQueue.current.set(key, previous.then(run, run));
    },
    []
  );

  useEffect(() => {
    if (!statsTeacherId) return;
    fetch(`/api/teacher-performance/stats?teacherId=${statsTeacherId}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => setStatsRecords(data.records ?? []))
      .catch(() => setStatsRecords([]))
      .finally(() => setStatsLoaded(true));
  }, [statsTeacherId]);

  const category = useMemo(
    () => PERFORMANCE_CATEGORIES.find((c) => c.key === activeCategory)!,
    [activeCategory]
  );

  const statsByCategory = useMemo(() => {
    return PERFORMANCE_CATEGORIES.map((c) => {
      const recs = statsRecords
        .filter((r) => r.category === c.key)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      return {
        category: c,
        presentCount: recs.filter((r) => r.status === "present").length,
        absentCount: recs.filter((r) => r.status === "absent").length,
        lateCount: recs.filter((r) => r.status === "late").length,
        records: recs,
      };
    });
  }, [statsRecords]);

  const statusFor = useCallback(
    (teacherId: string): Status | null => {
      const rec = records.find((r) => r.teacherId === teacherId && r.category === activeCategory);
      if (rec) return rec.status;
      if (category.mode === "waiting-auto") return waiting[teacherId] ? "present" : null;
      return category.mode === "assumed-present" ? "present" : null;
    },
    [records, activeCategory, category, waiting]
  );

  /** For period-exception categories, the teacher chip shows the worst status among all periods
   *  that day -- absent beats late beats compliant. */
  const aggregateStatusFor = useCallback(
    (teacherId: string): Status => {
      const recs = records.filter((r) => r.teacherId === teacherId && r.category === activeCategory);
      if (recs.some((r) => r.status === "absent")) return "absent";
      if (recs.some((r) => r.status === "late")) return "late";
      return "present";
    },
    [records, activeCategory]
  );

  const periodStatusFor = useCallback(
    (teacherId: string, period: PerformancePeriod): "late" | "absent" | null => {
      const rec = records.find(
        (r) => r.teacherId === teacherId && r.category === activeCategory && r.period === period
      );
      return (rec?.status as "late" | "absent" | undefined) ?? null;
    },
    [records, activeCategory]
  );

  async function handleCycle(teacherId: string) {
    const current = statusFor(teacherId);
    let next: Status | null;

    if (category.mode === "waiting-auto") {
      // only someone who was put in as المنتظر can be marked: green <-> red (didn't show up)
      if (current === null) return;
      next = current === "absent" ? "present" : "absent";
    } else if (category.mode === "assumed-present") {
      // present (default, no row) <-> absent (row) -- a click just flips the exception on/off.
      next = current === "absent" ? "present" : "absent";
    } else {
      // blank (no row) -> present -> absent -> blank -> ...
      next = current === null ? "present" : current === "present" ? "absent" : null;
    }

    const isDefault =
      ((category.mode === "assumed-present" || category.mode === "waiting-auto") && next === "present") ||
      (category.mode === "explicit" && next === null);

    // Optimistic update.
    setRecords((prev) => {
      const filtered = prev.filter((r) => !(r.teacherId === teacherId && r.category === activeCategory));
      return next === null || isDefault
        ? filtered
        : [...filtered, { teacherId, category: activeCategory, status: next, period: null, minutes: null }];
    });

    enqueueSave(
      `${teacherId}:${activeCategory}`,
      () =>
        isDefault
          ? fetch("/api/teacher-performance", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teacherId, category: activeCategory, date }),
            })
          : fetch("/api/teacher-performance", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teacherId, category: activeCategory, date, status: next }),
            }),
      () => load(date)
    );
  }

  async function handlePeriodCycle(teacherId: string, period: PerformancePeriod) {
    const current = periodStatusFor(teacherId, period);
    // ملتزم (default, no row) -> متأخر -> لم يحضر -> ملتزم -> ...
    const next: "late" | "absent" | null = current === null ? "late" : current === "late" ? "absent" : null;

    setRecords((prev) => {
      const filtered = prev.filter(
        (r) => !(r.teacherId === teacherId && r.category === activeCategory && r.period === period)
      );
      return next === null
        ? filtered
        : [...filtered, { teacherId, category: activeCategory, status: next, period, minutes: null }];
    });

    enqueueSave(
      `${teacherId}:${activeCategory}:${period}`,
      () =>
        next === null
          ? fetch("/api/teacher-performance", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teacherId, category: activeCategory, date, period }),
            })
          : fetch("/api/teacher-performance", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teacherId, category: activeCategory, date, status: next, period }),
            }),
      () => load(date)
    );
  }

  /** Sets (or clears, with null) how many minutes a teacher was late in one period. */
  function handleMinutes(teacherId: string, period: PerformancePeriod, minutes: number | null) {
    setRecords((prev) =>
      prev.map((r) =>
        r.teacherId === teacherId && r.category === activeCategory && r.period === period ? { ...r, minutes } : r
      )
    );
    enqueueSave(
      `${teacherId}:${activeCategory}:${period}`,
      () =>
        fetch("/api/teacher-performance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId, category: activeCategory, date, status: "late", period, minutes }),
        }),
      () => load(date)
    );
  }

  function minutesFor(teacherId: string, period: PerformancePeriod): number | null {
    return (
      records.find((r) => r.teacherId === teacherId && r.category === activeCategory && r.period === period)?.minutes ??
      null
    );
  }

  function handlePrepCycle(teacherId: string) {
    const current: MadrasatiPrepStatus = prepMarks[teacherId] ?? "green";
    const next = nextMadrasatiPrepStatus(current);
    setPrepMarks((prev) => {
      const { [teacherId]: _removed, ...rest } = prev;
      void _removed;
      return next === "green" ? rest : { ...rest, [teacherId]: next };
    });
    enqueueSave(
      `${teacherId}:prep:${weekStartOf(date)}`,
      () =>
        fetch("/api/teacher-performance/madrasati-prep", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId, date, status: next }),
        }),
      () => loadPrep(date)
    );
  }

  const weekStart = weekStartOf(date);
  const descriptionText =
    viewMode === "prep"
      ? "تحضير مدرستي مرة وحدة بالأسبوع -- الكل أخضر، اضغط على الاسم: أصفر، ثم أحمر، ثم يرجع أخضر"
      : category.mode === "waiting-auto"
      ? "المعلم اللي تحطه منتظر في جدول الانتظار يصير أخضر هنا تلقائيًا -- إذا ما حضر الانتظار اضغط على اسمه ليصير أحمر"
      : category.mode === "assumed-present"
      ? "كل المعلمين مسجّلين حاضرين افتراضيًا -- اضغط على اسم المعلم الغائب لتحويله لغائب"
      : category.mode === "explicit"
        ? "كل المعلمين فاضين افتراضيًا -- اضغط لتسجيل حاضر، اضغط مرة ثانية لتسجيل غائب، وثالثة للرجوع فاضي"
        : "كل المعلمين ملتزمين افتراضيًا -- اضغط على اسم المعلم لاختيار الحصة، ثم اضغط عليها لتسجيل متأخر، ومرة ثانية لتسجيل لم يحضر";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            {classTimeOnly ? "الالتزام بزمن الحصة" : "متابعة أداء المعلمين"}
          </h2>
          <p className="text-sm text-slate-500">{descriptionText}</p>
        </div>
        <Link
          href={backHref}
          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          رجوع
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {viewMode !== "stats" && (
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setExpandedTeacherId(null);
                setDate(e.target.value);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          )}
          <div className={classTimeOnly ? "hidden" : "flex flex-wrap gap-2"}>
            {PERFORMANCE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setViewMode("track");
                  setActiveCategory(c.key);
                  setExpandedTeacherId(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  viewMode === "track" && activeCategory === c.key
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {c.labelAr}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setViewMode("prep");
                setExpandedTeacherId(null);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                viewMode === "prep"
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              تحضير مدرستي
            </button>
            <button
              type="button"
              onClick={() => setViewMode("stats")}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                viewMode === "stats"
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              إحصائيات
            </button>
          </div>
        </div>
        {classTimeOnly ? null : viewMode !== "stats" ? (
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === "track" && (
              <a
                href={`/admin/teacher-performance/print?category=${activeCategory}&date=${date}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                طباعة {category.labelAr}
              </a>
            )}
            <a
              href={`/admin/teacher-performance/weekly-print?week=${weekStart}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              الطباعة الأسبوعية
            </a>
          </div>
        ) : (
          statsTeacherId && (
            <a
              href={`/admin/teacher-performance/stats-print?teacherId=${statsTeacherId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              طباعة الإحصائيات
            </a>
          )
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {viewMode === "prep" ? (
        <div className={`flex flex-col gap-3 transition-opacity duration-200 ${!loaded ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              الأسبوع: {formatArDate(weekStart)} — {formatArDate(addDays(weekStart, 4))}
            </span>
            {(["green", "yellow", "red"] as const).map((st) => (
              <span key={st} className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-full ${PREP_DOT[st]}`} />
                {MADRASATI_PREP_LABELS_AR[st]}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:grid-cols-3">
            {teachers.map((t) => {
              const status: MadrasatiPrepStatus = prepMarks[t.id] ?? "green";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handlePrepCycle(t.id)}
                  className={`${NAME_BUTTON} ${PREP_COLORS[status]}`}
                >
                  <span className="font-bold">{status === "green" ? "✓" : status === "yellow" ? "!" : "✗"}</span>
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : viewMode === "track" ? (
        !loaded ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
            جارٍ التحميل...
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 transition-opacity duration-200 sm:grid-cols-3 ${
              loading ? "opacity-60" : ""
            }`}
          >
            {(category.mode === "waiting-auto"
              ? [...teachers].sort((a, b) => Number(!!waiting[b.id]) - Number(!!waiting[a.id]))
              : teachers
            ).map((t) => {
              if (category.mode === "period-exception") {
                const agg = aggregateStatusFor(t.id);
                const isExpanded = expandedTeacherId === t.id;
                return (
                  <Fragment key={t.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedTeacherId(isExpanded ? null : t.id)}
                      className={`${NAME_BUTTON} ${STATUS_COLORS[agg]} ${isExpanded ? "ring-2 ring-[var(--brand-primary)]" : ""}`}
                    >
                      <span className="font-bold">{agg === "present" ? "✓" : agg === "late" ? "⏱" : "✗"}</span>
                      <span className="truncate">{t.name}</span>
                    </button>
                    {isExpanded && (
                      <div className="col-span-full flex flex-wrap gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-2">
                        {PERFORMANCE_PERIODS.map((p) => {
                          const pStatus = periodStatusFor(t.id, p);
                          const pColor =
                            pStatus === "absent"
                              ? STATUS_COLORS.absent
                              : pStatus === "late"
                                ? STATUS_COLORS.late
                                : STATUS_COLORS.none;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handlePeriodCycle(t.id, p)}
                              className={`rounded-full border px-3 py-1.5 text-xs transition-all duration-150 active:scale-95 ${pColor}`}
                            >
                              الحصة {p}
                              {pStatus === "late" && (minutesFor(t.id, p) ? ` — متأخر ${minutesFor(t.id, p)} د` : " — متأخر")}
                              {pStatus === "absent" && " — لم يحضر"}
                            </button>
                          );
                        })}
                        {PERFORMANCE_PERIODS.filter((p) => periodStatusFor(t.id, p) === "late").map((p) => (
                          <div
                            key={`minutes-${p}`}
                            className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                          >
                            <span className="font-medium">الحصة {p} -- كم دقيقة تأخر؟</span>
                            <input
                              type="number"
                              min={1}
                              max={300}
                              inputMode="numeric"
                              value={minutesFor(t.id, p) ?? ""}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                handleMinutes(t.id, p, Number.isFinite(n) && n >= 1 && n <= 300 ? n : null);
                              }}
                              placeholder="دقائق"
                              className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                            />
                            {MINUTE_CHOICES.map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleMinutes(t.id, p, m)}
                                className={`rounded-full border px-2.5 py-1 transition-colors ${
                                  minutesFor(t.id, p) === m
                                    ? "border-amber-500 bg-amber-200 dark:bg-amber-800/50"
                                    : "border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </Fragment>
                );
              }

              const status = statusFor(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleCycle(t.id)}
                  disabled={category.mode === "waiting-auto" && status === null}
                  className={`${NAME_BUTTON} ${STATUS_COLORS[status ?? "none"]} ${
                    category.mode === "waiting-auto" && status === null ? "opacity-50 cursor-default hover:shadow-none active:scale-100" : ""
                  }`}
                >
                  <span className="font-bold">{status === "present" ? "✓" : status === "absent" ? "✗" : ""}</span>
                  <span className="truncate">{t.name}</span>
                  {category.mode === "waiting-auto" && waiting[t.id] && (
                    <span className="mr-auto shrink-0 text-xs opacity-80">
                      الحصة {[...waiting[t.id]].sort().join("، ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <select
            value={statsTeacherId}
            onChange={(e) => {
              setStatsRecords([]);
              setStatsLoaded(!e.target.value);
              setStatsTeacherId(e.target.value);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          >
            <option value="">— اختر معلماً —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {!statsTeacherId ? (
            <p className="text-sm text-slate-400 text-center py-6">اختر معلماً لعرض إحصائياته</p>
          ) : !statsLoaded ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
              جارٍ التحميل...
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {statsByCategory.map(({ category: c, presentCount, absentCount, lateCount, records: recs }) => (
                <div
                  key={c.key}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{c.labelAr}</h3>
                    <span className="text-sm text-slate-500">
                      {c.mode === "assumed-present" || c.mode === "waiting-auto"
                        ? `غياب: ${absentCount} مرة`
                        : c.mode === "period-exception"
                          ? `متأخر: ${lateCount} — لم يحضر: ${absentCount}`
                          : `حضور: ${presentCount} — غياب: ${absentCount}`}
                    </span>
                  </div>
                  {recs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
                      {recs.map((r) => (
                        <span
                          key={`${r.date}-${r.period ?? ""}`}
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            r.status === "present"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : r.status === "late"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {r.status === "present" ? "✓" : r.status === "late" ? `⏱ متأخر${r.minutes ? ` ${r.minutes} د` : ""}` : "✗ لم يحضر"}
                          {r.period ? ` — الحصة ${r.period}` : ""} — {formatArDate(r.date)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
