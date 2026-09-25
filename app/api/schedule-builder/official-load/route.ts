import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { matchShortName } from "@/lib/substitute-data";

/** Bridges the new جدول مدرسي builder into جدول الانتظار: every teacher whose weekly schedule has
 *  been built here gets their "نصاب" (official load) computed live, as a count of their
 *  schedule_slots rows, instead of the frozen number baked into lib/substitute-data.ts. A teacher
 *  مؤيد hasn't gotten to yet just has no entry here, so the caller keeps using the old static value
 *  for them -- no partial-migration breakage. Keyed by the same short two-part name the substitute
 *  system already uses (via matchShortName), not by teacher_id. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "teacher" && session.user.restrictedCategory) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.from("schedule_slots").select("teacher_id, users(name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const countsByTeacherId = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    if (!user) continue;
    const existing = countsByTeacherId.get(row.teacher_id);
    if (existing) existing.count++;
    else countsByTeacherId.set(row.teacher_id, { name: user.name, count: 1 });
  }

  const officialLoad: Record<string, number> = {};
  for (const { name, count } of countsByTeacherId.values()) {
    const shortName = matchShortName(name);
    if (shortName) officialLoad[shortName] = count;
  }

  return NextResponse.json({ officialLoad });
}
