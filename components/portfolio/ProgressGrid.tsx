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

        return (
          <Link
            key={section.key}
            href={`${linkPrefix}/${section.key}`}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[var(--brand-primary)] transition-colors"
          >
            <h3 className="font-semibold text-slate-900 dark:text-slate-50 mb-2">{section.labelAr}</h3>
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
