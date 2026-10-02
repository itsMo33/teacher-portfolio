import { STATUS_LABELS, type ReferralStatus } from "@/lib/student-referral-constants";

const STATUS_STYLES: Record<ReferralStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  with_agent: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  with_counselor: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
