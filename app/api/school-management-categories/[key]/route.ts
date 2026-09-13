import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivity } from "@/lib/audit";
import type { SchoolManagementSubsection } from "@/lib/school-files";

async function requireFullAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role === "teacher" || session.user.restrictedCategory) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

function isValidSubsections(value: unknown): value is SchoolManagementSubsection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (s) => s && typeof s === "object" && typeof s.key === "string" && typeof s.labelAr === "string"
    )
  );
}

/** Rename a category, recolor it, or replace its subsections list wholesale (add/rename/remove a
 *  subsection is done client-side on the current array, then saved back here in one call). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { session, error } = await requireFullAdmin();
  if (error) return error;
  const { key } = await params;

  const { labelAr, accentColor, subsections } = await req.json();

  const updates: Record<string, unknown> = {};
  if (labelAr !== undefined) {
    if (typeof labelAr !== "string" || !labelAr.trim()) {
      return NextResponse.json({ error: "Invalid labelAr" }, { status: 400 });
    }
    updates.label_ar = labelAr.trim();
  }
  if (accentColor !== undefined) {
    if (typeof accentColor !== "string" || !accentColor) {
      return NextResponse.json({ error: "Invalid accentColor" }, { status: 400 });
    }
    updates.accent_color = accentColor;
  }
  if (subsections !== undefined) {
    if (!isValidSubsections(subsections)) {
      return NextResponse.json({ error: "Invalid subsections" }, { status: 400 });
    }
    updates.subsections = subsections;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("school_management_categories")
    .update(updates)
    .eq("key", key)
    .select("key, label_ar, accent_color, subsections")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.subsections = data.subsections ?? [];

  await logActivity({
    actorId: session!.user.id,
    actorName: session!.user.name ?? "",
    action: "update_school_category",
    details: data.label_ar,
  });

  return NextResponse.json({ category: data });
}

/** Refuses to delete a category that still has files, so an admin can't accidentally strand
 *  uploaded files behind a category that no longer exists anywhere in the UI. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { session, error } = await requireFullAdmin();
  if (error) return error;
  const { key } = await params;

  const { count } = await supabaseAdmin
    .from("school_files")
    .select("id", { count: "exact", head: true })
    .eq("category", key)
    .is("deleted_at", null);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `لا يمكن حذف القسم لوجود ${count} ملف مرفوع فيه، احذف الملفات أولاً` },
      { status: 409 }
    );
  }

  const { data, error: deleteError } = await supabaseAdmin
    .from("school_management_categories")
    .delete()
    .eq("key", key)
    .select("label_ar")
    .maybeSingle();

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logActivity({
    actorId: session!.user.id,
    actorName: session!.user.name ?? "",
    action: "delete_school_category",
    details: data.label_ar,
  });

  return NextResponse.json({ success: true });
}
