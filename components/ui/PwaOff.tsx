"use client";

import { useEffect } from "react";

/** For the accounts without the app: removes any service worker an earlier visit left in this browser. */
export function PwaOff() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((list) => Promise.all(list.map((r) => r.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("athar-")).map((k) => caches.delete(k))))
      .catch(() => {});
  }, []);
  return null;
}
