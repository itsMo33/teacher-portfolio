"use client";

import { useEffect, useState } from "react";
import { INQUIRY_WINDOW_MS, schoolMsBetween } from "@/lib/inquiry-clock";

const HOUR = 60 * 60 * 1000;

/** The colour of the bar as the time runs out: green, then yellow, orange and red, and a dark red once late. */
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

/** A bar that fills as the two school days run out, going from green to red, and turns dark red and says who is late
 *  when the time is up. `subject` is whose clock it is: the teacher's reply ("reply") or the administration's decision
 *  ("decision"). Friday, Saturday and the teacher's excused days do not count. */
export function ReplyTimer({
  from,
  exempt = [],
  subject = "reply",
  compact = false,
}: {
  /** When the clock started: the inquiry reaching the teacher (reply), or the teacher's answer (decision). */
  from: string;
  exempt?: string[];
  subject?: "reply" | "decision";
  compact?: boolean;
}) {
  // the clock is read after the page loads (a server-rendered time would not match the browser's)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <div className={compact ? "h-1.5" : "h-6"} />;

  const elapsed = schoolMsBetween(new Date(from).getTime(), now, exempt);
  const progress = Math.max(0, elapsed / INQUIRY_WINDOW_MS);
  const isLate = progress >= 1;
  const color = colorAt(progress);
  const left = subject === "reply" ? "للرد" : "للقرار";
  const lateText = subject === "reply" ? "متأخر عن الرد" : "متأخر عن القرار";
  const label = isLate ? `${lateText} منذ ${span(elapsed - INQUIRY_WINDOW_MS)}` : `باقي ${span(INQUIRY_WINDOW_MS - elapsed)} ${left}`;

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
