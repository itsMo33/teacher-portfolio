"use client";

import { useEffect } from "react";

export function MarkScheduleViewedOnMount() {
  useEffect(() => {
    fetch("/api/schedule/mark-viewed", { method: "POST" });
  }, []);

  return null;
}
