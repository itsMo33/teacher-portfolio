import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildReferralFilePath, uploadFile, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";
import { canEditStage, getReferral, getReferralActor } from "@/lib/student-referrals";
import type { ReferralFileStage } from "@/lib/student-referral-constants";

/** The caller's own stage (agent -> "agent", counselor -> "counselor"), or an error response if
 *  they can't attach anything to this referral right now. The stage is derived from the account,
 *  never taken from the request, so one role can't write into the other's attachment list. */
async function authorize(session: Session, referralId: unknown) {
  const actor = getReferralActor(session.user);
  if (actor !== "agent" && actor !== "counselor") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (typeof referralId !== "string") {
    return { error: NextResponse.json({ error: "Missing referralId" }, { status: 400 }) };
  }
  const referral = await getReferral(referralId);
  if (!referral) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const stage: ReferralFileStage = actor === "agent" ? "agent" : "counselor";
  if (!canEditStage(actor, session.user.id, referral, stage)) {
    return { error: NextResponse.json({ error: "لا يمكن إضافة ملفات بعد تحويل النموذج" }, { status: 409 }) };
  }
  return { referral, stage };
}

async function finalize(
  session: Session,
  referralId: string,
  stage: ReferralFileStage,
  filePath: string,
  fileName: string,
  mimeType: string
) {
  const { data, error } = await supabaseAdmin
    .from("student_referral_files")
    .insert({
      referral_id: referralId,
      stage,
      file_path: filePath,
      file_name: fileName,
      mime_type: mimeType || "application/octet-stream",
      uploaded_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Large files upload straight to storage via a signed URL (Vercel caps a function's request
  // body at 4.5MB); this JSON branch then just records the already-uploaded object.
  const isConfirm = (req.headers.get("content-type") ?? "").includes("application/json");
  if (isConfirm) {
    const { referralId, filePath, fileName, mimeType } = await req.json();
    if (!filePath || !fileName) return NextResponse.json({ error: "Missing filePath or fileName" }, { status: 400 });
    const authz = await authorize(session, referralId);
    if (authz.error) return authz.error;
    return finalize(session, authz.referral.id, authz.stage, filePath, fileName, mimeType);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const authz = await authorize(session, formData.get("referralId"));
  if (authz.error) return authz.error;

  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const path = buildReferralFilePath(authz.referral.id, authz.stage, file.name);
  await uploadFile(PORTFOLIO_BUCKET, path, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");

  return finalize(session, authz.referral.id, authz.stage, path, file.name, file.type || "application/octet-stream");
}
