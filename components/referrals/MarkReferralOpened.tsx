"use client";

import { useEffect } from "react";

/** Tells the server this referral has been opened by the person it is with (once per visit). */
export function MarkReferralOpened({ referralId }: { referralId: string }) {
  useEffect(() => {
    fetch(`/api/student-referrals/${referralId}/opened`, { method: "POST" }).catch(() => {});
  }, [referralId]);
  return null;
}
