"use client";

import { useMemo, useState } from "react";
import { TeacherTable, type TeacherRow } from "./TeacherTable";

export function TeacherListWithSearch({ teachers }: { teachers: TeacherRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter(
      (t) => t.name.includes(q) || t.national_id.includes(q) || (t.subject ?? "").includes(q)
    );
  }, [teachers, query]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحث بالاسم أو رقم الهوية أو المادة..."
        className="w-full max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
      />
      {query && (
        <p className="text-xs text-slate-400">
          {filtered.length} من {teachers.length} معلم
        </p>
      )}
      <TeacherTable teachers={filtered} />
    </div>
  );
}
