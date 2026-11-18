import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { PwaSetup } from "@/components/ui/PwaSetup";
import { PwaOff } from "@/components/ui/PwaOff";
import { auth } from "@/lib/auth/auth-options";
import { canUseApp } from "@/lib/app-access";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "900"],
});

export async function generateMetadata(): Promise<Metadata> {
  const app = canUseApp((await auth())?.user);
  return {
    title: "أثر",
    description: "نظام إدارة ملفات إنجاز المعلمين للمدرسة",
    ...(app
      ? { manifest: "/app.webmanifest", applicationName: "أثر", icons: { apple: "/icons/apple-touch-icon.png" }, appleWebApp: { capable: true, title: "أثر", statusBarStyle: "default" as const } }
      : {}),
  };
}

export async function generateViewport(): Promise<Viewport> {
  return canUseApp((await auth())?.user) ? { themeColor: "#0b6e4f" } : {};
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = canUseApp((await auth())?.user);
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden">{children}
        {app ? <PwaSetup /> : <PwaOff />}
      </body>
    </html>
  );
}
