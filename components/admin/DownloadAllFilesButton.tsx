"use client";

import { useState } from "react";

interface ManifestFile {
  zipPath: string;
  url: string;
}

interface FileWritable {
  write: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<FileWritable> }>;
}

// Without the File System Access API the zip has to be assembled in memory, so it is cut into
// parts of about this size instead of one file that could exhaust the browser tab's memory.
const PART_BYTES = 200 * 1024 * 1024;
const PARALLEL_DOWNLOADS = 4;

function triggerDownload(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export function DownloadAllFilesButton({ teacherId, label = "تحميل الملفات" }: { teacherId?: string; label?: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("جاري التجهيز...");
    const baseName = teacherId ? "ملفات-المعلم" : "ملفات-المعلمين";
    const picker = (window as unknown as SaveFilePickerWindow).showSaveFilePicker;
    try {
      // Chrome/Edge: stream straight into one .zip file on disk, so memory stays at about one file
      // at a time no matter how big the whole school's files are (that's ~1GB). The save dialog has
      // to open straight from the click -- the browser rejects it once any await has gone by.
      const handle = picker
        ? await picker.call(window, {
            suggestedName: `${baseName}.zip`,
            types: [{ description: "ملف مضغوط", accept: { "application/zip": [".zip"] } }],
          })
        : null;

      const qs = teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : "";
      const res = await fetch(`/api/teachers/files-manifest${qs}`);
      if (!res.ok) throw new Error("تعذّر جلب قائمة الملفات");
      const { files } = (await res.json()) as { files: ManifestFile[] };
      if (files.length === 0) {
        setStatus("لا توجد ملفات مرفوعة");
        return;
      }

      const { Zip, ZipPassThrough, zipSync } = await import("fflate");

      let writable: FileWritable | null = null;
      let writeChain: Promise<void> = Promise.resolve();
      let zip: InstanceType<typeof Zip> | null = null;

      if (handle) {
        writable = await handle.createWritable();
        const target = writable;
        zip = new Zip((err, chunk) => {
          if (err) throw err;
          writeChain = writeChain.then(() => target!.write(chunk));
        });
      }

      let part: Record<string, [Uint8Array, { level: 0 }]> = {};
      let partBytes = 0;
      let partNumber = 1;
      const flushPart = () => {
        if (Object.keys(part).length === 0) return;
        triggerDownload(zipSync(part), `${baseName}-جزء-${partNumber}.zip`);
        partNumber++;
        part = {};
        partBytes = 0;
      };

      let done = 0;
      let failed = 0;
      let bytes = 0;
      const queue = [...files];
      const worker = async () => {
        for (let f = queue.shift(); f; f = queue.shift()) {
          try {
            const r = await fetch(f.url);
            if (!r.ok) throw new Error();
            const data = new Uint8Array(await r.arrayBuffer());
            bytes += data.length;
            if (zip) {
              const entry = new ZipPassThrough(f.zipPath);
              zip.add(entry);
              entry.push(data, true);
              await writeChain;
            } else {
              part[f.zipPath] = [data, { level: 0 }];
              partBytes += data.length;
              if (partBytes >= PART_BYTES) flushPart();
            }
          } catch {
            failed++;
          }
          done++;
          setStatus(`جاري التحميل ${done} / ${files.length} (${Math.round(bytes / 1048576)} MB)`);
        }
      };
      await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));

      if (zip && writable) {
        zip.end();
        await writeChain;
        await writable.close();
      } else {
        flushPart();
      }
      setStatus(failed ? `تم، وتعذّر تحميل ${failed} ملف` : "تم التحميل");
    } catch (e) {
      // Cancelling the "save as" dialog isn't an error worth showing.
      setStatus(e instanceof DOMException && e.name === "AbortError" ? null : e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {label}
      </button>
      {status && <span className="text-xs text-slate-500">{status}</span>}
    </div>
  );
}
