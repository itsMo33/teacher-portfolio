import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteFile, PORTFOLIO_BUCKET, SCHEDULE_BUCKET } from "@/lib/supabase/storage";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, id } = await req.json();
  if (type !== "teacher" && type !== "attachment") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (type === "teacher") {
    const { data: teacher } = await supabaseAdmin
      .from("users")
      .select("id, name")
      .eq("id", id)
      .eq("role", "teacher")
      .not("deleted_at", "is", null)
      .maybeSingle();

    if (!teacher) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: attachments } = await supabaseAdmin
      .from("attachments")
      .select("file_path")
      .eq("teacher_id", id);
    for (const a of attachments ?? []) {
      await deleteFile(PORTFOLIO_BUCKET, a.file_path).catch(() => {});
    }

    const { data: schedule } = await supabaseAdmin
      .from("schedules")
      .select("file_path")
      .eq("teacher_id", id)
      .maybeSingle();
    if (schedule) {
      await deleteFile(SCHEDULE_BUCKET, schedule.file_path).catch(() => {});
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      actorId: session.user.id,
      actorName: session.user.name ?? "",
      action: "purge_teacher",
      targetTeacherId: id,
      targetTeacherName: teacher.name,
    });
  } else {
    const { data: attachment } = await supabaseAdmin
      .from("attachments")
      .select("id, teacher_id, file_path, file_name")
      .eq("id", id)
      .not("deleted_at", "is", null)
      .maybeSingle();

    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteFile(PORTFOLIO_BUCKET, attachment.file_path).catch(() => {});
    const { error } = await supabaseAdmin.from("attachments").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: teacher } = await supabaseAdmin
      .from("users")
      .select("name")
      .eq("id", attachment.teacher_id)
      .maybeSingle();

    await logActivity({
      actorId: session.user.id,
      actorName: session.user.name ?? "",
      action: "purge_attachment",
      targetTeacherId: attachment.teacher_id,
      targetTeacherName: teacher?.name ?? undefined,
      details: attachment.file_name,
    });
  }

  return NextResponse.json({ success: true });
}
