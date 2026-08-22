import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivity } from "@/lib/audit";

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
    .select("id, name")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .is("deleted_at", null)
    .maybeSingle();

  if (!teacher) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete only -- files, attachments and the schedule are left untouched
  // so restoring the account brings everything back exactly as it was.
  const { error } = await supabaseAdmin
    .from("users")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", teacherId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "soft_delete_teacher",
    targetTeacherId: teacherId,
    targetTeacherName: teacher.name,
  });

  return NextResponse.json({ success: true });
}
