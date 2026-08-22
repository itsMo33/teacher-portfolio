"use client";

import { useEffect } from "react";

export function MarkAdminViewedOnMount({ teacherId }: { teacherId: string }) {
  useEffect(() => {
    fetch("/api/portfolio/mark-admin-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
