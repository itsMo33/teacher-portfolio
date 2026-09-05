"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SchoolFileItem {
  id: string;
  file_name: string;
  uploaded_at: string;
  signedUrl: string;
  mime_type?: string;
}

export function SchoolFileList({ files }: { files: SchoolFileItem[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch("/api/school-files/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: id }),
    });
    setDeletingId(null);
    router.refresh();
  }

  if (files.length === 0) {
    return <p className="text-sm text-slate-400">لا توجد ملفات بعد.</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {files.map((f, index) => {
          const isImage = f.mime_type?.startsWith("image/");
          return (
            <li
              key={f.id}
              style={{ animationDelay: `${index * 40}ms` }}
              className="animate-fade-in-up flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 transition-colors hover:border-[var(--brand-primary)]/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                {isImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.signedUrl}
                    alt={f.file_name}
                    onClick={() => setPreviewUrl(f.signedUrl)}
                    className="h-10 w-10 shrink-0 cursor-pointer rounded object-cover transition-transform hover:scale-105"
                  />
                )}
                <a
                  href={f.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--brand-primary)] hover:underline truncate"
                >
                  {f.file_name}
                </a>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400">
                  {new Date(f.uploaded_at).toLocaleDateString("ar-SA")}
                </span>
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={deletingId === f.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                >
                  حذف
                </button>
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
