import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

async function requireFullAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role === "teacher" || session.user.restrictedCategory) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Every performance record ever logged for one teacher, across every category and date --
 *  the admin picks the teacher; there's no date scoping here since the point is the full history. */
export async function GET(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const teacherId = req.nextUrl.searchParams.get("teacherId");
  if (!teacherId) {
    return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("teacher_performance_records")
    .select("category, record_date, status, period")
    .eq("teacher_id", teacherId)
    .order("record_date", { ascending: false });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({
    records: (data ?? []).map((r) => ({
      category: r.category,
      date: r.record_date,
      status: r.status,
      period: r.period || null,
    })),
  });
}
