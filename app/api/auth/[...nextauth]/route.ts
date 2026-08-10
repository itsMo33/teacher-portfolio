import { handlers } from "@/lib/auth/auth-options";

// Auth endpoints must never be cached by the CDN.
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
