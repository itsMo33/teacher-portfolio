import Link from "next/link";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

export function ProgressGrid({
  slotCounts,
  linkPrefix,
}: {
  /** Maps "category:subcategory" (subcategory empty string when the section has none) to file count. */
  slotCounts: Record<string, number>;
  linkPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {PORTFOLIO_SECTIONS.map((section) => {
        if (section.key === "schedule") return null;

        const total = section.hasSubsections
          ? section.subsections!.reduce((sum, sub) => sum + (slotCounts[`${section.key}:${sub.key}`] ?? 0), 0)
          : slotCounts[`${section.key}:`] ?? 0;

        return (
          <Link
            key={section.key}
            href={`${linkPrefix}/${section.key}`}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[var(--brand-primary)] transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-50">{section.labelAr}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                  total > 0
                    ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {total} ملف
              </span>
            </div>
            {section.hasSubsections && (
              <ul className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                {section.subsections!.map((sub) => (
                  <li key={sub.key} className="flex items-center justify-between">
                    <span>{sub.labelAr}</span>
                    <span>{slotCounts[`${section.key}:${sub.key}`] ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </Link>
        );
      })}
    </div>
  );
}
