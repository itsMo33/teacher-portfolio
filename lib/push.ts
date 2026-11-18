import "server-only";
import * as webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface PushMessage {
  title: string;
  body: string;
  /** The page the notification opens. */
  url: string;
  /** A notification with the same tag replaces the earlier one instead of piling up. */
  tag?: string;
}

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  return (configured = true);
}

/** Sends a notification to every device of the given accounts. Best effort: it never throws and never blocks the action
 *  that triggered it (no keys, no table, an expired device -- all are skipped; a dead device is forgotten). */
export async function sendPush(userIds: string[], message: PushMessage): Promise<number> {
  try {
    if (userIds.length === 0 || !configure()) return 0;
    const { data, error } = await supabaseAdmin.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
    if (error || !data?.length) return 0;
    const payload = JSON.stringify(message);
    let sent = 0;
    await Promise.all(
      data.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, payload, { TTL: 60 * 60 * 24 });
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint as string);
        }
      }),
    );
    return sent;
  } catch {
    return 0;
  }
}

/** The accounts that decide inquiries (رائد, the manager and the uploading account). */
export async function getInquiryDeciderIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("users").select("id, role, restricted_category").in("role", ["agent", "manager"]).is("deleted_at", null);
  return (data ?? [])
    .filter((u) => !u.restricted_category || u.restricted_category === "inquiries_officer")
    .map((u) => u.id as string);
}
