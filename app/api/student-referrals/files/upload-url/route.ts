import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { buildReferralFilePath, createUploadSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/portfolio-sections";
import { canEditStage, getReferral, getReferralActor } from "@/lib/student-referrals";

/** Signed upload URL for a large referral attachment, so the browser uploads straight to storage
 *  instead of through this function (Vercel caps a function's request body at 4.5MB). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = getReferralActor(session.user);
  if (actor !== "agent" && actor !== "counselor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { referralId, fileName, mimeType, size } = await req.json();
  if (typeof referralId !== "string" || !fileName || typeof size !== "number") {
    return NextResponse.json({ error: "Missing referralId, fileName or size" }, { status: 400 });
  }

  const referral = await getReferral(referralId);
  if (!referral) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stage = actor === "agent" ? "agent" : "counselor";
  if (!canEditStage(actor, session.user.id, referral, stage)) {
    return NextResponse.json({ error: "لا يمكن إضافة ملفات بعد تحويل النموذج" }, { status: 409 });
  }

  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const path = buildReferralFilePath(referralId, stage, fileName);
  try {
    const { signedUrl, token } = await createUploadSignedUrl(PORTFOLIO_BUCKET, path);
    return NextResponse.json({ path, signedUrl, token });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create upload URL" }, { status: 500 });
  }
}
