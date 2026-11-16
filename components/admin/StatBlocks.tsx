import type { ReactNode } from "react";

export function StatCard({ label, value, tone = "brand" }: { label: string; value: string | number; tone?: "brand" | "green" | "red" | "amber" | "slate" }) {
  const color = {
    brand: "text-[var(--brand-primary)]",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    slate: "text-slate-600 dark:text-slate-300",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 break-inside-avoid print-exact">{children}</div>;
}

export function StatSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="stat-section flex flex-col gap-2">
      <div className="stat-head break-after-avoid">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        {note && <p className="text-xs text-slate-400">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** A ranked list with a bar behind each row, the widest bar being the biggest value. */
export function BarList({ items, empty = "لا توجد بيانات" }: { items: [string, number][]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;
  const max = Math.max(...items.map(([, v]) => v), 1);
  return (
    <ul className="flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 break-inside-avoid print-exact">
      {items.map(([label, value]) => (
        <li key={label} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1 text-sm">
          <span className="absolute inset-y-0 right-0 rounded-md bg-[var(--brand-primary)]/15 print-exact" style={{ width: `${Math.max((value / max) * 100, 3)}%` }} />
          <span className="relative truncate text-slate-800 dark:text-slate-100">{label}</span>
          <span className="relative shrink-0 tabular-nums font-semibold text-slate-700 dark:text-slate-200">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ columns, rows, empty = "لا توجد بيانات" }: { columns: string[]; rows: (string | number)[][]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;
  // a short table stays whole on one page; a long one may run over, but never inside a row
  return (
    <div
      data-long={rows.length > 18 ? "true" : undefined}
      className="overflow-x-auto print:overflow-visible rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
    >
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            {columns.map((c) => (
              <th key={c} className="p-2 text-right font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
              {row.map((cell, j) => (
                <td key={j} className={`p-2 ${j === 0 ? "font-medium text-slate-900 dark:text-slate-50" : "tabular-nums"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A date label ("2026-11-15" or "2026-11") is shortened to its month and day; any other label is shown whole. */
function shortLabel(label: string): string {
  return /^\d{4}-\d{2}/.test(label) ? label.slice(5) : label;
}

/** Colours for the charts (they are fixed, so a chart prints the same everywhere). */
export const CHART_COLORS = ["#1f7a4d", "#c0392b", "#e0a100", "#2b6cb0", "#6b7280", "#8e44ad", "#16a3a3", "#d35400"];

/** Charts side by side (one under the other on a narrow screen). */
export function ChartRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 break-inside-avoid">{children}</div>;
}

/** A ring chart with its legend: each slice, its count and its share. Slices with no value are left out. */
export function DonutChart({ items, colors, title }: { items: [string, number][]; colors?: string[]; title?: string }) {
  const shown = items.filter(([, v]) => v > 0);
  const total = shown.reduce((n, [, v]) => n + v, 0);
  const palette = colors ?? CHART_COLORS;
  if (total === 0) return <p className="text-sm text-slate-400">لا توجد بيانات للرسم</p>;
  const R = 42;
  const C = 2 * Math.PI * R;
  const lens = shown.map(([, v]) => (v / total) * C);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((x, y) => x + y, 0));
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 break-inside-avoid print-exact">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label={title ?? "رسم دائري"}>
        <g transform="rotate(-90 60 60)">
          {shown.map(([label], i) => (
            <circle key={label} cx="60" cy="60" r={R} fill="none" stroke={palette[i % palette.length]} strokeWidth="18" strokeDasharray={`${lens[i]} ${C - lens[i]}`} strokeDashoffset={-starts[i]} />
          ))}
        </g>
        <text x="60" y="58" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
          {total}
        </text>
        <text x="60" y="73" textAnchor="middle" fontSize="8" fill="#64748b">
          {title ?? "المجموع"}
        </text>
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {shown.map(([label, value], i) => (
          <li key={label} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm print-exact" style={{ backgroundColor: palette[i % palette.length] }} />
            <span className="text-slate-700 dark:text-slate-200">{label}</span>
            <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-50">{value}</span>
            <span className="text-xs text-slate-400">({Math.round((value / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical columns, one per item (days, months, periods), each with its value on top and its label below. */
export function ColumnChart({ items, color = "#1f7a4d", height = 140 }: { items: [string, number][]; color?: string; height?: number }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">لا توجد بيانات للرسم</p>;
  const max = Math.max(...items.map(([, v]) => v), 1);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 break-inside-avoid print-exact">
      <div className="flex items-end justify-between gap-1.5" style={{ height }} dir="ltr">
        {items.map(([label, value]) => (
          <div key={label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums font-semibold text-slate-700 dark:text-slate-200">{value}</span>
            <div className="w-full max-w-10 rounded-t-md print-exact" style={{ height: `${Math.max((value / max) * 100, 2)}%`, backgroundColor: color }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-1.5" dir="ltr">
        {items.map(([label]) => (
          <span key={label} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500" title={label}>
            {shortLabel(label)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Columns split in two parts (for example handed in / not handed in), one column per row. */
export function StackedColumns({
  rows,
  aLabel,
  bLabel,
  aColor = "#1f7a4d",
  bColor = "#c0392b",
  height = 150,
}: {
  rows: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  height?: number;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">لا توجد بيانات للرسم</p>;
  const max = Math.max(...rows.map((r) => r.a + r.b), 1);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 break-inside-avoid print-exact">
      <div className="mb-2 flex gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm print-exact" style={{ backgroundColor: aColor }} />
          {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm print-exact" style={{ backgroundColor: bColor }} />
          {bLabel}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2" style={{ height }} dir="ltr">
        {rows.map((r) => (
          <div key={r.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5">
            <span className="text-[10px] tabular-nums text-slate-600 dark:text-slate-300">
              {r.a}/{r.b}
            </span>
            <div className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${Math.max(((r.a + r.b) / max) * 100, 2)}%` }}>
              <div className="print-exact" style={{ flex: r.b, backgroundColor: bColor }} />
              <div className="print-exact" style={{ flex: r.a, backgroundColor: aColor }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-2" dir="ltr">
        {rows.map((r) => (
          <span key={r.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500" title={r.label}>
            {shortLabel(r.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
