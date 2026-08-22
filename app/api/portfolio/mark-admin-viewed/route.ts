import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PORTFOLIO_SECTIONS } from "@/lib/portfolio-sections";

const TEACHER_WRITABLE_CATEGORIES = PORTFOLIO_SECTIONS.filter((s) => s.teacherWritable).map((s) => s.key);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teacherId } = await req.json();
  if (!teacherId) {
    return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("attachments")
    .update({ admin_viewed_at: new Date().toISOString() })
    .eq("teacher_id", teacherId)
    .in("category", TEACHER_WRITABLE_CATEGORIES)
    .is("admin_viewed_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
