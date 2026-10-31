import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { deleteInquiry, getInquiry, getInquiryRole } from "@/lib/inquiries";
import { logActivity } from "@/lib/audit";

/** رائد (or the manager) deletes an inquiry for good -- e.g. one sent by mistake. The teacher stops seeing it. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getInquiryRole(session.user) !== "reviewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const inquiry = await getInquiry(id);
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteInquiry(id);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تعذّر الحذف" }, { status: 500 });
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "delete_inquiry",
    targetTeacherId: inquiry.teacherId,
    targetTeacherName: inquiry.teacherName,
    details: inquiry.kind === "delay" ? "حذف مسائلة تأخير" : "حذف مسائلة",
  });
  return NextResponse.json({ success: true });
}
