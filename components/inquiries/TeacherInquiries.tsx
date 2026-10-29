"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherInquiryView } from "@/lib/inquiries";

function day(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
}

function Card({ item }: { item: TeacherInquiryView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(item.justification ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [opened, setOpened] = useState(false);

  const decided = item.decision !== null;
  const isDelay = item.kind === "delay";

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !opened) {
      setOpened(true);
      fetch(`/api/inquiries/${item.id}/opened`, { method: "POST" }).catch(() => {});
    }
  }

  async function viewFile() {
    const res = await fetch(`/api/inquiries/${item.id}/file`);
    if (res.ok) window.open((await res.json()).url, "_blank", "noopener");
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/inquiries/${item.id}/justify`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) setMessage({ text: (await res.json().catch(() => ({}))).error ?? "تعذّر الإرسال", ok: false });
    else {
      setMessage({ text: "تم إرسال تبريرك", ok: true });
      router.refresh();
    }
    setBusy(false);
  }

  const status = decided
    ? item.decision === "accepted"
      ? { label: "تم قبول المسائلة", tone: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
      : { label: "لم يتم قبول المسائلة", tone: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }
    : item.justifiedAt
      ? { label: "تم إرسال تبريرك", tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
      : { label: "بانتظار تبريرك", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm">
      <button type="button" onClick={toggle} className="flex flex-wrap items-center justify-between gap-2 text-right">
        <span className="font-semibold text-slate-900 dark:text-slate-50">
          {isDelay ? "مسائلة تأخير" : "مسائلة"} -- {day(item.createdAt)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${status.tone}`}>{status.label}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          {item.textReadable || !item.hasTeacherFile ? (
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-700 dark:text-slate-200">{item.extractedText}</p>
          ) : (
            <p className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-600 dark:text-slate-300">افتح ملف المسائلة لقراءتها.</p>
          )}
          {item.hasTeacherFile && (
            <button type="button" onClick={viewFile} className="self-start text-xs text-[var(--brand-primary)] hover:underline">
              فتح ملف المسائلة
            </button>
          )}

          {decided && item.decisionNote && <p className="text-xs text-slate-500">ملاحظة الإدارة: {item.decisionNote}</p>}

          {!decided && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-500">
                {isDelay ? "اكتب تبريرك لسبب التأخير بشكل واضح ومختصر" : "اكتب ردّك على المسائلة"}
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
              {message && <p className={`text-xs ${message.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{message.text}</p>}
              <div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || text.trim().length < 5}
                  className="rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
                >
                  {item.justifiedAt ? "تحديث التبرير" : "إرسال التبرير"}
                </button>
              </div>
            </div>
          )}
          {decided && item.justification && <p className="text-xs text-slate-500">تبريرك: {item.justification}</p>}
        </div>
      )}
    </li>
  );
}

export function TeacherInquiries({ inquiries }: { inquiries: TeacherInquiryView[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {inquiries.map((i) => (
        <Card key={i.id} item={i} />
      ))}
      {inquiries.length === 0 && <p className="text-sm text-slate-400">ما عندك مسائلات.</p>}
    </ul>
  );
}
