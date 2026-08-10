// Auth pages must never be statically cached/prerendered -- a cached login
// page can end up served for live authentication requests on Vercel's edge,
// causing sign-in to hang indefinitely.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
