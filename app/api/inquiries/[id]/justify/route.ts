import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { applyJustification, getInquiry } from "@/lib/inquiries";

/** The teacher writes (or rewrites, until رائد decides) their justification. For a delay inquiry this also
 *  refreshes the system's silent suggestion for رائد -- the teacher is never told what it is. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
