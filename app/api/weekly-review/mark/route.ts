import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canReview } from "@/lib/weekly-review";

/** "تمت المراجعة": records that the reviewer has looked at everything this teacher uploaded up to
 *  now, so the next weekly review only shows what they upload after this. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReview(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teacherId } = await req.json();
  if (typeof teacherId !== "string") return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("weekly_review_marks")
    .upsert(
      { teacher_id: teacherId, reviewer_id: session.user.id, reviewed_at: new Date().toISOString() },
      { onConflict: "teacher_id,reviewer_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
