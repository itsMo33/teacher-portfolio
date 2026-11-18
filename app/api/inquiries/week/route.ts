import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getInquiryRole, listInquiries } from "@/lib/inquiries";
import { addDays, weekStartOf } from "@/lib/teacher-performance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["delay", "absence", "other"];

/** The inquiries sent during one school week (Sunday to Saturday, Riyadh time), in printing order: by kind, then by
 *  teacher. The page merges their filled forms (with attachments) into one PDF in the browser. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = getInquiryRole(session.user);
  if (role !== "reviewer" && role !== "officer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const day = req.nextUrl.searchParams.get("week");
  const kind = req.nextUrl.searchParams.get("kind") ?? "all";
  // done = the inquiry has been decided, open = not decided yet, all = both
  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekStart = weekStartOf(day && DATE_RE.test(day) ? day : today);
  const weekEnd = addDays(weekStart, 6);

  const riyadhDay = (iso: string) => new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = (await listInquiries())
    .filter((i) => riyadhDay(i.createdAt) >= weekStart && riyadhDay(i.createdAt) <= weekEnd)
    .filter((i) => !KINDS.includes(kind) || i.kind === kind)
    .filter((i) => status === "done" ? i.decision !== null : status === "open" ? i.decision === null : true)
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.teacherName.localeCompare(b.teacherName, "ar"));

  return NextResponse.json({
    weekStart,
    weekEnd,
    inquiries: rows.map((i) => ({ id: i.id, teacherName: i.teacherName, kind: i.kind, decided: i.decision !== null })),
  });
}
