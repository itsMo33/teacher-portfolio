import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = session?.user?.role;

  const isAdminPath = nextUrl.pathname.startsWith("/admin") || nextUrl.pathname.startsWith("/api/admin");
  const isTeacherPath = nextUrl.pathname.startsWith("/teacher");
  const isProtectedApi =
    nextUrl.pathname.startsWith("/api/portfolio") ||
    nextUrl.pathname.startsWith("/api/schedule") ||
    nextUrl.pathname.startsWith("/api/teachers") ||
    nextUrl.pathname.startsWith("/api/report") ||
    nextUrl.pathname.startsWith("/api/school-files") ||
    nextUrl.pathname.startsWith("/api/ai");

  if (!session && (isAdminPath || isTeacherPath || isProtectedApi)) {
    if (nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isAdminPath && role === "teacher") {
    return NextResponse.redirect(new URL("/teacher", nextUrl.origin));
  }

  if (session && isTeacherPath && role !== "teacher") {
    return NextResponse.redirect(new URL("/admin", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/teacher/:path*",
    "/admin/:path*",
    "/api/portfolio/:path*",
    "/api/schedule/:path*",
    "/api/teachers/:path*",
    "/api/report/:path*",
    "/api/school-files/:path*",
    "/api/ai/:path*",
  ],
};
