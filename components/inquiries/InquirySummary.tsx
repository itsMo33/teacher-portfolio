import type { InquiryCounts } from "@/lib/inquiries";

const BOXES: { key: keyof InquiryCounts; label: string; tone: string }[] = [
  { key: "total", label: "الكل", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { key: "accepted", label: "مقبولة", tone: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  { key: "rejected", label: "مرفوضة", tone: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  { key: "pending", label: "بانتظار القرار", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
];

/** How many inquiries there are, and how many were accepted / rejected / still waiting for a decision. */
export function InquirySummary({ counts }: { counts: InquiryCounts }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {BOXES.map((b) => (
        <div key={b.key} className={`flex flex-col items-center rounded-xl px-3 py-2 ${b.tone}`}>
          <span className="text-2xl font-bold tabular-nums">{counts[b.key]}</span>
          <span className="text-xs">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
