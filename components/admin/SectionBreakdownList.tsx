"use client";

import { useState } from "react";

export interface SectionBreakdownTeacher {
  name: string;
  /** How many of this section's subsections the teacher completed (1 for sections without subsections). */
  doneCount: number;
  /** Total subsections in this section (1 for sections without subsections). */
  totalCount: number;
}

export interface SectionBreakdownItem {
  key: string;
  label: string;
  count: number;
  teachers: SectionBreakdownTeacher[];
}

export function SectionBreakdownList({ sections, total }: { sections: SectionBreakdownItem[]; total: number }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {sections.map((s) => {
        const percent = total > 0 ? Math.round((s.count / total) * 100) : 0;
        const isOpen = openKey === s.key;
        return (
          <div
            key={s.key}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
          >
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : s.key)}
              className="flex w-full flex-col gap-1.5 text-right"
            >
              <span className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-200">{s.label}</span>
                <span className="text-slate-500">
                  {s.count} من {total} ({percent}%)
                </span>
              </span>
              <span className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <span
                  className="block h-full bg-[var(--brand-primary)] rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </span>
            </button>

            {isOpen && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                {s.teachers.map((t) => {
                  const colorClass =
                    t.doneCount >= t.totalCount
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : t.doneCount > 0
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
                  return (
                    <span key={t.name} className={`rounded-full px-2.5 py-1 text-xs ${colorClass}`}>
                      {t.name}
                      {t.totalCount > 1 && ` (${t.doneCount}/${t.totalCount})`}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
