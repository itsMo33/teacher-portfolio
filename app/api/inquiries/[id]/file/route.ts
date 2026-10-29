import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getInquiry, getInquiryRole, getSourceUrl, getTeacherFileUrl } from "@/lib/inquiries";

/** A short-lived link to the inquiry's PDF. A teacher gets only the page cut out for them; the reviewers
 *  (?source=1) can open the whole uploaded PDF. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = getInquiryRole(session.user);
  const inquiry = await getInquiry(id);
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let url: string | null = null;
  if (role === "teacher") {
    if (inquiry.teacherId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    url = await getTeacherFileUrl(id);
  } else if (role === "reviewer" || role === "officer") {
    url = req.nextUrl.searchParams.get("source") === "1" ? await getSourceUrl(id) : (await getTeacherFileUrl(id)) ?? (await getSourceUrl(id));
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!url) return NextResponse.json({ error: "لا يوجد ملف" }, { status: 404 });
  return NextResponse.json({ url });
}
