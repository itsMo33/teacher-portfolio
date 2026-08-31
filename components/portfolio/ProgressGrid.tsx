import Link from "next/link";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";
import { TROPHY_BADGE } from "@/lib/motivational-messages";

function NewBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-300">
      <span className="animate-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
      جديد
    </span>
  );
}

export function ProgressGrid({
  slotCounts,
  linkPrefix,
  hasSchedule,
  unviewedSectionKeys,
  hasUnviewedSchedule,
}: {
  /** Maps "category:subcategory" (subcategory empty string when the section has none) to file count. */
  slotCounts: Record<string, number>;
  linkPrefix: string;
  /** Whether the admin has uploaded a schedule for this teacher. */
  hasSchedule: boolean;
  /** Section keys with at least one admin-uploaded file the teacher hasn't opened yet. */
  unviewedSectionKeys?: Set<string>;
  hasUnviewedSchedule?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {PORTFOLIO_SECTIONS.map((section, index) => {
        const isSchedule = section.key === "schedule";
        const total = isSchedule
          ? 0
          : section.hasSubsections
          ? section.subsections!.reduce((sum, sub) => sum + (slotCounts[`${section.key}:${sub.key}`] ?? 0), 0)
          : slotCounts[`${section.key}:`] ?? 0;
        const requiredCount = section.hasSubsections ? undefined : section.requiredCount ?? 1;
        const isDone = isSchedule ? hasSchedule : total >= (requiredCount ?? 1);
        const isNew = isSchedule ? !!hasUnviewedSchedule : !!unviewedSectionKeys?.has(section.key);
        const sectionShowPercent = section.hasSubsections
          ? section.subsections!.some((s) => s.showPercent)
          : !!section.showPercent;
        const allSubsectionsDone = section.hasSubsections
          ? section.subsections!.every(
              (sub) => (slotCounts[`${section.key}:${sub.key}`] ?? 0) >= (sub.requiredCount ?? 1)
            )
          : false;
        const sectionPercent = isSchedule
          ? undefined
          : section.hasSubsections
          ? Math.round(
              (section.subsections!.reduce(
                (sum, sub) =>
                  sum + Math.min((slotCounts[`${section.key}:${sub.key}`] ?? 0) / (sub.requiredCount ?? 1), 1),
                0
              ) /
                section.subsections!.length) *
                100
            )
          : Math.round((Math.min(total / (requiredCount ?? 1), 1)) * 100);

        let badgeText: string | null;
        if (isSchedule) {
          badgeText = hasSchedule ? "معروض" : "لم يُرفع";
        } else if (!sectionShowPercent) {
          badgeText = (section.hasSubsections ? allSubsectionsDone : isDone) ? TROPHY_BADGE : null;
        } else if (requiredCount && requiredCount > 1) {
          badgeText = `${total}/${requiredCount} ملف (${sectionPercent}%)`;
        } else {
          badgeText = `${total} ملف (${sectionPercent}%)`;
        }

        return (
          <Link
            key={section.key}
            href={isSchedule ? "/teacher/schedule" : `${linkPrefix}/${section.key}`}
            style={{
              borderInlineStartColor: section.accentColor,
              borderInlineStartWidth: 4,
              animationDelay: `${index * 45}ms`,
            }}
            className="animate-fade-in-up group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
                  style={{ backgroundColor: section.accentColor }}
                />
                {section.labelAr}
                {isNew && <NewBadge />}
              </h3>
              {badgeText && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
                    isDone ? "" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                  style={isDone ? { backgroundColor: `${section.accentColor}1a`, color: section.accentColor } : undefined}
                >
                  {badgeText}
                </span>
              )}
            </div>
            {section.note && <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{section.note}</p>}
            {section.hasSubsections && (
              <ul className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                {section.subsections!.map((sub) => {
                  const subCount = slotCounts[`${section.key}:${sub.key}`] ?? 0;
                  const subRequired = sub.requiredCount ?? 1;
                  const subPercent = Math.round(Math.min(subCount / subRequired, 1) * 100);
                  const subDone = subCount >= subRequired;
                  const subText = sub.showPercent
                    ? `${subCount}${subRequired > 1 ? `/${subRequired}` : ""} (${subPercent}%)`
                    : subDone
                    ? TROPHY_BADGE
                    : null;
                  return (
                    <li key={sub.key} className="flex items-center justify-between gap-2">
                      <span>
                        {sub.labelAr}
                        {sub.note && <span className="text-amber-600 dark:text-amber-400"> ({sub.note})</span>}
                      </span>
                      {subText && <span className="shrink-0">{subText}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Link>
        );
      })}
    </div>
  );
}
