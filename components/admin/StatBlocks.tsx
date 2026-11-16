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
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{children}</div>;
}

export function StatSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
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
    <ul className="flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      {items.map(([label, value]) => (
        <li key={label} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1 text-sm">
          <span className="absolute inset-y-0 right-0 rounded-md bg-[var(--brand-primary)]/10" style={{ width: `${Math.max((value / max) * 100, 3)}%` }} />
          <span className="relative truncate text-slate-800 dark:text-slate-100">{label}</span>
          <span className="relative shrink-0 tabular-nums font-semibold text-slate-700 dark:text-slate-200">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ columns, rows, empty = "لا توجد بيانات" }: { columns: string[]; rows: (string | number)[][]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
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
