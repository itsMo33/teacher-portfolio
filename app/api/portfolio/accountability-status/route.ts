import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ACCOUNTABILITY_STATUSES } from "@/lib/portfolio-sections";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "agent" && session.user.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attachmentId, status } = await req.json();
  if (!attachmentId || (status !== null && !ACCOUNTABILITY_STATUSES.includes(status))) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: attachment } = await supabaseAdmin
    .from("attachments")
    .select("id, category")
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!attachment || attachment.category !== "accountability") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("attachments")
    .update({ accountability_status: status })
    .eq("id", attachmentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
