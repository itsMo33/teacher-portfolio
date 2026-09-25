import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

async function requireAccess() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const isFullAdmin = session.user.role !== "teacher" && !session.user.restrictedCategory;
  const isGrantedTeacher = session.user.role === "teacher" && session.user.canBuildSchedule;
  if (!isFullAdmin && !isGrantedTeacher) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Refuses to delete a subject still used in a schedule slot, so a filled-in grid can't lose its
 *  meaning silently. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAccess();
  if (error) return error;
  const { id } = await params;

  const { count } = await supabaseAdmin
    .from("schedule_slots")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", id);
  if (count && count > 0) {
    return NextResponse.json({ error: `لا يمكن حذف المادة لوجودها في ${count} حصة بالجدول` }, { status: 409 });
  }

  const { error: deleteError } = await supabaseAdmin.from("subjects").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
