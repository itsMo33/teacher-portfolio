"use client";

import { useEffect } from "react";

export function MarkViewedOnMount({ attachmentIds }: { attachmentIds: string[] }) {
  useEffect(() => {
    if (attachmentIds.length === 0) return;
    fetch("/api/portfolio/mark-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentIds }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
