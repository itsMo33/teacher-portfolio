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

  const restrictedCategory = session?.user?.restrictedCategory;

  // A teacher additionally scoped to one إدارة المدرسة category (e.g. النشاط الطلابي) is still a
  // normal teacher everywhere else -- only pull them out of the teacher-only redirect below so
  // they can reach /admin for that one category; their own /api/portfolio etc. stay untouched.
  if (session && isAdminPath && role === "teacher" && !restrictedCategory) {
    return NextResponse.redirect(new URL("/teacher", nextUrl.origin));
  }

  if (session && isTeacherPath && role !== "teacher") {
    return NextResponse.redirect(new URL("/admin", nextUrl.origin));
  }

  // A restricted admin/agent account (e.g. الأمن والسلامة) can only ever see the dashboard
  // (which renders just their one إدارة المدرسة category) and upload/delete files within it --
  // every other admin page and API is off-limits. For a restricted *teacher* account, only the
  // admin pages are locked down this way -- their own teacher-facing APIs stay fully usable.
  if (session && restrictedCategory) {
    const allowedApi = nextUrl.pathname.startsWith("/api/school-files");
    const allowedPage = nextUrl.pathname === "/admin";
    const lockedDown = role === "teacher" ? isAdminPath : isAdminPath || isProtectedApi;

    if (!allowedApi && !allowedPage && lockedDown) {
      if (nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/admin", nextUrl.origin));
    }
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
