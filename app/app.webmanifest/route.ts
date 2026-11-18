import { NextResponse } from "next/server";

/** The app manifest. The page links to it only for the accounts that may install the app (see lib/app-access.ts). */
export function GET() {
  return NextResponse.json(
    {
      name: "أثر -- ثانوية مكة المكرمة",
      short_name: "أثر",
      description: "نظام إدارة ملفات إنجاز المعلمين والمسائلات",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      dir: "rtl",
      lang: "ar",
      background_color: "#f5f6f8",
      theme_color: "#0b6e4f",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
