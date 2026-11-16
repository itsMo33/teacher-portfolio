import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getInquiry, getInquiryRole, isRecipientOf } from "@/lib/inquiries";
import { buildCompletedForm, formTemplateOf } from "@/lib/inquiry-form";

export const maxDuration = 60;

/** The inquiry as the school's own form, filled in (the teacher's answer, the decision, the director's signature),
 *  ready to print. The reviewers can print any of them; a teacher only their own, once they have answered it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inquiry = await getInquiry(id);
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = getInquiryRole(session.user);
  // the reviewers print any inquiry; the recipient only their own, once they have answered it
  const mayPrint = role === "reviewer" || role === "officer" || (isRecipientOf(session.user.id, inquiry) && (!!inquiry.decidedAt || !!inquiry.justifiedAt));
  if (!mayPrint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // a form we have no template for (an older file upload...) opens as the plain printable page instead
  if (!formTemplateOf(inquiry)) return NextResponse.redirect(new URL(`/inquiries/${id}/print`, req.url));

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
