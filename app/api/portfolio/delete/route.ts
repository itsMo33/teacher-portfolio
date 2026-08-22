import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivity } from "@/lib/audit";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attachmentId } = await req.json();
  if (!attachmentId) {
    return NextResponse.json({ error: "Missing attachmentId" }, { status: 400 });
  }

  const { data: attachment, error: fetchError } = await supabaseAdmin
    .from("attachments")
    .select("id, teacher_id, file_name, category, subcategory")
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = session.user.role === "teacher" && session.user.id === attachment.teacher_id;
  const isAdmin = session.user.role === "agent" || session.user.role === "manager";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete only -- the file stays in storage and the row stays in the DB
  // until an admin permanently purges it from the trash.
  const { error: deleteError } = await supabaseAdmin
    .from("attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", attachmentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { data: teacher } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", attachment.teacher_id)
    .maybeSingle();

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "soft_delete_attachment",
    targetTeacherId: attachment.teacher_id,
    targetTeacherName: teacher?.name ?? undefined,
    details: attachment.file_name,
  });

  return NextResponse.json({ success: true });
}
