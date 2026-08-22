"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTeacherButton({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف حساب "${teacherName}"؟ سينتقل الحساب وملفاته لسلة المحذوفات ويمكن استعادته لاحقًا.`
    );
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/teachers/${teacherId}`, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "فشل حذف الحساب");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      {deleting ? "جارٍ الحذف..." : "حذف الحساب"}
    </button>
  );
}
