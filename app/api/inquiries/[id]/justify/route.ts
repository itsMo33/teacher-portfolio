import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { applyJustification, getInquiry, getInquiryRole } from "@/lib/inquiries";

/** The recipient (a teacher, a staff account or the lab technician) writes -- or rewrites, until the inquiry is decided -- their justification. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getInquiryRole(session.user) !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const inquiry = await getInquiry(id);
  if (!inquiry || inquiry.teacherId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inquiry.decidedAt) return NextResponse.json({ error: "تم البت في هذه المسائلة ولا يمكن تعديل التبرير" }, { status: 409 });

  const { text } = await req.json();
  const justification = typeof text === "string" ? text.trim() : "";
  if (justification.length < 5) return NextResponse.json({ error: "اكتب تبريرك بشكل واضح" }, { status: 400 });
  if (justification.length > 2000) return NextResponse.json({ error: "التبرير طويل جداً" }, { status: 400 });

  const error = await applyJustification(inquiry, justification);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
