import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Records the first time the teacher opens their own inquiry, so رائد can see whether it was opened. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabaseAdmin
    .from("inquiries")
    .update({ teacher_opened_at: new Date().toISOString() })
    .eq("id", id)
    .eq("teacher_id", session.user.id)
    .is("teacher_opened_at", null);
  return NextResponse.json({ success: true });
}
