import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteFile, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { canEditStage, getReferral, getReferralActor } from "@/lib/student-referrals";
import type { ReferralFileStage } from "@/lib/student-referral-constants";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  if (actor !== "agent" && actor !== "counselor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fileId } = await req.json();
  if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

  const { data: file } = await supabaseAdmin
    .from("student_referral_files")
    .select("id, referral_id, stage, file_path")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const referral = await getReferral(file.referral_id);
  if (!referral || !canEditStage(actor, referral, file.stage as ReferralFileStage)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("student_referral_files").delete().eq("id", fileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The row is gone either way; a leftover storage object is harmless, so don't fail the request over it.
  await deleteFile(PORTFOLIO_BUCKET, file.file_path).catch(() => {});

  return NextResponse.json({ success: true });
}
