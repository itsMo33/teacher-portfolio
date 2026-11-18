import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { PwaSetup } from "@/components/ui/PwaSetup";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "أثر",
  description: "نظام إدارة ملفات إنجاز المعلمين للمدرسة",
  applicationName: "أثر",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "أثر", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b6e4f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden">{children}
        <PwaSetup />
      </body>
    </html>
  );
}
