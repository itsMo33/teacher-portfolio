"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountabilityStatus, ACCOUNTABILITY_STATUS_LABELS_AR } from "@/lib/portfolio-sections";

export interface AttachmentItem {
  id: string;
  file_name: string;
  uploaded_at: string;
  signedUrl: string;
  viewed_at?: string | null;
  mime_type?: string;
  accountability_status?: AccountabilityStatus | null;
}

export function AttachmentList({
  attachments,
  canDelete,
  showViewedStatus,
  editableAccountabilityStatus,
}: {
  attachments: AttachmentItem[];
  canDelete: boolean;
  showViewedStatus?: boolean;
  /** Admin-only: show a select to mark each file "مقبول بعذر" / "غير مقبول" (مسائلات section). */
  editableAccountabilityStatus?: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  async function handleStatusChange(id: string, status: AccountabilityStatus | null) {
    setSavingStatusId(id);
    await fetch("/api/portfolio/accountability-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: id, status }),
    });
    setSavingStatusId(null);
    router.refresh();
  }

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
    <>
      <ul className="flex flex-col gap-2">
        {attachments.map((a, index) => {
          const isImage = a.mime_type?.startsWith("image/");
          return (
            <li
              key={a.id}
              style={{ animationDelay: `${index * 40}ms` }}
              className="animate-fade-in-up flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 transition-colors hover:border-[var(--brand-primary)]/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                {isImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.signedUrl}
                    alt={a.file_name}
                    onClick={() => setPreviewUrl(a.signedUrl)}
                    className="h-10 w-10 shrink-0 cursor-pointer rounded object-cover transition-transform hover:scale-105"
                  />
                )}
                <a
                  href={a.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--brand-primary)] hover:underline truncate"
                >
                  {a.file_name}
                </a>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400">
                  {new Date(a.uploaded_at).toLocaleDateString("ar-SA")}
                </span>
                {editableAccountabilityStatus ? (
                  <select
                    value={a.accountability_status ?? ""}
                    disabled={savingStatusId === a.id}
                    onChange={(e) =>
                      handleStatusChange(a.id, (e.target.value || null) as AccountabilityStatus | null)
                    }
                    className="text-xs rounded-full border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-0.5 disabled:opacity-50"
                  >
                    <option value="">بدون قرار</option>
                    <option value="excused">{ACCOUNTABILITY_STATUS_LABELS_AR.excused}</option>
                    <option value="rejected">{ACCOUNTABILITY_STATUS_LABELS_AR.rejected}</option>
                  </select>
                ) : (
                  a.accountability_status && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                        a.accountability_status === "excused"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      }`}
                    >
                      {ACCOUNTABILITY_STATUS_LABELS_AR[a.accountability_status]}
                    </span>
                  )
                )}
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
          );
        })}
      </ul>

      {previewUrl && (
        <div
          className="animate-fade-in-scale fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="إغلاق"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
