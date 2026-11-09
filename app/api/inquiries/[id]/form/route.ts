import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getInquiry, getInquiryRole } from "@/lib/inquiries";
import { buildCompletedForm, hasFormTemplate } from "@/lib/inquiry-form";

export const maxDuration = 60;

/** The inquiry as the school's own form, filled in (the teacher's answer, the decision, the director's signature),
 *  ready to print. The reviewers can print any of them; a teacher only their own, once it has been decided. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = getInquiryRole(session.user);
  const inquiry = role ? await getInquiry(id) : null;
  if (!role || !inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "teacher" && (inquiry.teacherId !== session.user.id || !inquiry.decidedAt)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasFormTemplate(inquiry.kind)) return NextResponse.json({ error: "no template" }, { status: 404 });

  try {
    const bytes = await buildCompletedForm(inquiry);
    if (!bytes) return NextResponse.json({ error: "تعذّر تجهيز النموذج" }, { status: 404 });
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="inquiry-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تعذّر تجهيز النموذج" }, { status: 500 });
  }
}
