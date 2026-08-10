import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attachmentIds } = await req.json();
  if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
    return NextResponse.json({ error: "Missing attachmentIds" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("attachments")
    .update({ viewed_at: new Date().toISOString() })
    .eq("teacher_id", session.user.id)
    .is("viewed_at", null)
    .in("id", attachmentIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
