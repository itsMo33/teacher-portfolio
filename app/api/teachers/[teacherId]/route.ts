import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteFile, PORTFOLIO_BUCKET, SCHEDULE_BUCKET } from "@/lib/supabase/storage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { teacherId } = await params;

  const { data: teacher } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .maybeSingle();

  if (!teacher) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: attachments } = await supabaseAdmin
    .from("attachments")
    .select("file_path")
    .eq("teacher_id", teacherId);

  for (const a of attachments ?? []) {
    await deleteFile(PORTFOLIO_BUCKET, a.file_path).catch(() => {});
  }

  const { data: schedule } = await supabaseAdmin
    .from("schedules")
    .select("file_path")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (schedule) {
    await deleteFile(SCHEDULE_BUCKET, schedule.file_path).catch(() => {});
  }

  const { error } = await supabaseAdmin.from("users").delete().eq("id", teacherId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
