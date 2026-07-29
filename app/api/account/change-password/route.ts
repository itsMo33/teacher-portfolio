import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Missing currentPassword or newPassword" }, { status: 400 });
  }
  if (String(newPassword).length < 4) {
    return NextResponse.json({ error: "كلمة المرور الجديدة قصيرة جدًا" }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, password_hash")
    .eq("id", session.user.id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 403 });
  }

  const password_hash = await hashPassword(newPassword);
  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ password_hash })
    .eq("id", session.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
