"use client";

import { useEffect, useState } from "react";
import { LATE_REPLY_DAYS } from "@/lib/inquiry-logic";

const HOUR = 60 * 60 * 1000;
const WINDOW = LATE_REPLY_DAYS * 24 * HOUR;

/** The colour of the bar as the time to answer runs out: green, then yellow, orange and red, and a dark red once late. */
const STOPS: [number, [number, number, number]][] = [
  [0, [34, 197, 94]],
  [0.4, [234, 179, 8]],
  [0.7, [249, 115, 22]],
  [1, [220, 38, 38]],
];
const LATE_COLOR = "rgb(127, 29, 29)";

function colorAt(progress: number): string {
  if (progress >= 1) return LATE_COLOR;
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i];
    const [p0, c0] = STOPS[i - 1];
    if (progress <= p1) {
      const t = (progress - p0) / (p1 - p0);
      return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(", ")})`;
    }
  }
  return LATE_COLOR;
}

function span(ms: number): string {
  const hours = Math.floor(ms / HOUR);
  if (hours < 1) return "أقل من ساعة";
  if (hours < 24) return `${hours} ساعة`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return `${days === 1 ? "يوم" : `${days} أيام`}${rest > 0 ? ` و${rest} ساعة` : ""}`;
}

/** A bar for an inquiry nobody has answered yet: it fills as the two days to answer pass, going from green to red,
 *  and turns dark red and says "متأخر عن الرد" when the time is up. */
export function ReplyTimer({ createdAt, compact = false }: { createdAt: string; compact?: boolean }) {
  // the clock is read after the page loads (a server-rendered time would not match the browser's)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <div className={compact ? "h-1.5" : "h-6"} />;

  const elapsed = now - new Date(createdAt).getTime();
  const progress = Math.max(0, elapsed / WINDOW);
  const isLate = progress >= 1;
  const color = colorAt(progress);
  const label = isLate ? `متأخر عن الرد منذ ${span(elapsed - WINDOW)}` : `باقي ${span(WINDOW - elapsed)} للرد`;

  return (
    <div className="flex flex-col gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(progress * 100))} aria-label={label}>
      <div className={`w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${compact ? "h-1.5" : "h-2.5"}`}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(Math.min(progress, 1) * 100, 3)}%`, backgroundColor: color }} />
      </div>
      <p className={`${compact ? "text-[11px]" : "text-xs"} font-medium`} style={{ color }}>
        {isLate ? `⚠ ${label}` : label}
      </p>
    </div>
  );
}
