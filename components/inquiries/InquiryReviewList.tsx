"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ABSENCE_OPTIONS, INQUIRY_KIND_LABEL, absenceOptionOf, type AbsenceOption, type InquiryKind } from "@/lib/inquiry-logic";
import type { InquiryStage } from "@/lib/inquiry-clock";
import { InquiryFilesBox } from "@/components/inquiries/InquiryFilesBox";
import { ReplyTimer } from "@/components/inquiries/ReplyTimer";

export interface ReviewInquiry {
  id: string;
  kind: InquiryKind;
  teacherName: string;
  createdAt: string;
  /** When the teacher answered (null until they do). */
  justifiedAt: string | null;
  /** Whose turn it is and whether they are late, in school time (worked out on the server). */
  stage: InquiryStage;
  /** The days the teacher is excused (their clock does not run on them). */
  exemptDates: string[];
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

type Filter = "all" | "admin" | "admin_late" | "teacher_late" | "with_teacher" | "unopened" | "decided" | "archive";

/** The filter chips, الكل first, then by whose turn it is. */
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "admin", label: "تنتظر قراري" },
  { key: "admin_late", label: "متأخرة عن القرار" },
  { key: "teacher_late", label: "متأخر عن الرد (جاهزة للبت)" },
  { key: "with_teacher", label: "عند المعلمين (في مهلتهم)" },
  { key: "unopened", label: "لم يفتحها المعلم" },
  { key: "decided", label: "تم البت فيها" },
  { key: "archive", label: "الأرشيف (القديمة)" },
];

/** Old links and alerts used other words for these. */
const FILTER_ALIASES: Record<string, Filter> = { awaiting: "admin", late: "teacher_late", unjustified: "with_teacher" };

/** How many show at first; the rest come with "عرض المزيد". */
const PAGE_SIZE = 30;

const DECISION_LABEL = { accepted: "مقبولة", rejected: "غير مقبولة" } as const;

function day(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
}

/** The inquiry is the teacher's to answer, or the administration's to decide. */
const withTeacher = (i: ReviewInquiry) => i.stage === "teacher_unopened" || i.stage === "teacher_opened" || i.stage === "teacher_late";
const withAdmin = (i: ReviewInquiry) => i.stage === "admin" || i.stage === "admin_late";

/** Each filter looks at whose turn it is: what is the administration's, what is still the teacher's (and so not the
 *  administration's delay), and what is late on either side. The older file inquiries live apart, in the archive. */
