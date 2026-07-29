import Link from "next/link";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

export function ProgressGrid({
  filledSlots,
  linkPrefix,
}: {
  /** Set of "category:subcategory" keys (subcategory empty string when section has none) that have at least one attachment. */
  filledSlots: Set<string>;
  linkPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {PORTFOLIO_SECTIONS.map((section) => {
        if (section.key === "schedule") return null;

        const isComplete = section.hasSubsections
          ? section.subsections!.every((sub) => filledSlots.has(`${section.key}:${sub.key}`))
          : filledSlots.has(`${section.key}:`);

        return (
          <Link
            key={section.key}
            href={`${linkPrefix}/${section.key}`}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-50">{section.labelAr}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isComplete
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {isComplete ? "مكتمل" : "ناقص"}
              </span>
            </div>
            {section.hasSubsections && (
              <ul className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                {section.subsections!.map((sub) => (
                  <li key={sub.key}>
                    {filledSlots.has(`${section.key}:${sub.key}`) ? "✓" : "✗"} {sub.labelAr}
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
