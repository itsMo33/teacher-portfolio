import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teacherId } = await params;

  const isOwner = session.user.role === "teacher" && session.user.id === teacherId;
  const isAdmin = session.user.role === "agent" || session.user.role === "manager";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: attachments, error } = await supabaseAdmin
    .from("attachments")
    .select("id, category, subcategory, file_name, file_path, mime_type, uploaded_at")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (attachments ?? []).map(async (a) => ({
      ...a,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, a.file_path),
    }))
  );

  return NextResponse.json({ attachments: withUrls });
}
