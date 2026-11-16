"use client";

import { useEffect, useRef, useState } from "react";

interface FileItem {
  id: string;
  fileName: string;
  url: string;
}

const MAX_FILES = 5;

/** The supporting files attached to an inquiry. The recipient can add (PDF, image, Word) and remove files until it is
 *  decided; the reviewers see them read-only. */
export function InquiryFilesBox({ inquiryId, allowUpload }: { inquiryId: string; allowUpload: boolean }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // bumped after an upload or a delete to read the list again
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inquiries/${inquiryId}/files`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setFiles(data.files);
          setCanEdit(!!data.canEdit);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [inquiryId, version]);

  async function upload(list: FileList) {
    setError("");
    setBusy(true);
    try {
      let count = files.length;
      for (const file of Array.from(list)) {
        if (count >= MAX_FILES) throw new Error(`الحد الأقصى ${MAX_FILES} ملفات`);
        const urlRes = await fetch(`/api/inquiries/${inquiryId}/files/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
        });
        if (!urlRes.ok) throw new Error((await urlRes.json().catch(() => ({}))).error ?? "تعذّر رفع الملف");
        const { path, signedUrl } = await urlRes.json();
        const put = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!put.ok) throw new Error("تعذّر رفع الملف");
        const confirmRes = await fetch(`/api/inquiries/${inquiryId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: path, fileName: file.name, mimeType: file.type }),
        });
        if (!confirmRes.ok) throw new Error((await confirmRes.json().catch(() => ({}))).error ?? "تعذّر حفظ الملف");
        count++;
        reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الملف");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(fileId: string) {
    if (!window.confirm("حذف هذا المرفق؟")) return;
    const res = await fetch(`/api/inquiries/${inquiryId}/files?fileId=${fileId}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "تعذّر الحذف");
    else reload();
  }

  if (!loaded) return <p className="text-xs text-slate-400">جارٍ تحميل المرفقات...</p>;
  const editable = allowUpload && canEdit;
  if (!editable && files.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">المرفقات ({files.length})</p>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate text-[var(--brand-primary)] hover:underline">
                {f.fileName}
              </a>
              {editable && (
                <button type="button" onClick={() => remove(f.id)} className="shrink-0 text-red-600 dark:text-red-400 hover:underline">
                  حذف
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && files.length < MAX_FILES && (
        <div>
          <p className="mb-1 text-xs text-slate-500">لو عندك ما يؤيد عذرك (سكليف، تقرير طبي...) أرفقه هنا -- PDF أو صورة أو Word، حتى 10MB.</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg,.doc,.docx"
            disabled={busy}
            onChange={(e) => e.target.files && e.target.files.length > 0 && void upload(e.target.files)}
            className="text-xs text-slate-600 dark:text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-[var(--brand-primary)] file:px-3 file:py-1.5 file:text-xs file:text-white"
          />
          {busy && <p className="mt-1 text-xs text-slate-500">جارٍ الرفع...</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
