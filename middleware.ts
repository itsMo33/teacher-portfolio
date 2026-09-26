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
    nextUrl.pathname.startsWith("/api/school-management-categories") ||
    nextUrl.pathname.startsWith("/api/substitute-assignments") ||
    nextUrl.pathname.startsWith("/api/teacher-performance") ||
    nextUrl.pathname.startsWith("/api/schedule-builder") ||
    nextUrl.pathname.startsWith("/api/impact-measurements");

  if (!session && (isAdminPath || isTeacherPath || isProtectedApi)) {
    if (nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  const restrictedCategory = session?.user?.restrictedCategory;
  const canBuildSchedule = session?.user?.canBuildSchedule ?? false;
  const demoViewOnly = session?.user?.demoViewOnly ?? false;

  // A demo/presentation account can browse both /teacher and /admin no matter its role, but can
  // never change anything -- block every mutating request up front, before any other rule runs.
  if (demoViewOnly && req.method !== "GET" && req.method !== "HEAD" && nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "هذا حساب عرض فقط -- لا يمكن التعديل" }, { status: 403 });
  }

  // A teacher additionally scoped to one إدارة المدرسة category, or granted the جدول مدرسي
  // builder (e.g. مؤيد), is still a normal teacher everywhere else -- only pull them out of the
  // teacher-only redirect below so they can reach /admin; their own /api/portfolio etc. stay untouched.
  if (session && isAdminPath && role === "teacher" && !restrictedCategory && !canBuildSchedule && !demoViewOnly) {
    return NextResponse.redirect(new URL("/teacher", nextUrl.origin));
  }

  if (session && isTeacherPath && role !== "teacher" && !demoViewOnly) {
    return NextResponse.redirect(new URL("/admin", nextUrl.origin));
  }

  // A restricted admin/agent account (e.g. الأمن والسلامة) can only ever see the dashboard
  // (which renders just their one إدارة المدرسة category) and upload/delete files within it --
  // every other admin page and API is off-limits. For a restricted *teacher* account, only the
  // admin pages are locked down this way -- their own teacher-facing APIs stay fully usable.
  // A teacher additionally granted canBuildSchedule gets the same treatment, scoped instead to
  // /admin/schedule-builder + /api/schedule-builder -- the two capabilities combine if both are set.
  if (session && role === "teacher" && (restrictedCategory || canBuildSchedule)) {
    const allowedApi =
      nextUrl.pathname.startsWith("/api/school-files") ||
      (canBuildSchedule && nextUrl.pathname.startsWith("/api/schedule-builder"));
    const allowedPage =
      nextUrl.pathname === "/admin" || (canBuildSchedule && nextUrl.pathname.startsWith("/admin/schedule-builder"));
    const lockedDown = isAdminPath;

    if (!allowedApi && !allowedPage && lockedDown) {
      if (nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/admin", nextUrl.origin));
    }
  }

  // A non-teacher (agent/manager) restricted-category account is locked down exactly as before --
  // kept as its own block since it also covers isProtectedApi (a teacher-role restricted account
  // never had that extra lockdown, per the original design).
  if (session && role !== "teacher" && restrictedCategory) {
    const allowedApi = nextUrl.pathname.startsWith("/api/school-files");
    const allowedPage = nextUrl.pathname === "/admin";
    const lockedDown = isAdminPath || isProtectedApi;

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
    "/api/school-management-categories/:path*",
    "/api/substitute-assignments/:path*",
    "/api/teacher-performance/:path*",
    "/api/schedule-builder/:path*",
    "/api/impact-measurements/:path*",
  ],
};
