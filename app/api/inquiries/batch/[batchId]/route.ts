import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteInquiries, getInquiryRole } from "@/lib/inquiries";
import { logActivity } from "@/lib/audit";

/** Deletes every inquiry from one upload at once -- handy when a PDF was sent wrongly. رائد and the manager can do
 *  it for any upload; the uploading account only for its own. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = getInquiryRole(session.user);
  if (role !== "reviewer" && role !== "officer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let query = supabaseAdmin.from("inquiries").select("id").eq("batch_id", batchId);
  if (role === "officer") query = query.eq("uploaded_by", session.user.id);
  const { data } = await query;
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteInquiries(data.map((row) => row.id as string));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تعذّر الحذف" }, { status: 500 });
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "delete_inquiry",
    details: `حذف دفعة مسائلات: ${data.length}`,
  });
  return NextResponse.json({ success: true, deleted: data.length });
}
