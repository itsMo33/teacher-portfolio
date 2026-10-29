"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface ReviewInquiry {
  id: string;
  kind: "delay" | "other";
  teacherName: string;
  createdAt: string;
  delayMinutes: number | null;
  extractedText: string;
  teacherOpenedAt: string | null;
  justification: string | null;
  systemDecision: "accepted" | "rejected" | null;
  systemNote: string | null;
  decision: "accepted" | "rejected" | null;
  decisionNote: string | null;
}

type Filter = "all" | "awaiting" | "unopened" | "unjustified" | "decided";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "awaiting", label: "بانتظار قراري" },
  { key: "unopened", label: "لم يفتحها المعلم" },
  { key: "unjustified", label: "لم يبرر" },
  { key: "decided", label: "تم البت فيها" },
];

const DECISION_LABEL = { accepted: "مقبولة", rejected: "مرفوضة" } as const;

function day(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
}

function matches(i: ReviewInquiry, f: Filter): boolean {
  if (f === "awaiting") return !i.decision;
  if (f === "unopened") return !i.teacherOpenedAt;
  if (f === "unjustified") return !i.justification;
  if (f === "decided") return !!i.decision;
  return true;
}

function Row({ item }: { item: ReviewInquiry }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function send(method: "PUT" | "DELETE", decision?: "accepted" | "rejected") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/inquiries/${item.id}/decision`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PUT" ? JSON.stringify({ decision, note }) : undefined,
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحفظ");
    else router.refresh();
    setBusy(false);
  }

  async function openFile() {
    const res = await fetch(`/api/inquiries/${item.id}/file?source=1`);
    if (res.ok) window.open((await res.json()).url, "_blank", "noopener");
  }

  const isDelay = item.kind === "delay";
  const opposite = item.systemDecision === "accepted" ? "rejected" : "accepted";

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-50">{item.teacherName}</p>
          <p className="text-xs text-slate-500">
            {isDelay ? `مسائلة تأخير${item.delayMinutes !== null ? ` -- ${item.delayMinutes} دقيقة` : ""}` : "مسائلة أخرى"} -- أُرسلت {day(item.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 ${
              item.teacherOpenedAt
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {item.teacherOpenedAt ? `فتحها ${day(item.teacherOpenedAt)}` : "لم يفتحها"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 ${
              item.justification
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {item.justification ? "برّر" : "لم يبرر"}
          </span>
          {item.decision && (
            <span
              className={`rounded-full px-2 py-0.5 ${
                item.decision === "accepted"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {DECISION_LABEL[item.decision]}
            </span>
          )}
        </div>
      </div>

      {item.justification && (
        <p className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-slate-700 dark:text-slate-200">«{item.justification}»</p>
      )}

      {isDelay && item.systemNote && (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          <strong>اقتراح النظام:</strong> {item.systemDecision ? DECISION_LABEL[item.systemDecision] : "بدون اقتراح"} -- {item.systemNote}
        </p>
      )}

      {item.decision && item.decisionNote && <p className="text-xs text-slate-500">ملاحظتك: {item.decisionNote}</p>}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[var(--brand-primary)] hover:underline">
          {open ? "إخفاء نص المسائلة" : "نص المسائلة"}
        </button>
        <button type="button" onClick={openFile} className="text-slate-600 dark:text-slate-300 hover:underline">
          فتح ملف PDF
        </button>
      </div>
      {open && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-xs text-slate-600 dark:text-slate-300">{item.extractedText}</p>}

      {!item.decision ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة للمعلم (اختياري)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-xs text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
          <div className="flex flex-wrap gap-2">
            {isDelay && item.systemDecision ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send("PUT", item.systemDecision!)}
                  className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  اعتماد ({DECISION_LABEL[item.systemDecision]})
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send("PUT", opposite)}
                  className="rounded-lg border border-amber-400 text-amber-700 dark:text-amber-300 text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  تغيير إلى {DECISION_LABEL[opposite]}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send("PUT", "accepted")}
                  className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  قبول
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send("PUT", "rejected")}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  رفض
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
          <button type="button" disabled={busy} onClick={() => send("DELETE")} className="text-xs text-slate-500 hover:underline disabled:opacity-50">
            التراجع عن القرار
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}

export function InquiryReviewList({ inquiries, kind }: { inquiries: ReviewInquiry[]; kind: "delay" | "other" }) {
  const [filter, setFilter] = useState<Filter>("all");
  const ofKind = useMemo(() => inquiries.filter((i) => i.kind === kind), [inquiries, kind]);
  const shown = useMemo(() => ofKind.filter((i) => matches(i, filter)), [ofKind, filter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === f.key
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {f.label} ({ofKind.filter((i) => matches(i, f.key)).length})
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((i) => (
          <Row key={i.id} item={i} />
        ))}
      </ul>
      {shown.length === 0 && <p className="text-sm text-slate-400">ما فيه مسائلات هنا.</p>}
    </div>
  );
}
