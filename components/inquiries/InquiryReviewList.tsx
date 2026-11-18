"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ABSENCE_OPTIONS, INQUIRY_KIND_LABEL, absenceOptionOf, isLateReply, type AbsenceOption, type InquiryKind } from "@/lib/inquiry-logic";
import { InquiryFilesBox } from "@/components/inquiries/InquiryFilesBox";

export interface ReviewInquiry {
  id: string;
  kind: InquiryKind;
  teacherName: string;
  createdAt: string;
  delayMinutes: number | null;
  extractedText: string;
  textReadable: boolean;
  teacherOpenedAt: string | null;
  justification: string | null;
  decision: "accepted" | "rejected" | null;
  decisionOption: AbsenceOption | null;
  decisionNote: string | null;
  /** How many files the recipient attached to their answer. */
  fileCount: number;
  /** One of the older file inquiries brought over into this list: already decided, never opened or answered here. */
  legacy: boolean;
}

type Filter = "all" | "awaiting" | "late" | "unopened" | "unjustified" | "decided" | "accepted" | "rejected" | "archive";

/** The filter chips, الكل first. */
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "awaiting", label: "بانتظار قراري" },
  { key: "late", label: "متأخر عن الرد" },
  { key: "unopened", label: "لم يفتحها المعلم" },
  { key: "unjustified", label: "لم يبرر" },
  { key: "decided", label: "تم البت فيها" },
  { key: "archive", label: "الأرشيف (القديمة)" },
];

/** How many show at first; the rest come with "عرض المزيد". */
const PAGE_SIZE = 30;

const DECISION_LABEL = { accepted: "مقبولة", rejected: "مرفوضة" } as const;

function day(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
}

const late = (i: ReviewInquiry) => isLateReply({ createdAt: i.createdAt, justifiedAt: i.justification ? i.createdAt : null, decidedAt: i.decision ? i.createdAt : null });

/** "Not opened" and "not answered" only make sense while an inquiry is still open -- once it is decided they say nothing --
 *  and the older file inquiries live in their own place (the archive) so they do not crowd the current ones. */
function matches(i: ReviewInquiry, f: Filter): boolean {
  if (f === "archive") return i.legacy;
  if (i.legacy) return false;
  if (f === "awaiting") return !i.decision;
  if (f === "late") return late(i);
  if (f === "unopened") return !i.decision && !i.teacherOpenedAt;
  if (f === "unjustified") return !i.decision && !i.justification;
  if (f === "decided") return !!i.decision;
  if (f === "accepted") return i.decision === "accepted";
  if (f === "rejected") return i.decision === "rejected";
  return true;
}

