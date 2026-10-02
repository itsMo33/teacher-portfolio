import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canReview } from "@/lib/weekly-review";

/** Sets (or clears, with status null) the reviewer's verdict on one uploaded file. A file sent back
 *  for changes must say what to change -- the teacher sees that note next to the file. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReview(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { attachmentId, status, note } = await req.json();
  if (typeof attachmentId !== "string") return NextResponse.json({ error: "Missing attachmentId" }, { status: 400 });
  if (status !== null && status !== "accepted" && status !== "needs_revision") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const cleanNote = typeof note === "string" ? note.trim() : "";
  if (status === "needs_revision" && !cleanNote) {
    return NextResponse.json({ error: "اكتب ملاحظة توضح المطلوب تعديله" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .update({
      review_status: status,
      review_note: status === "needs_revision" ? cleanNote : null,
      reviewed_at: status ? new Date().toISOString() : null,
    })
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
