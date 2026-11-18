import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Saves this device's notification subscription for the signed-in account. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await req.json();
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const authKey = sub?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof authKey !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    { endpoint, user_id: session.user.id, p256dh, auth: authKey, user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200) },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "شغّل أمر الـSQL الخاص بالإشعارات في Supabase أولاً" }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** Removes this device's subscription. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { endpoint } = await req.json();
  if (typeof endpoint === "string") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", session.user.id);
  return NextResponse.json({ success: true });
}