function matches(i: ReviewInquiry, f: Filter): boolean {
  if (f === "archive") return i.legacy;
  if (i.legacy) return false;
  if (f === "admin") return withAdmin(i);
  if (f === "admin_late") return i.stage === "admin_late";
  if (f === "teacher_late") return i.stage === "teacher_late";
  if (f === "with_teacher") return i.stage === "teacher_unopened" || i.stage === "teacher_opened";
  if (f === "unopened") return i.stage === "teacher_unopened";
  if (f === "decided") return i.stage === "decided";
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
          {item.stage === "teacher_unopened" && <span className="rounded-full px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">عند المعلم · لم يفتحها</span>}
          {item.stage === "teacher_opened" && <span className="rounded-full px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">عند المعلم · فتحها ولم يردّ</span>}
          {item.stage === "teacher_late" && <span className="rounded-full px-2 py-0.5 bg-red-600 text-white font-medium">متأخر عن الرد (المعلم)</span>}
          {item.stage === "admin" && <span className="rounded-full px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">ردّ المعلم · تنتظر قرارك</span>}
          {item.stage === "admin_late" && <span className="rounded-full px-2 py-0.5 bg-orange-700 text-white font-medium">متأخرة عن القرار (الإدارة)</span>}
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

      {!item.legacy && withTeacher(item) && <ReplyTimer from={item.createdAt} exempt={item.exemptDates} subject="reply" compact />}
      {!item.legacy && withAdmin(item) && item.justifiedAt && <ReplyTimer from={item.justifiedAt} subject="decision" compact />}

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
          {item.stage === "teacher_late" && <p className="text-xs text-red-700 dark:text-red-300">انقضت مهلة المعلم بدون رد -- تقدر تبت فيها الحين (تُطبع بدون إفادة).</p>}
          {(item.stage === "teacher_unopened" || item.stage === "teacher_opened") && <p className="text-xs text-slate-500">لسا في مهلة المعلم للرد. تقدر تبت فيها لكن الأفضل تنتظر ردّه.</p>}
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
              غير مقبول
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
  { filter: "admin", label: "تنتظر قرارك", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { filter: "with_teacher", label: "عند المعلمين", tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { filter: "teacher_late", label: "متأخر عن الرد", tone: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  { filter: "decided", label: "تم البت فيها", tone: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
];

/** One teacher's inquiries together: a title with where they stand, and the inquiries inside when it is opened. */
function TeacherGroup({ name, items }: { name: string; items: ReviewInquiry[] }) {
  const atTeacher = items.filter(withTeacher).length;
  const atAdmin = items.filter(withAdmin).length;
  const teacherLate = items.filter((i) => i.stage === "teacher_late").length;
  const adminLate = items.filter((i) => i.stage === "admin_late").length;
  return (
    <details className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
        <span className="font-bold text-slate-900 dark:text-slate-50">{name}</span>
        <span className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{items.length} مسائلة</span>
          {atTeacher > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">عنده {atTeacher}</span>}
          {teacherLate > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-white">متأخر عن الرد {teacherLate}</span>}
          {atAdmin > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">عند الإدارة {atAdmin}</span>}
          {adminLate > 0 && <span className="rounded-full bg-orange-700 px-2 py-0.5 text-white">متأخرة عن القرار {adminLate}</span>}
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

export function InquiryReviewList({ inquiries, kind, initialFilter }: { inquiries: ReviewInquiry[]; kind: InquiryKind | "all"; initialFilter?: string }) {
  const ofKind = useMemo(() => (kind === "all" ? inquiries : inquiries.filter((i) => i.kind === kind)), [inquiries, kind]);
  const [filter, setFilter] = useState<Filter>(() => {
    const wanted = FILTER_ALIASES[initialFilter ?? ""] ?? initialFilter;
    return FILTERS.some((f) => f.key === wanted) ? (wanted as Filter) : "all";
  });
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [byTeacher, setByTeacher] = useState(false);

  const count = (f: Filter) => ofKind.filter((i) => matches(i, f)).length;
  const shown = useMemo(() => {
    const q = search.trim();
    const list = ofKind.filter((i) => matches(i, filter) && (!q || i.teacherName.includes(q)));
    // open ones first (the newest first within each group: the server already sends them newest first)
    return [...list].sort((a, b) => Number(a.stage === "decided") - Number(b.stage === "decided"));
  }, [ofKind, filter, search]);

  const groups = useMemo(() => {
    const m = new Map<string, ReviewInquiry[]>();
    for (const i of shown) m.set(i.teacherName, [...(m.get(i.teacherName) ?? []), i]);
    // the teacher with the most late replies first, then the one with the most still open
    const lateOf = (l: ReviewInquiry[]) => l.filter((i) => i.stage === "teacher_late").length;
    const openOf = (l: ReviewInquiry[]) => l.filter((i) => i.stage !== "decided").length;
    return [...m.entries()].sort((a, b) => lateOf(b[1]) - lateOf(a[1]) || openOf(b[1]) - openOf(a[1]) || a[0].localeCompare(b[0], "ar"));
  }, [shown]);

  const pick = (f: Filter) => {
    setFilter(f);
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* the mini dashboard: a tap on a box shows those inquiries */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                : (f.key === "teacher_late" || f.key === "admin_late") && count(f.key) > 0
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
