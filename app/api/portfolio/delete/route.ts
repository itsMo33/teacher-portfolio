import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteFile, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

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
    .select("id, teacher_id, file_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (fetchError || !attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = session.user.role === "teacher" && session.user.id === attachment.teacher_id;
  const isAdmin = session.user.role === "agent" || session.user.role === "manager";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteFile(PORTFOLIO_BUCKET, attachment.file_path);

  const { error: deleteError } = await supabaseAdmin
    .from("attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
