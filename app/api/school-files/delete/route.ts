import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getOwnedCategoryKeys } from "@/lib/school-files";
import { logActivity } from "@/lib/audit";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher" && !session.user.restrictedCategory) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileId } = await req.json();
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  const { data: file, error: fetchError } = await supabaseAdmin
    .from("school_files")
    .select("id, file_name, category")
    .eq("id", fileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A category with a designated owner (restricted_category) can only be modified by that
  // owner -- everyone else, including full admins, gets a read-only view of it.
  const isOwner = session.user.restrictedCategory === file.category;
  if (!isOwner) {
    const ownedKeys = await getOwnedCategoryKeys();
    if (ownedKeys.has(file.category)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Soft delete only -- the file stays in storage and the row stays in the DB
  // until an admin permanently purges it from the trash.
  const { error: deleteError } = await supabaseAdmin
    .from("school_files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", fileId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? "",
    action: "soft_delete_school_file",
    details: `${file.category}: ${file.file_name}`,
  });

  return NextResponse.json({ success: true });
}
