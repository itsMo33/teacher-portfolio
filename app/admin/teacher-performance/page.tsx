"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PERFORMANCE_CATEGORIES, PerformanceCategory } from "@/lib/teacher-performance";

interface Teacher {
  id: string;
  name: string;
}

interface Record_ {
  teacherId: string;
  category: PerformanceCategory;
  status: "present" | "absent";
}

interface StatsRecord {
  category: PerformanceCategory;
  date: string;
  status: "present" | "absent";
}

function formatArDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TeacherPerformancePage() {
  const [date, setDate] = useState(todayStr());
  const [activeCategory, setActiveCategory] = useState<PerformanceCategory>(PERFORMANCE_CATEGORIES[0].key);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<Record_[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"track" | "stats">("track");
  const [statsTeacherId, setStatsTeacherId] = useState("");
  const [statsRecords, setStatsRecords] = useState<StatsRecord[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(true);

  const load = useCallback((d: string) => {
    return fetch(`/api/teacher-performance?date=${d}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        setTeachers(data.teachers ?? []);
        setRecords(data.records ?? []);
        setError("");
      })
      .catch(() => {
        setError("تعذّر تحميل البيانات");
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

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
        records: recs,
      };
    });
  }, [statsRecords]);

  const statusFor = useCallback(
    (teacherId: string): "present" | "absent" | null => {
      const rec = records.find((r) => r.teacherId === teacherId && r.category === activeCategory);
      if (rec) return rec.status;
      return category.mode === "assumed-present" ? "present" : null;
    },
    [records, activeCategory, category]
  );

  async function handleCycle(teacherId: string) {
    const current = statusFor(teacherId);
    let next: "present" | "absent" | null;

    if (category.mode === "assumed-present") {
      // present (default, no row) <-> absent (row) -- a click just flips the exception on/off.
      next = current === "absent" ? "present" : "absent";
    } else {
      // blank (no row) -> present -> absent -> blank -> ...
      next = current === null ? "present" : current === "present" ? "absent" : null;
    }

    const isDefault = (category.mode === "assumed-present" && next === "present") || (category.mode === "explicit" && next === null);

    // Optimistic update.
    setRecords((prev) => {
      const filtered = prev.filter((r) => !(r.teacherId === teacherId && r.category === activeCategory));
      return next === null || isDefault ? filtered : [...filtered, { teacherId, category: activeCategory, status: next }];
    });

    try {
      if (isDefault) {
        await fetch("/api/teacher-performance", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId, category: activeCategory, date }),
        });
      } else {
        await fetch("/api/teacher-performance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId, category: activeCategory, date, status: next }),
        });
      }
    } catch {
      load(date);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">متابعة أداء المعلمين</h2>
          <p className="text-sm text-slate-500">
            {category.mode === "assumed-present"
              ? "كل المعلمين مسجّلين حاضرين افتراضيًا -- اضغط على اسم المعلم الغائب لتحويله لغائب"
              : "كل المعلمين فاضين افتراضيًا -- اضغط لتسجيل حاضر، اضغط مرة ثانية لتسجيل غائب، وثالثة للرجوع فاضي"}
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          رجوع
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === "track" && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {PERFORMANCE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setViewMode("track");
                  setActiveCategory(c.key);
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
        {viewMode === "track" ? (
          <a
            href={`/admin/teacher-performance/print?category=${activeCategory}&date=${date}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            طباعة {category.labelAr}
          </a>
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

      {viewMode === "track" ? (
        !loaded ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
            جارٍ التحميل...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            {teachers.map((t) => {
              const status = statusFor(t.id);
              const colorClass =
                status === "present"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800"
                  : status === "absent"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
              const icon = status === "present" ? "✓" : status === "absent" ? "✗" : "";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleCycle(t.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${colorClass}`}
                >
                  {icon && <span className="font-bold">{icon}</span>}
                  {t.name}
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
              {statsByCategory.map(({ category: c, presentCount, absentCount, records: recs }) => (
                <div
                  key={c.key}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{c.labelAr}</h3>
                    <span className="text-sm text-slate-500">
                      {c.mode === "assumed-present"
                        ? `غياب: ${absentCount} مرة`
                        : `حضور: ${presentCount} — غياب: ${absentCount}`}
                    </span>
                  </div>
                  {recs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
                      {recs.map((r) => (
                        <span
                          key={r.date}
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            r.status === "present"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {r.status === "present" ? "✓" : "✗"} {formatArDate(r.date)}
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
