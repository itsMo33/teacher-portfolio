"use client";

import { useMemo, useState } from "react";
import { TeacherTable, type TeacherRow } from "./TeacherTable";

type SortMode = "none" | "red-first" | "green-first";

const SORT_LABELS: Record<SortMode, string> = {
  none: "ترتيب حسب نسبة الإنجاز",
  "red-first": "الأحمر أولًا (0%)",
  "green-first": "الأخضر أولًا",
};

const NEXT_SORT: Record<SortMode, SortMode> = {
  none: "red-first",
  "red-first": "green-first",
  "green-first": "none",
};

export function TeacherListWithSearch({ teachers }: { teachers: TeacherRow[] }) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("none");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter(
      (t) => t.name.includes(q) || t.national_id.includes(q) || (t.subject ?? "").includes(q)
    );
  }, [teachers, query]);

  const sorted = useMemo(() => {
    if (sortMode === "none") return filtered;
    const factor = sortMode === "red-first" ? 1 : -1;
    return [...filtered].sort((a, b) => (a.completionPercent - b.completionPercent) * factor);
  }, [filtered, sortMode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهوية أو المادة..."
          className="w-full max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        />
        <button
          type="button"
          onClick={() => setSortMode((m) => NEXT_SORT[m])}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            sortMode === "none"
              ? "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              : "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
          }`}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              sortMode === "red-first" ? "bg-red-500" : sortMode === "green-first" ? "bg-green-500" : "bg-slate-400"
            }`}
          />
          {SORT_LABELS[sortMode]}
        </button>
      </div>
      {query && (
        <p className="text-xs text-slate-400">
          {filtered.length} من {teachers.length} معلم
        </p>
      )}
      <TeacherTable teachers={sorted} />
    </div>
  );
}
