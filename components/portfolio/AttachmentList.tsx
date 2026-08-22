"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AttachmentItem {
  id: string;
  file_name: string;
  uploaded_at: string;
  signedUrl: string;
  viewed_at?: string | null;
}

export function AttachmentList({
  attachments,
  canDelete,
  showViewedStatus,
}: {
  attachments: AttachmentItem[];
  canDelete: boolean;
  showViewedStatus?: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch("/api/portfolio/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: id }),
    });
    setDeletingId(null);
    router.refresh();
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-slate-400">لا توجد مرفقات بعد.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {attachments.map((a, index) => (
        <li
          key={a.id}
          style={{ animationDelay: `${index * 40}ms` }}
          className="animate-fade-in-up flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 transition-colors hover:border-[var(--brand-primary)]/40"
        >
          <a
            href={a.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--brand-primary)] hover:underline truncate"
          >
            {a.file_name}
          </a>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-slate-400">
              {new Date(a.uploaded_at).toLocaleDateString("ar-SA")}
            </span>
            {showViewedStatus && (
              <span
                className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                  a.viewed_at
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {!a.viewed_at && (
                  <span className="animate-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
                {a.viewed_at ? "تم الاطلاع" : "لم يُفتح بعد"}
              </span>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(a.id)}
                disabled={deletingId === a.id}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                حذف
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
