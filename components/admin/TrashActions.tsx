"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrashActions({
  type,
  id,
  label,
}: {
  type: "teacher" | "attachment";
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(action: "restore" | "purge") {
    if (action === "purge") {
      const confirmed = window.confirm(`هل أنت متأكد من حذف "${label}" نهائيًا؟ لا يمكن التراجع عن هذا.`);
      if (!confirmed) return;
    }

    setBusy(true);
    const res = await fetch(`/api/admin/trash/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "فشلت العملية");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
      <button
        onClick={() => call("restore")}
        disabled={busy}
        className="text-xs text-[var(--brand-primary)] hover:underline disabled:opacity-50"
      >
        استعادة
      </button>
      <button
        onClick={() => call("purge")}
        disabled={busy}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        حذف نهائي
      </button>
    </div>
  );
}