function Row({ item }: { item: ReviewInquiry }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function send(method: "PUT" | "DELETE", decision?: "accepted" | "rejected", option?: AbsenceOption) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/inquiries/${item.id}/decision`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PUT" ? JSON.stringify({ decision, option, note }) : undefined,
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحفظ");
    else router.refresh();
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`حذف مسائلة ${item.teacherName} نهائياً؟ تختفي من حساب المعلم أيضاً ولا يمكن التراجع.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/inquiries/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحذف");
      setBusy(false);
    } else router.refresh();
  }

  async function openFile() {
    const res = await fetch(`/api/inquiries/${item.id}/file?source=1`);
    if (res.ok) window.open((await res.json()).url, "_blank", "noopener");
  }

  const isDelay = item.kind === "delay";
  const isLate = late(item);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-50">{item.teacherName}</p>
          <p className="text-xs text-slate-500">
            {INQUIRY_KIND_LABEL[item.kind]}
            {isDelay && item.delayMinutes !== null ? ` -- ${item.delayMinutes} دقيقة` : ""} -- أُرسلت {day(item.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {item.legacy && <span className="rounded-full px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">قديمة</span>}
          {/* opened / answered only matter while the inquiry is open */}
          {!item.decision && (
            <>
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
            </>
          )}
          {isLate && <span className="rounded-full px-2 py-0.5 bg-red-600 text-white font-medium">متأخر عن الرد</span>}
          {item.decision && (
            <span
              className={`rounded-full px-2 py-0.5 ${
                item.decision === "accepted"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {item.kind === "absence" ? ABSENCE_OPTIONS.find((o) => o.key === absenceOptionOf(item.decision, item.decisionOption))?.short : DECISION_LABEL[item.decision]}
            </span>
          )}
        </div>
      </div>

      {item.justification && (
        <p className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-slate-700 dark:text-slate-200">«{item.justification}»</p>
      )}

      {item.fileCount > 0 && <InquiryFilesBox inquiryId={item.id} allowUpload={false} />}

      {item.decision && item.decisionNote && <p className="text-xs text-slate-500">ملاحظتك: {item.decisionNote}</p>}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[var(--brand-primary)] hover:underline">
          {open ? "إخفاء نص المسائلة" : "نص المسائلة"}
        </button>
        <a href={`/api/inquiries/${item.id}/form`} target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:underline">
          طباعة المسائلة مع مرفقاتها
        </a>
        <button type="button" onClick={openFile} className="text-slate-600 dark:text-slate-300 hover:underline">
          فتح ملف PDF
        </button>
        <button type="button" disabled={busy} onClick={remove} className="mr-auto text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
          حذف المسائلة
        </button>
      </div>
      {open && (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-xs text-slate-600 dark:text-slate-300">
          {item.textReadable ? item.extractedText : "النص ما انقرأ بشكل واضح من الملف -- افتح ملف PDF."}
        </p>
      )}

      {!item.decision ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة للمعلم (اختياري)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-xs text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
          {item.kind === "absence" ? (
            <div className="flex flex-col gap-1.5">
              {ABSENCE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={busy}
                  onClick={() => send("PUT", undefined, o.key)}
                  className={`rounded-lg px-3 py-1.5 text-right text-xs text-white disabled:opacity-50 ${
                    o.decision === "accepted" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : (
          <div className="flex flex-wrap gap-2">
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
          </div>
          )}
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

const CARDS: { filter: Filter; label: string; tone: string }[] = [
  { filter: "all", label: "الكل", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { filter: "accepted", label: "مقبولة", tone: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  { filter: "rejected", label: "مرفوضة", tone: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  { filter: "awaiting", label: "بانتظار القرار", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
];

/** One teacher's inquiries together: a title with the counts, and the inquiries inside when it is opened. */
function TeacherGroup({ name, items }: { name: string; items: ReviewInquiry[] }) {
  const waiting = items.filter((i) => !i.decision).length;
  const lateCount = items.filter(late).length;
  return (
    <details className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
        <span className="font-bold text-slate-900 dark:text-slate-50">{name}</span>
        <span className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{items.length} مسائلة</span>
          {waiting > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">بانتظار {waiting}</span>}
          {lateCount > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-white">متأخر {lateCount}</span>}
        </span>
      </summary>
      <ul className="flex flex-col gap-2 border-t border-slate-100 p-2 dark:border-slate-800">
        {items.map((i) => (
          <Row key={i.id} item={i} />
        ))}
      </ul>
    </details>
  );
}

export function InquiryReviewList({ inquiries, kind }: { inquiries: ReviewInquiry[]; kind: InquiryKind | "all" }) {
  const ofKind = useMemo(() => (kind === "all" ? inquiries : inquiries.filter((i) => i.kind === kind)), [inquiries, kind]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [byTeacher, setByTeacher] = useState(false);

  const count = (f: Filter) => ofKind.filter((i) => matches(i, f)).length;
  const shown = useMemo(() => {
    const q = search.trim();
    const list = ofKind.filter((i) => matches(i, filter) && (!q || i.teacherName.includes(q)));
    // open ones first (the newest first within each group: the server already sends them newest first)
    return [...list].sort((a, b) => Number(!!a.decision) - Number(!!b.decision));
  }, [ofKind, filter, search]);

  const groups = useMemo(() => {
    const m = new Map<string, ReviewInquiry[]>();
    for (const i of shown) m.set(i.teacherName, [...(m.get(i.teacherName) ?? []), i]);
    // the teacher with the most waiting / late first
    return [...m.entries()].sort((a, b) => b[1].filter(late).length - a[1].filter(late).length || b[1].filter((i) => !i.decision).length - a[1].filter((i) => !i.decision).length || a[0].localeCompare(b[0], "ar"));
  }, [shown]);

  const pick = (f: Filter) => {
    setFilter(f);
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* the mini dashboard: a tap on a box shows those inquiries */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CARDS.map((c) => (
          <button
            key={c.filter}
            type="button"
            onClick={() => pick(c.filter)}
            className={`flex flex-col items-center rounded-xl px-3 py-2 transition-shadow ${c.tone} ${filter === c.filter ? "ring-2 ring-[var(--brand-primary)]" : ""}`}
          >
            <span className="text-2xl font-bold tabular-nums">{count(c.filter)}</span>
            <span className="text-xs">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => pick(f.key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === f.key
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                : f.key === "late" && count("late") > 0
                  ? "border-red-400 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="بحث باسم المعلم"
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        />
        <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 text-xs" role="group" aria-label="طريقة العرض">
          {[
            [false, "قائمة"],
            [true, "حسب المعلم"],
          ].map(([value, label]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => setByTeacher(value as boolean)}
              className={`px-3 py-1.5 ${byTeacher === value ? "bg-[var(--brand-primary)] text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {byTeacher ? (
        <div className="flex flex-col gap-2">
          {groups.slice(0, limit).map(([name, items]) => (
            <TeacherGroup key={name} name={name} items={items} />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.slice(0, limit).map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </ul>
      )}
      {(byTeacher ? groups.length : shown.length) > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
          className="self-center rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          عرض المزيد ({(byTeacher ? groups.length : shown.length) - limit} متبقي)
        </button>
      )}
      {shown.length === 0 && <p className="text-sm text-slate-400">ما فيه مسائلات هنا.</p>}
    </div>
  );
}
