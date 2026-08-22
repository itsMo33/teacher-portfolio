import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
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
    const { data: teacher, error } = await supabaseAdmin
      .from("users")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("role", "teacher")
      .select("id, name")
      .maybeSingle();

    if (error || !teacher) {
      return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
    }

    await logActivity({
      actorId: session.user.id,
      actorName: session.user.name ?? "",
      action: "restore_teacher",
      targetTeacherId: teacher.id,
      targetTeacherName: teacher.name,
    });
  } else {
    const { data: attachment, error } = await supabaseAdmin
      .from("attachments")
      .update({ deleted_at: null })
      .eq("id", id)
      .select("id, teacher_id, file_name")
      .maybeSingle();

    if (error || !attachment) {
      return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
    }

    const { data: teacher } = await supabaseAdmin
      .from("users")
      .select("name")
      .eq("id", attachment.teacher_id)
      .maybeSingle();

    await logActivity({
      actorId: session.user.id,
      actorName: session.user.name ?? "",
      action: "restore_attachment",
      targetTeacherId: attachment.teacher_id,
      targetTeacherName: teacher?.name ?? undefined,
      details: attachment.file_name,
    });
  }

  return NextResponse.json({ success: true });
}
